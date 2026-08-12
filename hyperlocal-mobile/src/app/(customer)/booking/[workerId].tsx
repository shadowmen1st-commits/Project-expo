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

export default function CreateBookingScreen() {
  const { workerId } = useLocalSearchParams();
  const router = useRouter();

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

  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [pincode, setPincode] = useState('560038');
  const [instructions, setInstructions] = useState('');
  const [addressType, setAddressType] = useState<'HOME' | 'OFFICE' | 'OTHER'>('HOME');

  const [loadingWorker, setLoadingWorker] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const initData = async () => {
      try {
        const [wRes, cRes] = await Promise.allSettled([
          api.get(`/workers/${workerId}`),
          api.get('/categories'),
        ]);

        if (wRes.status === 'fulfilled' && wRes.value.data) {
          const wData = wRes.value.data.worker || wRes.value.data;
          setWorker(wData);
          if (wData.primaryServiceCategoryId) {
            setSelectedCategoryId(wData.primaryServiceCategoryId);
          }
          if (wData.primaryCategoryName) {
            setSelectedCategoryName(wData.primaryCategoryName);
          }
        }

        if (cRes.status === 'fulfilled' && cRes.value.data) {
          const cats = Array.isArray(cRes.value.data)
            ? cRes.value.data
            : cRes.value.data.categories || cRes.value.data.data || [];
          setCategories(cats);
          if (!selectedCategoryId && cats.length > 0) {
            setSelectedCategoryId(cats[0]._id || cats[0].id);
            setSelectedCategoryName(cats[0].name);
          }
        }
      } catch (err) {
        // Ignore initialization error
      } finally {
        setLoadingWorker(false);
      }
    };

    if (workerId) initData();
  }, [workerId]);

  const hourlyRate =
    worker?.hourlyRate || worker?.pricePerHour || worker?.rate || (worker?.hourlyRatePaise ? worker.hourlyRatePaise / 100 : 300);

  const basePrice = hourlyRate * duration;
  const platformFee = 49;
  const estimatedTotal = basePrice + platformFee;

  const handleConfirmBooking = async () => {
    if (submitting) return; // Prevent double submission
    if (!houseNo.trim() || !street.trim() || !city.trim() || !pincode.trim()) {
      setErrorMsg('Please fill in all required address fields (House No, Street, City, Pincode).');
      return;
    }

    const fullAddress = `${houseNo.trim()}, ${street.trim()}, ${
      landmark.trim() ? landmark.trim() + ', ' : ''
    }${city.trim()} - ${pincode.trim()} (${addressType})`;

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        workerId,
        categoryId: selectedCategoryId || worker?.primaryServiceCategoryId,
        bookingDate: date,
        startTime,
        durationHours: duration,
        instructions: instructions.trim(),
        address: fullAddress,
        serviceAddress: {
          houseNo: houseNo.trim(),
          street: street.trim(),
          landmark: landmark.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          addressType,
        },
      };

      const res = await api.post('/bookings/create', payload);
      const bookingId = res.data?.booking?._id || res.data?._id;

      if (bookingId) {
        router.replace(`/(customer)/booking/details/${bookingId}`);
      } else {
        router.replace('/(customer)/bookings');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to create booking. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingWorker) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Booking" showBack />
        <LoadingState message="Loading worker and category information..." />
      </View>
    );
  }

  const workerName =
    worker?.fullName || worker?.name || worker?.user?.name || 'Selected Professional';
  const profileImage =
    worker?.profileImage || worker?.profilePhoto || worker?.profileImageUrl || worker?.user?.profileImage;

  return (
    <View style={styles.container}>
      <MobileHeader title="Booking" showBack />

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
              <Text style={styles.workerCategory}>{selectedCategoryName || 'Home Services'}</Text>
            </View>
            <View style={styles.workerPriceBox}>
              <Text style={styles.workerRate}>₹{hourlyRate}</Text>
              <Text style={styles.unitText}>/hr</Text>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Section 1: Service Category Selection */}
          <View style={styles.card}>
            <CategorySelector
              selectedCategoryId={selectedCategoryId}
              selectedCategoryName={selectedCategoryName}
              categoriesList={categories}
              onSelect={(cat) => {
                setSelectedCategoryId(cat.id || cat._id || '');
                setSelectedCategoryName(cat.name);
              }}
            />
          </View>

          {/* Section 2: Schedule & Duration */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Schedule & Duration</Text>

            <AppInput
              label="Date (YYYY-MM-DD) *"
              value={date}
              onChangeText={setDate}
              icon="calendar-outline"
            />

            <Text style={styles.fieldLabel}>Start Time *</Text>
            <View style={styles.chipsRow}>
              {['09:00 AM', '10:00 AM', '02:00 PM', '04:00 PM'].map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.chip, startTime === slot && styles.chipActive]}
                  onPress={() => setStartTime(slot)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, startTime === slot && styles.chipTextActive]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Duration (Hours) *</Text>
            <View style={styles.durationRow}>
              {[1, 2, 3, 4, 6].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.durationChip, duration === h && styles.durationChipActive]}
                  onPress={() => setDuration(h)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.durationText, duration === h && styles.durationTextActive]}>
                    {h} {h === 1 ? 'hr' : 'hrs'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section 3: Address Information */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Service Address</Text>

            <View style={styles.typeRow}>
              {(['HOME', 'OFFICE', 'OTHER'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, addressType === type && styles.typeChipActive]}
                  onPress={() => setAddressType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeText, addressType === type && styles.typeTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <AppInput
              label="Flat / House No. *"
              placeholder="e.g. B-204, Sunset Heights"
              value={houseNo}
              onChangeText={setHouseNo}
              icon="home-outline"
            />

            <AppInput
              label="Street / Locality *"
              placeholder="e.g. MG Road, Indiranagar"
              value={street}
              onChangeText={setStreet}
              icon="navigate-outline"
            />

            <AppInput
              label="Area / Landmark"
              placeholder="e.g. Near Metro Station"
              value={landmark}
              onChangeText={setLandmark}
              icon="location-outline"
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="City *"
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="PIN Code *"
                  placeholder="e.g. 560038"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <AppInput
              label="Special Instructions (Optional)"
              placeholder="e.g. Please bring extra ladder / call before arriving"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={3}
              icon="create-outline"
            />
          </View>

          {/* Price Summary Breakdown Card */}
          <View style={styles.quoteCard}>
            <Text style={styles.quoteTitle}>Price Breakdown</Text>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>
                Base Rate (₹{hourlyRate} × {duration} hrs)
              </Text>
              <Text style={styles.quoteVal}>₹{basePrice}</Text>
            </View>

            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Safety & Support Fee</Text>
              <Text style={styles.quoteVal}>₹{platformFee}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Total Amount</Text>
              <Text style={styles.totalVal}>₹{estimatedTotal}</Text>
            </View>
          </View>

          <AppButton
            title={`Check Availability & Review Quote • ₹${estimatedTotal}`}
            onPress={handleConfirmBooking}
            loading={submitting}
            variant="primary"
            size="lg"
            style={{ marginBottom: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.xxxl * 2,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  workerInfo: {
    flex: 1,
    marginLeft: spacing.md,
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
  workerPriceBox: {
    alignItems: 'flex-end',
  },
  workerRate: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  unitText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.error,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  durationChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  typeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  typeTextActive: {
    color: colors.textInverted,
  },
  quoteCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  quoteTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  quoteLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  quoteVal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.primary,
  },
  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  totalVal: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
});
