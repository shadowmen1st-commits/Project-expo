import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MobileHeader } from '../../../components/MobileHeader';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { WorkerAvatar } from '../../../components/WorkerAvatar';
import { CategorySelector } from '../../../components/CategorySelector';
import { LoadingState } from '../../../components/LoadingState';
import { EmptyState } from '../../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../hooks/useLocation';
import { colors, spacing, typography, radius, shadows } from '../../../theme';
import { getCanonicalWorkerId, isValidObjectId, normalizeWorkerData } from '../../../utils/workerUtils';
import { resolveWorkerImage } from '../../../utils/imageUtils';

export interface SlotAvailability {
  time: string; // e.g. "11:30 AM"
  startIso: string;
  endIso: string;
  available: boolean;
  reason?: string;
  isPast?: boolean;
}

/**
 * Deterministic conversion of a date string (YYYY-MM-DD) and a time string (e.g. "11:30 AM")
 * in Asia/Kolkata (+05:30) timezone into an ISO-8601 UTC string.
 */
export function formatToISTIsoString(dateStr: string, timeStr: string): string {
  let hours = 10;
  let minutes = 0;
  const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
  if (match) {
    hours = parseInt(match[1], 10) || 10;
    minutes = parseInt(match[2], 10) || 0;
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed month
  const day = parseInt(dayStr, 10);

  // IST offset is UTC+5:30 (+330 minutes)
  const totalUTCMinutes = hours * 60 + minutes - 330;
  const utcDate = new Date(Date.UTC(year, month, day, 0, totalUTCMinutes, 0, 0));
  return utcDate.toISOString();
}

/**
 * Calculates end ISO string from start ISO and duration in hours.
 */
export function calculateScheduledEndIso(startIso: string, durationHours: number): string {
  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  return endDate.toISOString();
}

/**
 * Formats a Date/ISO into 12-hour AM/PM in IST.
 */
export function formatTimeInIST(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Checks if a slot on a given date is in the past relative to current IST time.
 */
export function isSlotPassedInIST(dateStr: string, timeStr: string): boolean {
  try {
    const now = Date.now();
    const slotUtcMs = new Date(formatToISTIsoString(dateStr, timeStr)).getTime();
    return slotUtcMs <= now + 60000; // 1 min buffer
  } catch {
    return false;
  }
}

/**
 * Helper to generate 30-minute interval time slots between opening and closing hours (08:00 AM to 08:00 PM)
 */
export function generateCandidateTimeSlots(openingHour = 8, closingHour = 20, intervalMinutes = 30): string[] {
  const slots: string[] = [];
  let totalMinutes = openingHour * 60;
  const endMinutes = closingHour * 60;

  while (totalMinutes <= endMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = mins < 10 ? `0${mins}` : `${mins}`;
    slots.push(`${displayHour < 10 ? '0' : ''}${displayHour}:${displayMinutes} ${meridiem}`);
    totalMinutes += intervalMinutes;
  }
  return slots;
}

export default function CreateBookingScreen() {
  const { workerId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { location: customerLocation, loading: locationLoading, requestLocation } = useLocation(true);

  const rawWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;
  const canonicalParamId = getCanonicalWorkerId(rawWorkerId);

  const [worker, setWorker] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');

  // Default to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('10:00 AM');
  const [duration, setDuration] = useState<number>(2);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Dynamic Availability State
  const [slotAvailabilities, setSlotAvailabilities] = useState<SlotAvailability[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState('');

  // Address State
  const [houseNo, setHouseNo] = useState('142');
  const [street, setStreet] = useState('12th Main Road, HAL 2nd Stage');
  const [landmark, setLandmark] = useState('Near Metro Station');
  const [city, setCity] = useState('Bengaluru');
  const [pincode, setPincode] = useState('560038');
  const [instructions, setInstructions] = useState('');
  const [addressType, setAddressType] = useState<'HOME' | 'OFFICE' | 'OTHER'>('HOME');

  const [loadingWorker, setLoadingWorker] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hasNavigatedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // 1. Load Worker Profile and Service Categories
  useEffect(() => {
    const initData = async () => {
      if (!canonicalParamId || !isValidObjectId(canonicalParamId)) {
        setErrorMsg('Invalid worker ID. Please select a verified professional from the home screen.');
        setLoadingWorker(false);
        return;
      }

      try {
        const [wRes, cRes] = await Promise.allSettled([
          api.get(`/workers/profile/${canonicalParamId}`).catch(() => api.get(`/workers/${canonicalParamId}`)),
          api.get('/categories'),
        ]);

        if (wRes.status === 'fulfilled' && wRes.value.data) {
          const wData = wRes.value.data.data || wRes.value.data.worker || wRes.value.data;
          setWorker(wData);
          const catId = wData.serviceCategoryIds?.[0] || wData.primaryServiceCategoryId;
          if (catId) {
            setSelectedCategoryId(String(catId));
          }
          if (wData.primaryCategoryName || wData.categoryName) {
            setSelectedCategoryName(wData.primaryCategoryName || wData.categoryName);
          }
        }

        if (cRes.status === 'fulfilled' && cRes.value.data) {
          const cats = Array.isArray(cRes.value.data)
            ? cRes.value.data
            : cRes.value.data.categories || cRes.value.data.data || [];
          setCategories(cats);
          if (cats.length > 0) {
            setSelectedCategoryId((prev) => prev || String(cats[0]._id || cats[0].id));
            setSelectedCategoryName((prev) => prev || cats[0].name);
          }
        }
      } catch (err) {
        console.error('Error loading worker info:', err);
      } finally {
        setLoadingWorker(false);
      }
    };

    initData();
  }, [canonicalParamId]);

  // 2. Fetch Dynamic Slot Availability from Backend
  const checkSlotAvailability = useCallback(
    async (targetDate: string, targetDuration: number) => {
      const effectiveWorkerId = getCanonicalWorkerId(worker) || canonicalParamId;
      if (!effectiveWorkerId || !isValidObjectId(effectiveWorkerId) || !targetDate) return;

      const effectiveCatId =
        selectedCategoryId && isValidObjectId(selectedCategoryId)
          ? selectedCategoryId
          : categories.length > 0 && isValidObjectId(categories[0]._id || categories[0].id)
          ? String(categories[0]._id || categories[0].id)
          : '6a7a91e194884cf983721a9a';

      setCheckingAvailability(true);
      setAvailabilityWarning('');

      try {
        const rawSlots = generateCandidateTimeSlots(8, 20, 30);
        const slotChecks: SlotAvailability[] = [];

        // Evaluate candidate slots
        for (const slotStr of rawSlots) {
          const isPast = isSlotPassedInIST(targetDate, slotStr);
          const startIso = formatToISTIsoString(targetDate, slotStr);
          const endIso = calculateScheduledEndIso(startIso, targetDuration);

          if (isPast) {
            slotChecks.push({
              time: slotStr,
              startIso,
              endIso,
              available: false,
              isPast: true,
              reason: 'Time has already passed',
            });
            continue;
          }

          slotChecks.push({
            time: slotStr,
            startIso,
            endIso,
            available: true,
          });
        }

        // Query backend for non-past slots in parallel
        const checkedSlots = await Promise.all(
          slotChecks.map(async (slot) => {
            if (!slot.available) return slot;

            try {
              const res = await api.post('/bookings/availability/check', {
                workerId: String(effectiveWorkerId),
                serviceCategoryId: String(effectiveCatId),
                scheduledStart: slot.startIso,
                scheduledEnd: slot.endIso,
                pricingType: 'HOURLY',
              });

              const isAvail = res.data?.success && res.data?.available !== false;
              return {
                ...slot,
                available: isAvail,
                reason: isAvail ? undefined : res.data?.message || 'Slot unavailable',
              };
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Conflict with another booking or buffer';
              return {
                ...slot,
                available: false,
                reason: msg,
              };
            }
          })
        );

        setSlotAvailabilities(checkedSlots);

        // Verify if currently selected startTime is available
        const currentSlotObj = checkedSlots.find((s) => s.time === startTime);
        if (!currentSlotObj || !currentSlotObj.available) {
          const firstAvailable = checkedSlots.find((s) => s.available);
          if (firstAvailable) {
            setStartTime(firstAvailable.time);
            setAvailabilityWarning(
              `Previously selected time was unavailable. Switched to ${firstAvailable.time}.`
            );
          } else {
            setStartTime('');
            setAvailabilityWarning(
              `No available slots on ${targetDate} for ${targetDuration} hr(s). Please try another date or duration.`
            );
          }
        }
      } catch (err) {
        console.error('Availability scan error:', err);
      } finally {
        setCheckingAvailability(false);
      }
    },
    [worker, canonicalParamId, selectedCategoryId, categories, startTime]
  );

  // Trigger availability refresh on date, duration, category, or worker change
  useEffect(() => {
    if (canonicalParamId && date && duration) {
      checkSlotAvailability(date, duration);
    }
  }, [date, duration, canonicalParamId, selectedCategoryId]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setErrorMsg('');
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    setErrorMsg('');
  };

  const normalized = normalizeWorkerData(worker);
  const hourlyRate = normalized?.hourlyRate || 499;
  const basePrice = hourlyRate * duration;
  const platformFee = 49;
  const estimatedTotal = basePrice + platformFee;

  const handleConfirmBooking = async () => {
    if (submitting || isProcessingRef.current) return;

    // 1. Worker ID validation
    const effectiveWorkerId = getCanonicalWorkerId(worker) || canonicalParamId;
    if (!effectiveWorkerId || !isValidObjectId(effectiveWorkerId)) {
      setErrorMsg('Invalid worker ID. Please select a valid verified professional.');
      return;
    }

    // 2. Address validation
    if (!houseNo.trim()) {
      setErrorMsg('Please enter house / flat / building number.');
      return;
    }
    if (!street.trim()) {
      setErrorMsg('Please enter street or locality.');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('Please enter city.');
      return;
    }
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please enter a valid 6-digit PIN code.');
      return;
    }

    // 3. Category ID validation
    let effectiveCatId = selectedCategoryId;
    if (!effectiveCatId || !isValidObjectId(effectiveCatId)) {
      if (categories.length > 0 && isValidObjectId(categories[0]._id || categories[0].id)) {
        effectiveCatId = String(categories[0]._id || categories[0].id);
      } else {
        effectiveCatId = '6a7a91e194884cf983721a9a';
      }
    }

    // 4. Date & Time validation and parsing
    if (!date.trim()) {
      setErrorMsg('Please select a valid service date.');
      return;
    }
    if (!startTime.trim()) {
      setErrorMsg('Please select an available start time slot.');
      return;
    }
    if (isSlotPassedInIST(date, startTime)) {
      setErrorMsg('The selected start time has already passed. Please select a future time slot.');
      return;
    }

    // Convert to strict IST ISO strings
    const startIso = formatToISTIsoString(date, startTime);
    const endIso = calculateScheduledEndIso(startIso, duration || 2);

    const fullAddress = `${houseNo.trim()}, ${street.trim()}${
      landmark.trim() ? ', ' + landmark.trim() : ''
    }, ${city.trim()}, Karnataka - ${pincode.trim()}`;

    setErrorMsg('');
    setSubmitting(true);
    hasNavigatedRef.current = false;

    try {
      // 1. Create Booking on backend
      const payload = {
        workerId: String(effectiveWorkerId),
        serviceCategoryId: String(effectiveCatId),
        scheduledStart: startIso,
        scheduledEnd: endIso,
        bookingDate: date,
        bookingTime: startTime,
        pricingType: 'HOURLY',
        serviceAddress: fullAddress,
        addressSnapshot: {
          houseNumber: houseNo.trim(),
          street: street.trim(),
          locality: landmark.trim() || street.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim() || 'Bengaluru',
          state: 'Karnataka',
          pincode: pincode.trim(),
          addressType,
          instructions: instructions.trim() || undefined,
          ...(customerLocation?.latitude && customerLocation?.longitude
            ? {
                latitude: customerLocation.latitude,
                longitude: customerLocation.longitude,
              }
            : {}),
        },
        customerNotes: instructions.trim() || 'Jobnest Mobile Service Request',
      };

      const res = await api.post('/bookings', payload);
      const createdBooking = res.data?.booking || res.data;
      const bookingId =
        createdBooking?.id ??
        createdBooking?._id ??
        res.data?.id ??
        res.data?._id;

      if (!bookingId) {
        throw new Error('Booking was created, but server did not return a booking ID.');
      }

      console.log('[BOOKING_CREATED_SUCCESS]', {
        bookingId,
        bookingNumber: createdBooking?.bookingNumber,
        status: createdBooking?.bookingStatus || createdBooking?.status,
      });

      // Navigate directly to the dedicated Payment page for this booking
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.replace(`/(customer)/booking/payment/${bookingId}` as any);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const validationList = err.response?.data?.validationDetails;
      let msg = '';
      if (Array.isArray(validationList) && validationList.length > 0) {
        msg = validationList.map((v: any) => v.issue || v.message || v.field).join('. ');
      } else if (status === 409) {
        msg = 'Selected time slot overlaps with an existing booking or buffer window. Please choose another available time.';
      } else if (status === 400) {
        msg = err.response?.data?.message || 'Please check your booking details and try again.';
      } else {
        msg = err.response?.data?.message || err.message || 'Failed to create booking. Please try again.';
      }
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  if (loadingWorker) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Book Service" showBack />
        <LoadingState message="Loading professional and service details..." />
      </View>
    );
  }

  if (!canonicalParamId || !isValidObjectId(canonicalParamId)) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Book Service" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Invalid Worker"
          description="Please select a verified professional from the home screen."
          actionTitle="Back to Home"
          onAction={() => router.replace('/(customer)/dashboard')}
        />
      </View>
    );
  }

  const workerName = normalized?.name || 'Verified Professional';
  const profileImage = resolveWorkerImage(worker);
  const availableSlotsCount = slotAvailabilities.filter((s) => s.available).length;

  return (
    <View style={styles.container}>
      <MobileHeader title="Book Service" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Worker Summary Banner */}
          <View style={styles.workerCard}>
            <WorkerAvatar uri={profileImage} name={workerName} size="lg" isVerified />
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>{workerName}</Text>
              <Text style={styles.workerCategory}>{normalized?.categoryName || 'Home Specialist'}</Text>
              <View style={styles.workerMetaRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>{(normalized?.rating || 4.8).toFixed(1)}</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.rateText}>₹{hourlyRate}/hr</Text>
              </View>
            </View>
          </View>

          {/* Availability Notice / Warning Banner */}
          {availabilityWarning ? (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.infoText}>{availabilityWarning}</Text>
            </View>
          ) : null}

          {/* Validation Error Banner */}
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Service Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Select Service Category</Text>
            <CategorySelector
              categoriesList={categories}
              selectedCategoryId={selectedCategoryId}
              selectedCategoryName={selectedCategoryName}
              onSelect={(cat) => {
                setSelectedCategoryId(String(cat._id || cat.id));
                setSelectedCategoryName(cat.name);
              }}
            />
          </View>

          {/* Schedule Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Schedule Date & Time</Text>
            <View style={styles.dateTimeGrid}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={handleDateChange}
                  icon="calendar-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <TouchableOpacity
                  style={[
                    styles.timeDropdownButton,
                    checkingAvailability && styles.timeDropdownDisabled,
                  ]}
                  onPress={() => setShowTimeModal(true)}
                  activeOpacity={0.7}
                  disabled={checkingAvailability}
                >
                  <View style={styles.timeDropdownContent}>
                    {checkingAvailability ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={startTime ? colors.accent : colors.textMuted}
                      />
                    )}
                    <Text
                      style={[
                        styles.timeDropdownText,
                        !startTime && styles.timeDropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {checkingAvailability
                        ? 'Checking...'
                        : startTime || 'Select Time'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.slotSummaryRow}>
              <Text style={styles.slotCountText}>
                {checkingAvailability
                  ? 'Verifying slot availability...'
                  : `${availableSlotsCount} slot(s) available for ${date}`}
              </Text>
              {availableSlotsCount === 0 && !checkingAvailability && (
                <TouchableOpacity
                  onPress={() => {
                    const nextDay = new Date(date);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setDate(nextDay.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.nextDayText}>Try Next Day →</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Estimated Duration</Text>
            <View style={styles.durationSelector}>
              {[1, 2, 3, 4, 6].map((hrs) => (
                <TouchableOpacity
                  key={hrs}
                  style={[styles.durationChip, duration === hrs && styles.durationChipActive]}
                  onPress={() => handleDurationChange(hrs)}
                >
                  <Text style={[styles.durationChipText, duration === hrs && styles.durationChipTextActive]}>
                    {hrs} {hrs === 1 ? 'hr' : 'hrs'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Address Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>3. Service Address</Text>
              <TouchableOpacity
                style={styles.gpsButton}
                onPress={() => requestLocation({ forceHighAccuracy: true, promptIfDenied: true })}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={customerLocation ? 'location' : 'location-outline'}
                  size={13}
                  color={customerLocation ? colors.success : colors.accent}
                />
                <Text style={[styles.gpsButtonText, customerLocation && { color: colors.success }]}>
                  {locationLoading ? 'Detecting GPS...' : customerLocation ? 'GPS Captured' : 'Detect GPS'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressTypeRow}>
              {(['HOME', 'OFFICE', 'OTHER'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, addressType === type && styles.typeChipActive]}
                  onPress={() => setAddressType(type)}
                >
                  <Ionicons
                    name={type === 'HOME' ? 'home-outline' : type === 'OFFICE' ? 'business-outline' : 'location-outline'}
                    size={14}
                    color={addressType === type ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.typeChipText, addressType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.addressGrid}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Flat / House No *"
                  placeholder="e.g. 142"
                  value={houseNo}
                  onChangeText={setHouseNo}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <AppInput
                  label="Street / Area *"
                  placeholder="e.g. 12th Main Road"
                  value={street}
                  onChangeText={setStreet}
                />
              </View>
            </View>

            <AppInput
              label="Landmark (Optional)"
              placeholder="e.g. Near Indiranagar Metro Station"
              value={landmark}
              onChangeText={setLandmark}
            />

            <View style={styles.addressGrid}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="City *"
                  placeholder="Bengaluru"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Pincode (6 digits) *"
                  placeholder="560038"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            <AppInput
              label="Instructions / Special Notes"
              placeholder="e.g. Please bring extra copper pipe and check compressor"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Pricing Breakdown */}
          <View style={styles.pricingCard}>
            <Text style={styles.pricingCardTitle}>Payment & Price Summary</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Base Service ({duration} hrs @ ₹{hourlyRate}/hr)</Text>
              <Text style={styles.priceValue}>₹{basePrice}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Platform & Safety Fee</Text>
              <Text style={styles.priceValue}>₹{platformFee}</Text>
            </View>

            <View style={styles.priceDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Total</Text>
              <Text style={styles.totalValue}>₹{estimatedTotal}</Text>
            </View>
            <Text style={styles.priceHint}>
              Pay securely via UPI / Card or Cash upon service completion.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Action Footer */}
      <View style={styles.footerBar}>
        <View style={styles.footerPriceColumn}>
          <Text style={styles.footerPriceLabel}>Total Amount</Text>
          <Text style={styles.footerPriceValue}>₹{estimatedTotal}</Text>
        </View>

        <AppButton
          title={submitting ? 'Confirming...' : 'Confirm Booking'}
          variant="primary"
          icon="checkmark-circle-outline"
          loading={submitting}
          disabled={submitting || checkingAvailability}
          onPress={handleConfirmBooking}
          fullWidth={false}
          style={styles.confirmButton}
        />
      </View>

      {/* Time Slot Picker Modal with Dynamic Availability */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowTimeModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="time" size={20} color={colors.accent} />
                <Text style={styles.modalTitle}>Select Start Time</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTimeModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Showing verified slots for {date} • {duration} hr duration
            </Text>

            {slotAvailabilities.length === 0 ? (
              <View style={styles.emptySlotsContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.emptySlotsText}>Scanning professional schedule...</Text>
              </View>
            ) : availableSlotsCount === 0 ? (
              <View style={styles.emptySlotsContainer}>
                <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                <Text style={styles.noSlotsTitle}>No Available Slots</Text>
                <Text style={styles.emptySlotsText}>
                  All slots on {date} are booked or outside working hours for a {duration}-hour session.
                </Text>
                <TouchableOpacity
                  style={styles.changeDateBtn}
                  onPress={() => {
                    const nextDay = new Date(date);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setDate(nextDay.toISOString().split('T')[0]);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.changeDateBtnText}>Try Next Day</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.slotList}
                contentContainerStyle={styles.slotGrid}
                showsVerticalScrollIndicator={false}
              >
                {slotAvailabilities.map((slot) => {
                  const isSelected = startTime === slot.time;
                  const isAvailable = slot.available;

                  return (
                    <TouchableOpacity
                      key={slot.time}
                      disabled={!isAvailable}
                      style={[
                        styles.slotCard,
                        isSelected && styles.slotCardSelected,
                        !isAvailable && styles.slotCardDisabled,
                      ]}
                      onPress={() => {
                        setStartTime(slot.time);
                        setErrorMsg('');
                        setAvailabilityWarning('');
                        setShowTimeModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.slotCardHeader}>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : isAvailable ? 'time-outline' : 'close-circle'}
                          size={15}
                          color={
                            isSelected
                              ? '#FFFFFF'
                              : isAvailable
                              ? colors.accent
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.slotText,
                            isSelected && styles.slotTextSelected,
                            !isAvailable && styles.slotTextDisabled,
                          ]}
                        >
                          {slot.time}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.slotStatusTag,
                          isSelected && styles.slotStatusTagSelected,
                          !isAvailable && styles.slotStatusTagDisabled,
                        ]}
                      >
                        {slot.isPast ? 'Past' : isAvailable ? 'Available' : 'Booked'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 4,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  workerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  workerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  workerCategory: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  workerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#D97706',
  },
  dot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  rateText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.xs,
    color: '#1D4ED8',
    flex: 1,
    fontWeight: typography.weights.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: '#B91C1C',
    flex: 1,
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  gpsButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
  },
  dateTimeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  slotSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  slotCountText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  nextDayText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  durationSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  durationChipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  durationChipTextActive: {
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  typeChipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  addressGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pricingCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  pricingCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  priceDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  priceHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.lg,
  },
  footerPriceColumn: {
    flex: 1,
  },
  footerPriceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  footerPriceValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  confirmButton: {
    flex: 1.4,
  },
  timeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  timeDropdownDisabled: {
    opacity: 0.6,
  },
  timeDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  timeDropdownText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  timeDropdownPlaceholder: {
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '75%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  slotList: {
    maxHeight: 380,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  slotCard: {
    width: '48%',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  slotCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotCardSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  slotCardDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.55,
  },
  slotText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  slotTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  slotTextDisabled: {
    color: colors.textMuted,
  },
  slotStatusTag: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  slotStatusTagSelected: {
    color: '#FFFFFF',
  },
  slotStatusTagDisabled: {
    color: '#94A3B8',
  },
  emptySlotsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  noSlotsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptySlotsText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  changeDateBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  changeDateBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
