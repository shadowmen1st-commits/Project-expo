import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MobileHeader } from '../../../../components/MobileHeader';
import { AppButton } from '../../../../components/AppButton';
import { LoadingState } from '../../../../components/LoadingState';
import { EmptyState } from '../../../../components/EmptyState';
import { ProfileAvatar } from '../../../../components/ProfileAvatar';
import Badge from '../../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../../../theme';

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
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking request?', [
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
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Booking Details" showBack />
        <LoadingState message="Fetching booking details..." />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Booking Details" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Booking Not Found"
          description="The requested booking details could not be found."
          actionTitle="Back to Bookings"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const canCancel = ['PENDING', 'ASSIGNED', 'CONFIRMED'].includes(booking.status);

  return (
    <View style={styles.container}>
      <MobileHeader title="Booking Details" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Hero Card */}
        <View style={styles.statusCard}>
          <Text style={styles.bookingIdText}>Booking #{String(booking._id || booking.id).substring(0, 8)}</Text>
          <View style={styles.statusBadgeRow}>
            <Badge status={booking.status} />
          </View>
          <Text style={styles.dateText}>
            Scheduled for {new Date(booking.bookingDate || Date.now()).toLocaleDateString()} at{' '}
            {booking.startTime || '10:00 AM'}
          </Text>
        </View>

        {/* Assigned Worker Info */}
        {(booking.workerId || booking.worker) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assigned Professional</Text>
            <View style={styles.workerRow}>
              <ProfileAvatar user={booking.workerId || booking.worker} size="lg" showBadge />
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>
                  {booking.workerId?.name || booking.worker?.name || 'Assigned Professional'}
                </Text>
                <Text style={styles.workerPhone}>
                  {booking.workerId?.phone || booking.worker?.phone || 'Contact via platform'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Service Address */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={20} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={styles.addressText}>
              {booking.address || 'Registered address for service delivery'}
            </Text>
          </View>
        </View>

        {/* Payment & Amount Breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Duration</Text>
            <Text style={styles.priceVal}>{booking.durationHours || 2} hours</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Payment Status</Text>
            <Text style={styles.priceVal}>{booking.paymentStatus || 'PENDING'}</Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>
              ₹{booking.totalAmount || booking.estimatedPrice || 500}
            </Text>
          </View>
        </View>

        {canCancel && (
          <AppButton
            title="Cancel Booking"
            variant="danger"
            onPress={handleCancelBooking}
            loading={cancelling}
            style={{ marginTop: spacing.md }}
          />
        )}
      </ScrollView>
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
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  bookingIdText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
  },
  statusBadgeRow: {
    marginVertical: spacing.md,
  },
  dateText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
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
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerInfo: {
    marginLeft: spacing.md,
  },
  workerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  workerPhone: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  priceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  priceVal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
