import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../../components/Header';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../config/api';

export default function CreateBookingScreen() {
  const { workerId } = useLocalSearchParams();
  const router = useRouter();

  const [worker, setWorker] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Booking Parameters
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('10:00 AM');
  const [duration, setDuration] = useState<number>(2);

  // Address Fields
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [addressType, setAddressType] = useState<'HOME' | 'OFFICE' | 'OTHER'>('HOME');

  const [loadingWorker, setLoadingWorker] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const initData = async () => {
      try {
        const [wRes, cRes] = await Promise.allSettled([
          api.get(`/workers/${workerId}`),
          api.get('/categories')
        ]);

        if (wRes.status === 'fulfilled' && wRes.value.data) {
          const wData = wRes.value.data.worker || wRes.value.data;
          setWorker(wData);
          if (wData.primaryServiceCategoryId) {
            setSelectedCategory(wData.primaryServiceCategoryId);
          }
        }

        if (cRes.status === 'fulfilled' && cRes.value.data) {
          const cats = Array.isArray(cRes.value.data)
            ? cRes.value.data
            : cRes.value.data.categories || cRes.value.data.data || [];
          setCategories(cats);
          if (!selectedCategory && cats.length > 0) {
            setSelectedCategory(cats[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed loading booking initialization:', err);
      } finally {
        setLoadingWorker(false);
      }
    };

    if (workerId) initData();
  }, [workerId]);

  const hourlyRate = worker?.hourlyRate || 250;
  const estimatedTotal = hourlyRate * duration;

  const handleConfirmBooking = async () => {
    if (!houseNo.trim() || !street.trim() || !city.trim() || !pincode.trim()) {
      setErrorMsg('Please fill in all required address fields (House No, Street, City, Pincode).');
      return;
    }

    const fullAddress = `${houseNo.trim()}, ${street.trim()}, ${landmark.trim() ? landmark.trim() + ', ' : ''}${city.trim()} - ${pincode.trim()} (${addressType})`;

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        workerId,
        categoryId: selectedCategory || worker?.primaryServiceCategoryId,
        bookingDate: date,
        startTime,
        durationHours: duration,
        address: fullAddress,
        serviceAddress: {
          houseNo: houseNo.trim(),
          street: street.trim(),
          landmark: landmark.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          addressType
        }
      };

      const res = await api.post('/bookings/create', payload);

      const bookingId = res.data?.booking?._id || res.data?._id;
      if (bookingId) {
        router.replace(`/(customer)/booking/details/${bookingId}`);
      } else {
        router.replace('/(customer)/bookings');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create booking. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingWorker) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Book Service" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      </SafeAreaView>
    );
  }

  const workerName = worker?.name || worker?.fullName || 'Selected Professional';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Book Service" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Worker Info Banner */}
          <View style={styles.workerBanner}>
            <ProfileAvatar user={worker} size="lg" showBadge />
            <View style={styles.workerBannerText}>
              <Text style={styles.workerName}>{workerName}</Text>
              <Text style={styles.workerRate}>₹{hourlyRate} / hour</Text>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Section 1: Schedule & Duration */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Schedule & Duration</Text>

            <Input
              label="Date (YYYY-MM-DD) *"
              value={date}
              onChangeText={setDate}
              icon={<Ionicons name="calendar-outline" size={20} color="#64748B" />}
            />

            <Text style={styles.fieldLabel}>Start Time *</Text>
            <View style={styles.timeSlotsRow}>
              {['09:00 AM', '10:00 AM', '02:00 PM', '04:00 PM'].map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotChip, startTime === slot && styles.slotChipActive]}
                  onPress={() => setStartTime(slot)}
                >
                  <Text style={[styles.slotText, startTime === slot && styles.slotTextActive]}>
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
                >
                  <Text style={[styles.durationText, duration === h && styles.durationTextActive]}>
                    {h} {h === 1 ? 'hr' : 'hrs'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section 2: Address Information */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Service Address</Text>

            <View style={styles.addressTypeRow}>
              {(['HOME', 'OFFICE', 'OTHER'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, addressType === type && styles.typeChipActive]}
                  onPress={() => setAddressType(type)}
                >
                  <Text style={[styles.typeText, addressType === type && styles.typeTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Flat / House No. *"
              placeholder="e.g. B-204, Sunset Heights"
              value={houseNo}
              onChangeText={setHouseNo}
            />

            <Input
              label="Street / Locality *"
              placeholder="e.g. MG Road, Indiranagar"
              value={street}
              onChangeText={setStreet}
            />

            <Input
              label="Area / Landmark"
              placeholder="e.g. Near Metro Station"
              value={landmark}
              onChangeText={setLandmark}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="City *"
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="PIN Code *"
                  placeholder="e.g. 560038"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Section 3: Quote Summary */}
          <View style={styles.quoteCard}>
            <Text style={styles.sectionTitle}>Price Quote</Text>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Rate x Duration ({duration} hrs)</Text>
              <Text style={styles.quoteVal}>₹{hourlyRate} x {duration}</Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Taxes & Fees</Text>
              <Text style={styles.quoteVal}>₹0</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Total</Text>
              <Text style={styles.totalVal}>₹{estimatedTotal}</Text>
            </View>
          </View>

          <Button
            title={`Confirm Booking • ₹${estimatedTotal}`}
            onPress={handleConfirmBooking}
            loading={submitting}
            style={styles.confirmBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  workerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  workerBannerText: {
    marginLeft: 12
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  workerRate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EA580C',
    marginTop: 2
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
    marginBottom: 8
  },
  timeSlotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  slotChipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C'
  },
  slotText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600'
  },
  slotTextActive: {
    color: '#FFFFFF'
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  durationChipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C'
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  durationTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  typeChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A'
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  typeTextActive: {
    color: '#FFFFFF'
  },
  quoteCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginBottom: 20
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  quoteLabel: {
    fontSize: 13,
    color: '#64748B'
  },
  quoteVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA'
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EA580C'
  },
  confirmBtn: {
    marginBottom: 16
  }
});
