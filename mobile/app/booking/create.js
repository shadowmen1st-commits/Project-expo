import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  ChevronRight,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
  '06:00 PM - 08:00 PM',
];

const PLATFORM_FEE = 49;

export default function BookingCreationScreen() {
  const { workerId } = useLocalSearchParams();
  const [worker, setWorker] = useState(null);
  const [loadingWorker, setLoadingWorker] = useState(true);

  // Form State
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [durationHours, setDurationHours] = useState(2);
  const [address, setAddress] = useState('Flat 402, Sunshine Heights, Andheri West, Mumbai 400053');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Next 7 Days Date Strip
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      fullDate: d.toISOString().split('T')[0],
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  useEffect(() => {
    fetchWorkerInfo();
  }, [workerId]);

  const fetchWorkerInfo = async () => {
    try {
      setLoadingWorker(true);
      if (workerId) {
        const res = await api.get(`/workers/profile/${workerId}`);
        if (res.data?.worker) {
          setWorker(res.data.worker);
          return;
        }
      }
    } catch (e) {
      console.log('Error loading worker for booking:', e);
    } finally {
      setLoadingWorker(false);
    }

    // Default Fallback Worker
    setWorker({
      _id: workerId || 'w101',
      name: 'Rajesh Kumar',
      skill: 'Master Plumber',
      hourlyRate: 499,
      rating: 4.9,
    });
  };

  const hourlyRate = worker?.hourlyRate || 499;
  const subtotal = hourlyRate * durationHours;
  const totalPrice = subtotal + PLATFORM_FEE;

  const handleConfirmBooking = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your service address.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        workerId: worker?._id || workerId,
        serviceType: worker?.skill || 'General Service',
        scheduledDate: dates[selectedDateIndex].fullDate,
        timeSlot: selectedTimeSlot,
        durationHours: durationHours,
        address: address,
        notes: notes,
        totalAmount: totalPrice,
        platformFee: PLATFORM_FEE,
      };

      const res = await api.post('/bookings/create', payload);

      if (res.data?.booking?._id) {
        router.replace(`/booking/${res.data.booking._id}`);
      } else {
        // Fallback demo booking ID
        const fakeId = 'b_' + Math.random().toString(36).substring(2, 9);
        router.replace(`/booking/${fakeId}`);
      }
    } catch (err) {
      console.log('Error creating booking:', err);
      // Fallback redirection for local dev testing
      const fakeId = 'b_' + Math.random().toString(36).substring(2, 9);
      router.replace(`/booking/${fakeId}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingWorker) {
    return (
      <SafeAreaView style={styles.loadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Preparing booking details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Worker Summary Banner */}
        <View style={styles.workerSummaryCard}>
          <View style={styles.workerAvatar}>
            <Text style={styles.avatarText}>{worker?.name?.charAt(0) || 'W'}</Text>
          </View>
          <View style={styles.workerMeta}>
            <Text style={styles.workerName}>{worker?.name}</Text>
            <Text style={styles.workerSkill}>{worker?.skill}</Text>
            <Text style={styles.workerRate}>₹{hourlyRate} / hour</Text>
          </View>
        </View>

        {/* 1. Date Selection Strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Service Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesScroll}
          >
            {dates.map((item, idx) => {
              const isSelected = selectedDateIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dateCard, isSelected && styles.dateCardActive]}
                  onPress={() => setSelectedDateIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayName, isSelected && styles.dateTextActive]}>
                    {item.dayName}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dateTextActive]}>
                    {item.dayNumber}
                  </Text>
                  <Text style={[styles.monthName, isSelected && styles.dateTextActive]}>
                    {item.monthName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Time Slot Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Select Arrival Time Slot</Text>
          <View style={styles.slotsGrid}>
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedTimeSlot === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotPill, isSelected && styles.slotPillActive]}
                  onPress={() => setSelectedTimeSlot(slot)}
                  activeOpacity={0.8}
                >
                  <Clock size={14} color={isSelected ? '#FFFFFF' : Colors.textMuted} />
                  <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Duration Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Estimated Duration</Text>
          <View style={styles.durationRow}>
            {[1, 2, 3, 4].map((hrs) => {
              const isSelected = durationHours === hrs;
              return (
                <TouchableOpacity
                  key={hrs}
                  style={[styles.durationCard, isSelected && styles.durationCardActive]}
                  onPress={() => setDurationHours(hrs)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.durationNum, isSelected && styles.durationTextActive]}>
                    {hrs} Hr{hrs > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Address Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Service Location Address</Text>
          <View style={styles.addressBox}>
            <MapPin size={20} color={Colors.primary} style={{ marginTop: 2 }} />
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter full address..."
              placeholderTextColor={Colors.textDim}
              multiline
            />
          </View>
        </View>

        {/* 5. Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Instructions for Worker (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Please bring extra 1/2 inch pipe fittings..."
            placeholderTextColor={Colors.textDim}
          />
        </View>

        {/* Price Breakdown Card */}
        <View style={styles.priceBreakdownCard}>
          <Text style={styles.breakdownTitle}>Price Details</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Hourly Service Fee (₹{hourlyRate} × {durationHours} hrs)
            </Text>
            <Text style={styles.priceVal}>₹{subtotal}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Convenience Fee</Text>
            <Text style={styles.priceVal}>₹{PLATFORM_FEE}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable Amount</Text>
            <Text style={styles.totalValue}>₹{totalPrice}</Text>
          </View>
        </View>

        {/* Guarantee Badge */}
        <View style={styles.guaranteeBox}>
          <ShieldCheck size={20} color="#16A34A" />
          <Text style={styles.guaranteeText}>
            HyperLocal Safety Guarantee • 100% Verified Service
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalVal}>₹{totalPrice}</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirmBooking}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.confirmBtnText}>Confirm Booking</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingBox: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
  },
  workerSummaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  workerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  workerMeta: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  workerSkill: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  workerRate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  datesScroll: {
    gap: Spacing.sm,
  },
  dateCard: {
    width: 64,
    height: 74,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  dateCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayName: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  monthName: {
    fontSize: 10,
    color: Colors.textDim,
  },
  dateTextActive: {
    color: '#FFFFFF',
  },
  slotsGrid: {
    gap: Spacing.sm,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  slotTextActive: {
    color: '#FFFFFF',
  },
  durationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  durationCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  durationCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  durationNum: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
  },
  priceBreakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  priceVal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#DCFCE7',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  guaranteeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomTotalLabel: {
    fontSize: 12,
    color: Colors.textDim,
  },
  bottomTotalVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
