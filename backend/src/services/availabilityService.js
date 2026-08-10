import WorkerProfile from '../models/WorkerProfile.js';
import Booking from '../models/Booking.js';
import ServiceCategory from '../models/ServiceCategory.js';

export class AvailabilityService {
    /**
     * Check if a worker is available for a requested start & end date/time
     */
    static async validateAvailability({
        workerId,
        serviceCategoryId,
        scheduledStart,
        scheduledEnd,
        pricingType = 'HOURLY',
    }) {
        const startDate = new Date(scheduledStart);
        const endDate = new Date(scheduledEnd);
        const now = new Date();

        // 1. Past Date Check
        if (startDate.getTime() < now.getTime() - 60000) {
            const error = new Error('Scheduled start time cannot be in the past.');
            error.statusCode = 400;
            error.errorCode = 'PAST_DATE_NOT_ALLOWED';
            throw error;
        }

        if (endDate.getTime() <= startDate.getTime()) {
            const error = new Error('Scheduled end time must be after start time.');
            error.statusCode = 400;
            error.errorCode = 'INVALID_TIME_RANGE';
            throw error;
        }

        // 2. Fetch Worker Profile
        const workerProfile = await WorkerProfile.findOne({ userId: workerId });
        if (!workerProfile) {
            const error = new Error('Worker profile not found.');
            error.statusCode = 404;
            error.errorCode = 'WORKER_NOT_FOUND';
            throw error;
        }

        // 3. Worker Approval & Visibility Checks
        if (workerProfile.verificationStatus !== 'APPROVED') {
            const error = new Error('Worker is currently not approved for bookings.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_NOT_APPROVED';
            throw error;
        }

        if (workerProfile.isTemporarilyUnavailable || !workerProfile.isPubliclyVisible) {
            const error = new Error('Worker is temporarily unavailable.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_UNAVAILABLE';
            throw error;
        }

        // 4. Minimum Duration Check
        const durationMinutes = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        let minDurationMinutes = (workerProfile.minimumBookingDuration || 1) * 60;
        
        if (serviceCategoryId) {
            const category = await ServiceCategory.findById(serviceCategoryId);
            if (category && category.minimumBookingDuration) {
                minDurationMinutes = Math.max(minDurationMinutes, category.minimumBookingDuration * 60);
            }
        }

        if (durationMinutes < minDurationMinutes) {
            const error = new Error(`Minimum booking duration is ${minDurationMinutes / 60} hour(s).`);
            error.statusCode = 400;
            error.errorCode = 'INVALID_DURATION';
            throw error;
        }

        // 5. Working Hours & Days Check (Timezone-Aware)
        const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const targetTimeZone = workerProfile.timezone || 'Asia/Kolkata';

        const getZonedParts = (date, timeZone) => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
                weekday: 'short',
            });
            const parts = {};
            formatter.formatToParts(date).forEach((p) => {
                if (p.type !== 'literal') parts[p.type] = p.value;
            });
            return parts;
        };

        const getUtcDateForZoneTime = (year, month, day, hour, minute, second = 0, timeZone = 'Asia/Kolkata') => {
            const pad = (n) => String(n).padStart(2, '0');
            const approx = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`);
            const p = getZonedParts(approx, timeZone);
            const targetWallMs = Date.UTC(
                Number(p.year),
                Number(p.month) - 1,
                Number(p.day),
                Number(p.hour) % 24,
                Number(p.minute),
                Number(p.second)
            );
            const approxMs = approx.getTime();
            const offsetMs = targetWallMs - approxMs;
            const desiredWallMs = Date.UTC(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hour),
                Number(minute),
                Number(second)
            );
            return new Date(desiredWallMs - offsetMs);
        };

        const startParts = getZonedParts(startDate, targetTimeZone);
        const dayOfWeek = WEEKDAYS[startParts.weekday];
        const daySchedule = (workerProfile.availability || []).find((s) => s.day === dayOfWeek);

        if (daySchedule && !daySchedule.isWorking) {
            const error = new Error('Worker does not work on the selected day of the week.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_TIME_SLOT_UNAVAILABLE';
            throw error;
        }

        if (daySchedule && daySchedule.start && daySchedule.end) {
            const [startHour, startMin] = daySchedule.start.split(':').map(Number);
            const [endHour, endMin] = daySchedule.end.split(':').map(Number);

            const year = Number(startParts.year);
            const month = Number(startParts.month);
            const day = Number(startParts.day);

            const workStartUtc = getUtcDateForZoneTime(year, month, day, startHour, startMin, 0, targetTimeZone);
            const workEndUtc = getUtcDateForZoneTime(year, month, day, endHour, endMin, 0, targetTimeZone);

            if (startDate.getTime() < workStartUtc.getTime() || endDate.getTime() > workEndUtc.getTime()) {
                const error = new Error(`Worker operates between ${daySchedule.start} and ${daySchedule.end}.`);
                error.statusCode = 409;
                error.errorCode = 'WORKER_TIME_SLOT_UNAVAILABLE';
                throw error;
            }
        }

        // 6. Leave Dates Check (Timezone-Aware)
        const startDateStr = `${startParts.year}-${startParts.month}-${startParts.day}`;
        const hasLeave = (workerProfile.leaveDates || []).some((ld) => {
            const leaveParts = getZonedParts(new Date(ld), targetTimeZone);
            const leaveStr = `${leaveParts.year}-${leaveParts.month}-${leaveParts.day}`;
            return leaveStr === startDateStr;
        });

        if (hasLeave) {
            const error = new Error('Worker is on leave on the selected date.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_TIME_SLOT_UNAVAILABLE';
            throw error;
        }

        // 7. Blocked Ranges Check
        const isBlocked = (workerProfile.blockedRanges || []).some((br) => {
            const bStart = new Date(br.start).getTime();
            const bEnd = new Date(br.end).getTime();
            return startDate.getTime() < bEnd && endDate.getTime() > bStart;
        });

        if (isBlocked) {
            const error = new Error('Worker has blocked the selected time slot.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_TIME_SLOT_UNAVAILABLE';
            throw error;
        }

        // 8. Double-Booking Overlap Detection (with buffer time)
        const bufferMs = (workerProfile.bufferMinutes || 30) * 60 * 1000;
        const bufferedStart = new Date(startDate.getTime() - bufferMs);
        const bufferedEnd = new Date(endDate.getTime() + bufferMs);

        const overlappingBooking = await Booking.findOne({
            workerId,
            bookingStatus: { $nin: ['CANCELLED', 'REJECTED', 'REFUNDED'] },
            $or: [
                {
                    scheduledStart: { $lt: bufferedEnd },
                    scheduledEnd: { $gt: bufferedStart },
                },
            ],
        });

        if (overlappingBooking) {
            const error = new Error('Selected time slot conflicts with an existing booking or buffer window.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_TIME_SLOT_UNAVAILABLE';
            throw error;
        }

        return {
            available: true,
            workerProfile,
            durationMinutes,
            bufferMinutes: workerProfile.bufferMinutes || 30,
        };
    }
}

export default AvailabilityService;
