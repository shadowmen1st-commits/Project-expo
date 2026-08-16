import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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
import { colors, spacing, typography, radius, shadows } from '../../../theme';
import { getCanonicalWorkerId, isValidObjectId, normalizeWorkerData } from '../../../utils/workerUtils';
import { resolveWorkerImage } from '../../../utils/imageUtils';

export default function CreateBookingScreen() {
  const { workerId } = useLocalSearchParams();
  const router = useRouter();

  const rawWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;
  const canonicalParamId = getCanonicalWorkerId(rawWorkerId);

  const [worker, setWorker] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('10:00 AM');
  const [duration, setDuration] = useState<number>(2);

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
        // Fallback search
      } finally {
        setLoadingWorker(false);
      }
    };

    initData();
  }, [canonicalParamId]);

  const normalized = normalizeWorkerData(worker);
  const hourlyRate = normalized?.hourlyRate || 499;
  const basePrice = hourlyRate * duration;
  const platformFee = 49;
  const estimatedTotal = basePrice + platformFee;

  const handleConfirmBooking = async () => {
    if (submitting) return;

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
        effectiveCatId = '6a7ad5fca58da46031b0a23c'; // fallback valid 24-char ObjectId
      }
    }

    // 4. Date & Time parsing to ISO-8601
    let hour = 10;
    let min = 0;
    const timeMatch = startTime.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10) || 10;
      min = parseInt(timeMatch[2], 10) || 0;
      const meridiem = (timeMatch[3] || '').toUpperCase();
      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;
    }

    const startDate = new Date(date || defaultDate);
    startDate.setHours(hour, min, 0, 0);
    const endDate = new Date(startDate.getTime() + (duration || 2) * 60 * 60 * 1000);

    const fullAddress = `${houseNo.trim()}, ${street.trim()}${
      landmark.trim() ? ', ' + landmark.trim() : ''
    }, ${city.trim()}, Karnataka - ${pincode.trim()}`;

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        workerId: String(effectiveWorkerId),
        serviceCategoryId: String(effectiveCatId),
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endDate.toISOString(),
        pricingType: 'HOURLY',
        serviceAddress: fullAddress,
        addressSnapshot: {
          houseNumber: houseNo.trim(),
          street: street.trim(),
          locality: landmark.trim() || street.trim(),
          city: city.trim() || 'Bengaluru',
          state: 'Karnataka',
          pincode: pincode.trim(),
          addressType,
          instructions: instructions.trim() || undefined,
        },
        customerNotes: instructions.trim() || 'Jobnest Mobile Service Request',
      };

      const res = await api.post('/bookings', payload);
      router.replace('/(customer)/bookings');
    } catch (err: any) {
      const validationList = err.response?.data?.validationDetails;
      let msg = '';
      if (Array.isArray(validationList) && validationList.length > 0) {
        msg = validationList.map((v: any) => v.issue || v.message || v.field).join('. ');
      } else {
        msg = err.response?.data?.message || err.message || 'Failed to create booking. Please try again.';
      }
      setErrorMsg(msg);
    } finally {
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
                  onChangeText={setDate}
                  icon="calendar-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Start Time"
                  placeholder="e.g. 10:00 AM"
                  value={startTime}
                  onChangeText={setStartTime}
                  icon="time-outline"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Estimated Duration</Text>
            <View style={styles.durationSelector}>
              {[1, 2, 3, 4, 6].map((hrs) => (
                <TouchableOpacity
                  key={hrs}
                  style={[styles.durationChip, duration === hrs && styles.durationChipActive]}
                  onPress={() => setDuration(hrs)}
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
            <Text style={styles.sectionTitle}>3. Service Address</Text>

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
          disabled={submitting}
          onPress={handleConfirmBooking}
          fullWidth={false}
          style={styles.confirmButton}
        />
      </View>
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
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
});
