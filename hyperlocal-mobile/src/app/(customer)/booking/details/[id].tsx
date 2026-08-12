import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../../../components/Header';
import Badge from '../../../../components/Badge';
import Button from '../../../../components/Button';
import ProfileAvatar from '../../../../components/ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../../config/api';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetails = async () => {
    try {
      const res = await api.get(`/bookings/${id}`);
      setBooking(res.data?.booking || res.data);
    } catch (err) {
      console.error('Failed to load booking details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const handleCancelBooking = async () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.post(`/bookings/${id}/cancel`);
            fetchDetails();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel booking.');
          } finally {
            setCancelling(false);
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Booking Details" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Booking Details" showBack />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Booking details not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canCancel = ['PENDING', 'ASSIGNED', 'CONFIRMED'].includes(booking.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Booking Details" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.bookingIdText}>Booking #{String(booking._id).substring(0, 8)}</Text>
          <View style={styles.statusBadgeRow}>
            <Badge status={booking.status} />
          </View>
          <Text style={styles.dateText}>
            Scheduled for {new Date(booking.bookingDate || Date.now()).toLocaleDateString()} at {booking.startTime || '10:00 AM'}
          </Text>
        </View>

        {/* Assigned Worker */}
        {booking.workerId || booking.worker ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Assigned Professional</Text>
            <View style={styles.workerRow}>
              <ProfileAvatar user={booking.workerId || booking.worker} size="lg" showBadge />
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>
                  {booking.workerId?.name || booking.worker?.name || 'Assigned Worker'}
                </Text>
                <Text style={styles.workerPhone}>
                  {booking.workerId?.phone || booking.worker?.phone || 'Contact via platform'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Service Address */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={20} color="#EA580C" style={{ marginTop: 2 }} />
            <Text style={styles.addressText}>
              {booking.address || 'Address registered for service delivery'}
            </Text>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Duration</Text>
            <Text style={styles.priceVal}>{booking.durationHours || 2} hours</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Status</Text>
            <Text style={styles.priceVal}>{booking.paymentStatus || 'PENDING'}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>₹{booking.totalAmount || booking.estimatedPrice || 500}</Text>
          </View>
        </View>

        {canCancel ? (
          <Button
            title="Cancel Booking"
            variant="danger"
            onPress={handleCancelBooking}
            loading={cancelling}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </ScrollView>
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
  errorText: {
    fontSize: 14,
    color: '#64748B'
  },
  scrollContent: {
    padding: 16
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  bookingIdText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600'
  },
  statusBadgeRow: {
    marginVertical: 10
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center'
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  workerInfo: {
    marginLeft: 12
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  workerPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    marginLeft: 8,
    lineHeight: 20
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748B'
  },
  priceVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
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
  }
});
