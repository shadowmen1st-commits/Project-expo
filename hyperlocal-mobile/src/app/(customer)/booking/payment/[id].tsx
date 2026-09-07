import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import RazorpayCheckout from 'react-native-razorpay';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MobileHeader } from '../../../../components/MobileHeader';
import { AppButton } from '../../../../components/AppButton';
import { LoadingState } from '../../../../components/LoadingState';
import { EmptyState } from '../../../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../../config/api';
import { storage } from '../../../../utils/storage';
import { useAuth } from '../../../../context/AuthContext';
import { colors, spacing, typography, radius, shadows } from '../../../../theme';
import {
  formatBookingAmount,
  formatBookingDateTimeIST,
  normalizeBookingStatus,
  resolveBookingId,
} from '../../../../utils/formatters';

export default function BookingPaymentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const rawId = Array.isArray(id) ? id[0] : id;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState('Connecting to secure payment gateway...');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const isProcessingRef = useRef(false);

  const fetchBooking = useCallback(async () => {
    if (!rawId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get(`/bookings/${rawId}`);
      const b = res.data?.booking || res.data;
      setBooking(b);

      const status = normalizeBookingStatus(b.bookingStatus || b.status);
      const paymentStatus = normalizeBookingStatus(b.paymentStatus);
      if (
        paymentStatus === 'PAID' ||
        ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)
      ) {
        setIsSuccess(true);
        setTimeout(() => {
          router.replace({ pathname: '/(customer)/booking/details/[id]', params: { id: rawId } } as any);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Fetch booking error:', err?.response?.data || err.message);
      setErrorMessage(err?.response?.data?.message || err.userMessage || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [rawId, router]);

  useEffect(() => {
    fetchBooking();
    console.log('[PAYMENT_SCREEN_INIT]', { bookingId: rawId });
  }, [fetchBooking, rawId]);

  // Launch official Razorpay Checkout session directly
  const handleLaunchRazorpay = async () => {
    if (isProcessingPayment || isProcessingRef.current || !booking) {
      return;
    }

    const bId = resolveBookingId(booking) || rawId;
    isProcessingRef.current = true;
    setIsProcessingPayment(true);
    setErrorMessage('');
    setPaymentStatusText('Creating secure Razorpay order...');

    console.log('[PAYMENT] Directly creating Razorpay order for booking:', bId);

    try {
      const randKey = `idemp-pay-${bId}-${Date.now()}`;
      const orderRes = await api.post(
        '/payments/orders',
        { bookingId: bId },
        { headers: { 'Idempotency-Key': randKey } }
      );

      if (!orderRes.data?.success && !orderRes.data?.data) {
        throw new Error(orderRes.data?.message || 'Failed to generate payment order');
      }

      const orderData = orderRes.data?.data || orderRes.data;
      const internalPaymentOrderId = orderData.internalPaymentOrderId || orderData.orderId;
      const razorpayOrderId = orderData.razorpayOrderId;

      console.log('[PAYMENT] Razorpay order created:', {
        orderId: razorpayOrderId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
      });

      // Persist pending payment context
      await storage.setItem(
        'JOBNEST_PENDING_PAYMENT',
        JSON.stringify({
          bookingId: bId,
          internalPaymentOrderId,
          razorpayOrderId,
        })
      );

      const amountInPaise = Math.round(Number(orderData.amount) * 100);

      const options = {
        description: `Payment for Booking #${bId.substring(0, 8)}`,
        image: 'https://jobnest.com/logo.png',
        currency: orderData.currency || 'INR',
        key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TS38Ger2YMCfWh',
        amount: amountInPaise,
        name: 'JobNest',
        order_id: razorpayOrderId,
        theme: { color: '#2563EB' },
        prefill: {
          email: user?.email || 'customer@example.com',
          contact: user?.phone || '9999999999',
          name: user?.name || 'Customer'
        }
      };

      const rzpData = await RazorpayCheckout.open(options);

      const rzpOrderId = rzpData.razorpay_order_id;
      const rzpPaymentId = rzpData.razorpay_payment_id;
      const rzpSig = rzpData.razorpay_signature;

      if (rzpOrderId && rzpPaymentId && rzpSig) {
        console.log('[PAYMENT] Verifying signature via backend...');
        setPaymentStatusText('Authorizing & verifying payment with bank...');

        const verifyRes = await api.post('/payments/verify', {
          internalPaymentOrderId,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPaymentId,
          razorpay_signature: rzpSig,
        });

        if (verifyRes.data?.success) {
          console.log('[PAYMENT] Verified! Navigating to booking details...');
          await storage.removeItem('JOBNEST_PENDING_PAYMENT');
          setIsSuccess(true);
          const targetBookingId = verifyRes.data?.data?.bookingId || bId;
          setTimeout(() => {
            router.replace({
              pathname: '/(customer)/booking/details/[id]',
              params: { id: targetBookingId },
            } as any);
          }, 1200);
          return;
        } else {
          setErrorMessage(verifyRes.data?.message || 'Payment signature verification failed.');
        }
      }

      // Check if booking was marked PAID in background
      try {
        const checkRes = await api.get(`/bookings/${bId}`);
        const bCheck = checkRes.data?.booking || checkRes.data;
        const status = normalizeBookingStatus(bCheck?.bookingStatus || bCheck?.status);
        const pStatus = normalizeBookingStatus(bCheck?.paymentStatus);
        if (pStatus === 'PAID' || ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes(status)) {
          await storage.removeItem('JOBNEST_PENDING_PAYMENT');
          setIsSuccess(true);
          setTimeout(() => {
            router.replace({
              pathname: '/(customer)/booking/details/[id]',
              params: { id: bId },
            } as any);
          }, 1200);
          return;
        }
      } catch {
        // ignore
      }

      console.log('[PAYMENT_FAILED] Payment not completed');
      setErrorMessage('Payment was cancelled. You can retry whenever you are ready.');
    } catch (err: any) {
      console.log('[PAYMENT_FAILED]', err?.response?.data?.message || err.message);
      setErrorMessage(err?.response?.data?.message || err.userMessage || 'Payment could not be started. Please try again.');
    } finally {
      setIsProcessingPayment(false);
      isProcessingRef.current = false;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Secure Payment" showBack />
        <LoadingState message="Preparing secure payment checkout..." />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Secure Payment" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Booking Not Found"
          description="Could not locate the requested booking for payment."
          actionTitle="Back to Bookings"
          onAction={() => router.replace('/(customer)/bookings')}
        />
      </View>
    );
  }

  const bId = resolveBookingId(booking) || rawId;
  const amountStr = formatBookingAmount(booking);
  const dateTimeStr = formatBookingDateTimeIST(
    booking.scheduledStart || booking.bookingDate || booking.createdAt,
    booking.bookingTime
  );
  const categoryName =
    booking.category?.name ||
    booking.serviceCategoryId?.name ||
    booking.serviceCategoryName ||
    'Service Booking';
  const workerObj = booking.worker || booking.workerId;
  const workerName = workerObj?.name || booking.workerName || 'Assigned Professional';

  return (
    <View style={styles.container}>
      <MobileHeader title="Complete Payment" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isSuccess ? (
          <View style={styles.card}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={58} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>PAYMENT SUCCESSFUL</Text>
            <Text style={styles.successSub}>
              ₹{amountStr} received securely via Razorpay Escrow.
            </Text>
            <Text style={[styles.successNote, { marginTop: spacing.md, fontStyle: 'italic' }]}>
              Redirecting to booking details...
            </Text>
          </View>
        ) : (
          <>
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={22} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>Payment Pending</Text>
                  <Text style={styles.errorSubText}>{errorMessage}</Text>
                </View>
              </View>
            ) : null}

            {/* Booking Summary Card */}
            <View style={styles.card}>
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCategory}>{categoryName}</Text>
                  <Text style={styles.orderNumber}>
                    Booking #{booking.bookingNumber || bId.substring(0, 8)}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>PAYMENT PENDING</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="person-outline" size={18} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Professional</Text>
                  <Text style={styles.infoVal}>{workerName}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="calendar-outline" size={18} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Scheduled Date & Time (IST)</Text>
                  <Text style={styles.infoVal}>{dateTimeStr}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Total Amount Payable</Text>
                <Text style={styles.priceVal}>₹{amountStr}</Text>
              </View>

              <View style={styles.escrowNotice}>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                <Text style={styles.escrowNoticeText}>
                  100% Escrow Protected. Held securely until service completion.
                </Text>
              </View>
            </View>

            {/* Direct Razorpay Launch Action */}
            <View style={styles.actionCard}>
              {isProcessingPayment ? (
                <View style={styles.processingBox}>
                  <ActivityIndicator size="large" color="#EA580C" style={{ marginBottom: spacing.md }} />
                  <Text style={styles.processingText}>{paymentStatusText}</Text>
                </View>
              ) : (
                <>
                  <AppButton
                    title={`Pay ₹${amountStr} with Razorpay`}
                    variant="primary"
                    icon="shield-checkmark-outline"
                    onPress={handleLaunchRazorpay}
                    style={{ width: '100%' }}
                  />

                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.replace('/(customer)/bookings')}
                  >
                    <Text style={styles.backBtnText}>Pay Later / Back to Bookings</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderCategory: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  orderNumber: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  infoVal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  priceVal: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: spacing.xs,
  },
  escrowNoticeText: {
    fontSize: 11,
    color: '#15803D',
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#B91C1C',
  },
  errorSubText: {
    fontSize: typography.sizes.xs,
    color: '#DC2626',
    marginTop: 2,
  },
  processingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  processingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  backBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#16A34A',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successSub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  successNote: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
