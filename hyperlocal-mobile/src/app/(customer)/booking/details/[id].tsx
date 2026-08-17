import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
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
import { useAuth } from '../../../../context/AuthContext';
import { colors, spacing, typography, radius, shadows } from '../../../../theme';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const rawId = Array.isArray(id) ? id[0] : id;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const isProcessingPaymentRef = useRef(false);

  const fetchDetails = useCallback(async (isSilent = false) => {
    if (!rawId) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await api.get(`/bookings/${rawId}`);
      const b = res.data?.booking || res.data;
      setBooking(b);
    } catch (err: any) {
      console.error('Fetch booking details error:', err?.response?.data || err.message);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [rawId]);

  useEffect(() => {
    if (rawId) fetchDetails();
  }, [rawId, fetchDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetails(true);
  };

  const handleInitiatePayment = async () => {
    if (paying || isProcessingPaymentRef.current || !booking) return;
    const bId = booking.id || booking._id || rawId;
    setPaymentError('');
    setPaying(true);

    try {
      const randKey = `idemp-${bId}-${Date.now()}`;
      const res = await api.post(
        '/payments/orders',
        { bookingId: bId },
        { headers: { 'Idempotency-Key': randKey } }
      );

      const orderData = res.data?.data || res.data;

      if (orderData && typeof window !== 'undefined' && (Platform.OS === 'web' || (window as any).document)) {
        if (!(window as any).Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
            document.body.appendChild(script);
          });
        }

        const options = {
          key: orderData.publicKeyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'JobNest Services',
          description: `Payment for booking #${orderData.bookingNumber || bId}`,
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          notes: {
            bookingId: bId,
            bookingNumber: orderData.bookingNumber,
          },
          theme: { color: '#F97316' },
          modal: {
            ondismiss: function () {
              setPaymentError('Payment cancelled.');
              setPaying(false);
            },
          },
          handler: async function (response: any) {
            if (isProcessingPaymentRef.current) return;
            isProcessingPaymentRef.current = true;
            setPaying(true);
            try {
              const verifyRes = await api.post('/payments/verify', {
                internalPaymentOrderId: orderData.internalPaymentOrderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyRes.data?.success) {
                Alert.alert('Payment Successful', 'Your booking payment has been verified and confirmed.');
                await fetchDetails(true);
              } else {
                setPaymentError(verifyRes.data?.message || 'Payment verification could not be completed.');
              }
            } catch (verifyErr: any) {
              setPaymentError(verifyErr.response?.data?.message || 'Payment verification failed on server.');
            } finally {
              setPaying(false);
              isProcessingPaymentRef.current = false;
            }
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setPaymentError(resp?.error?.description || 'Payment failed.');
          setPaying(false);
        });
        rzp.open();
      } else {
        Alert.alert('Payment Order Ready', `Payment order #${orderData?.razorpayOrderId || bId} created.`);
        await fetchDetails(true);
        setPaying(false);
      }
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || err.message || 'Failed to initiate payment.');
      setPaying(false);
    }
  };

  const handleCancelBooking = async () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.post(`/bookings/${rawId}/cancel`);
            fetchDetails(true);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel booking.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
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
          onAction={() => router.replace('/(customer)/bookings')}
        />
      </View>
    );
  }

  const currentStatus = booking.bookingStatus || booking.status || 'PENDING';
  const paymentStatus = booking.paymentStatus || 'PENDING';
  const isPaid = paymentStatus === 'PAID' || ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'IN_PROGRESS', 'STARTED'].includes(currentStatus);
  const canCancel = ['PENDING', 'PAYMENT_PENDING', 'ASSIGNED', 'CONFIRMED'].includes(currentStatus);

  const scheduledDate = booking.scheduledStart || booking.bookingDate;
  const formattedDate = scheduledDate
    ? new Date(scheduledDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Scheduled Date';
  const formattedTime =
    booking.startTime ||
    (scheduledDate ? new Date(scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM');

  const displayAddress =
    booking.serviceAddress ||
    (typeof booking.address === 'string' ? booking.address : '') ||
    (booking.addressSnapshot
      ? `${booking.addressSnapshot.houseNumber || ''} ${booking.addressSnapshot.street || ''}, ${booking.addressSnapshot.locality ? booking.addressSnapshot.locality + ', ' : ''}${booking.addressSnapshot.city || ''} - ${booking.addressSnapshot.pincode || ''}`.trim()
      : 'Registered service address');

  const workerObj = booking.workerId || booking.worker;
  const durationText = booking.durationMinutes
    ? `${Math.round(booking.durationMinutes / 60)} hrs`
    : `${booking.durationHours || 2} hrs`;

  return (
    <View style={styles.container}>
      <MobileHeader title="Booking Details" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
        }
      >
        {/* Status Hero Card */}
        <View style={styles.statusCard}>
          <Text style={styles.bookingIdText}>
            Booking #{booking.bookingNumber || String(booking._id || booking.id || rawId).substring(0, 8)}
          </Text>
          <View style={styles.statusBadgeRow}>
            <Badge status={currentStatus} />
          </View>
          <Text style={styles.dateText}>
            Scheduled for {formattedDate} at {formattedTime}
          </Text>
        </View>

        {/* Payment Error Notice */}
        {paymentError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorCardText}>{paymentError}</Text>
          </View>
        ) : null}

        {/* Assigned Worker Info */}
        {workerObj && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assigned Professional</Text>
            <View style={styles.workerRow}>
              <ProfileAvatar user={workerObj} size="lg" showBadge />
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>
                  {workerObj?.name || workerObj?.fullName || booking.workerName || 'Assigned Professional'}
                </Text>
                <Text style={styles.workerPhone}>
                  {workerObj?.phone || 'Contact via platform support'}
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
            <Text style={styles.addressText}>{displayAddress}</Text>
          </View>
        </View>

        {/* Payment & Amount Breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Details</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Duration</Text>
            <Text style={styles.priceVal}>{durationText}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Payment Status</Text>
            <Text style={[styles.priceVal, isPaid ? styles.paidText : styles.pendingText]}>
              {paymentStatus}
            </Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>
              ₹{booking.totalAmount || booking.estimatedPrice || 500}
            </Text>
          </View>
        </View>

        {/* If payment is pending: allow customer to complete payment directly */}
        {!isPaid && currentStatus !== 'CANCELLED' && currentStatus !== 'REJECTED' && (
          <AppButton
            title={`Pay Now • ₹${booking.totalAmount || booking.estimatedPrice || 500}`}
            variant="primary"
            icon="card-outline"
            loading={paying}
            onPress={handleInitiatePayment}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {/* Live Tracking Action */}
        {isPaid && (
          <AppButton
            title="Track Live Location"
            variant="primary"
            icon="navigate-outline"
            onPress={() => router.push(`/(customer)/booking/tracking/${rawId}` as any)}
            style={{ marginTop: spacing.md }}
          />
        )}

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
  errorCard: {
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
  errorCardText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.error,
    fontWeight: typography.weights.medium,
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
  paidText: {
    color: colors.success,
  },
  pendingText: {
    color: colors.accent,
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
