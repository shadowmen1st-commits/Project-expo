/**
 * Deterministic formatters for Hyperlocal Booking Platform
 */

export function formatBookingDateIST(value) {
    if (!value) return 'Date unavailable';

    // 1. If date-only string in YYYY-MM-DD format
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (dateOnlyMatch) {
            const [, yyyy, mm, dd] = dateOnlyMatch;
            return `${dd}/${mm}/${yyyy}`;
        }
    }

    // 2. Convert ISO timestamp or Date object
    const dateObj = value instanceof Date ? value : new Date(value);
    if (isNaN(dateObj.getTime())) {
        return 'Date unavailable';
    }

    // 3. Format strictly in Asia/Kolkata (+05:30) timezone
    try {
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(dateObj);
    } catch {
        const utcMs = dateObj.getTime();
        const istMs = utcMs + 5.5 * 60 * 60 * 1000;
        const istDate = new Date(istMs);
        const dd = String(istDate.getUTCDate()).padStart(2, '0');
        const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = istDate.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
}

export function formatBookingAmount(b) {
    if (b === null || b === undefined) return '0';

    if (typeof b === 'number' || typeof b === 'string') {
        const num = Number(b);
        if (isNaN(num)) return '0';
        if (Number.isInteger(num) && num >= 1000 && (num % 100 === 0 || num > 2000)) {
            const r = num / 100;
            return Number.isInteger(r) ? String(r) : r.toFixed(2);
        }
        return Number.isInteger(num) ? String(num) : num.toFixed(2);
    }

    const paiseVal =
        b.totalAmountPaise ??
        b.amountPaise ??
        b.pricingSnapshot?.customerTotalPaise ??
        b.pricingSnapshot?.rawServiceAmountPaise;

    if (typeof paiseVal === 'number' && paiseVal > 0) {
        const rupees = paiseVal / 100;
        return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
    }

    const raw = b.totalAmount ?? b.amount ?? b.price;
    if (typeof raw !== 'number' || isNaN(raw)) return '0';

    if (Number.isInteger(raw) && raw >= 1000 && (raw % 100 === 0 || raw > 2000)) {
        const rupees = raw / 100;
        return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
    }

    return Number.isInteger(raw) ? String(raw) : raw.toFixed(2);
}

export const TRACKABLE_BOOKING_STATUSES = [
    'PAID',
    'CONFIRMED',
    'ASSIGNED',
    'ACCEPTED',
    'WORKER_EN_ROUTE',
    'EN_ROUTE',
    'ARRIVED',
    'STARTED',
    'IN_PROGRESS',
];

export const TERMINAL_BOOKING_STATUSES = [
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
];

export function normalizeBookingStatus(status) {
    return String(status || '').trim().toUpperCase();
}

export function isTrackableBookingStatus(status) {
    const normalized = normalizeBookingStatus(status);
    return (
        TRACKABLE_BOOKING_STATUSES.includes(normalized) &&
        !TERMINAL_BOOKING_STATUSES.includes(normalized)
    );
}

export function resolveBookingId(b) {
    if (!b) return '';
    const raw = b.id ?? b._id ?? b.bookingId;
    return String(raw || '').trim();
}

export function formatBookingDateTimeIST(value, timeFallback) {
    if (!value && !timeFallback) return 'Schedule unavailable';
    const datePart = formatBookingDateIST(value);
    
    if (timeFallback) {
        return `${datePart} • ${timeFallback}`;
    }

    if (value) {
        const dateObj = value instanceof Date ? value : new Date(value);
        if (!isNaN(dateObj.getTime())) {
            try {
                const timePart = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                }).format(dateObj);
                return `${datePart} • ${timePart}`;
            } catch {
                return datePart;
            }
        }
    }

    return datePart;
}
