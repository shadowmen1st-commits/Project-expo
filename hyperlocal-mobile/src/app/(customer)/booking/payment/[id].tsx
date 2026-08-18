import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
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
import {
  formatBookingAmount,
  formatBookingDateTimeIST,
  normalizeBookingStatus,
  resolveBookingId,
} from '../../../../utils/formatters';

type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'SANDBOX_PAY';

export default function BookingPaymentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const rawId = Array.isArray(id) ? id[0] : id;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('UPI');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      if (paymentStatus === 'PAID' || ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'IN_PROGRESS', 'STARTED'].includes(status)) {
        setPaymentSuccess(true);
      }
    } catch (err: any) {
      console.error('Fetch booking error:', err?.response?.data || err.message);
      setErrorMessage(err?.response?.data?.message || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleProcessPayment = async () => {
    if (paying || isProcessingRef.current || !booking) return;
    const bId = resolveBookingId(booking) || rawId;
    isProcessingRef.current = true;
    setPaying(true);
    setErrorMessage('');

    try {
      // 1. Create Payment Order on Backend
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

      console.log('[MOBILE PAYMENT:ORDER_CREATED]', {
        bId,
        internalPaymentOrderId,
        razorpayOrderId,
      });

      // 2. Web Razorpay standard checkout
      if (typeof window !== 'undefined' && (Platform.OS === 'web' || (window as any).document)) {
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
          order_id: razorpayOrderId,
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
              setErrorMessage('Payment was cancelled.');
              setPaying(false);
              isProcessingRef.current = false;
            },
          },
          handler: async function (response: any) {
            try {
              const verifyRes = await api.post('/payments/verify', {
                internalPaymentOrderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyRes.data?.success) {
                setPaymentSuccess(true);
                setTimeout(() => {
                  router.replace(`/(customer)/booking/tracking/${bId}` as any);
                }, 1200);
              } else {
                setErrorMessage(verifyRes.data?.message || 'Payment verification rejected.');
              }
            } catch (vErr: any) {
              setErrorMessage(vErr.response?.data?.message || 'Payment verification failed.');
            } finally {
              setPaying(false);
              isProcessingRef.current = false;
            }
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          setErrorMessage(resp?.error?.description || 'Payment transaction failed.');
          setPaying(false);
          isProcessingRef.current = false;
        });
        rzp.open();
        return;
      }

      // 3. Mobile / Local App Instant Sandbox / Mock Verification
      const mockPaymentId = `pay_mock_${Date.now()}`;
      const verifyRes = await api.post('/payments/verify', {
        internalPaymentOrderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: 'SANDBOX_MOCK_SIGNATURE',
      });

      if (verifyRes.data?.success) {
        console.log('[MOBILE PAYMENT:VERIFIED]', { bId });
        setPaymentSuccess(true);
        setTimeout(() => {
          router.replace(`/(customer)/booking/tracking/${bId}` as any);
        }, 1200);
      } else {
        setErrorMessage(verifyRes.data?.message || 'Payment verification failed.');
        setPaying(false);
        isProcessingRef.current = false;
      }
    } catch (err: any) {
      console.error('[MOBILE PAYMENT ERROR]', err?.response?.data || err.message);
      setErrorMessage(err?.response?.data?.message || err.message || 'Payment processing error.');
      setPaying(false);
      isProcessingRef.current = false;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Complete Payment" showBack />
        <LoadingState message="Preparing secure payment checkout..." />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Complete Payment" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Booking Not Found"
          description="Could not locate the requested booking for payment."
          actionTitle="Back to Home"
          onAction={() => router.replace('/(customer)/dashboard')}
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
      <MobileHeader title="Payment Checkout" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Payment Success State */}
        {paymentSuccess ? (
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={54} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successSub}>
              ₹{amountStr} paid securely for booking #{booking.bookingNumber || bId.substring(0, 8)}.
            </Text>
            <Text style={styles.successNote}>
              Escrow funded. Navigating to Live Worker Tracking...
            </Text>

            <AppButton
              title="🧭 View Live Worker Tracking"
              variant="primary"
              icon="navigate-outline"
              onPress={() => router.replace(`/(customer)/booking/tracking/${bId}` as any)}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />
          </View>
        ) : (
          <>
            {/* Error Notice */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Order Summary */}
            <View style={styles.card}>
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCategory}>{categoryName}</Text>
                  <Text style={styles.orderNumber}>
                    Booking #{booking.bookingNumber || bId.substring(0, 8)}
                  </Text>
                </View>
                <Badge status={booking.bookingStatus || 'PAYMENT_PENDING'} size="sm" />
              </View>

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>{dateTimeStr}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>Provider: <Text style={{ fontWeight: '700' }}>{workerName}</Text></Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {booking.serviceAddress || 'Registered Address'}
                </Text>
              </View>
            </View>

            {/* Payment Methods */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Select Payment Method</Text>

              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'UPI' && styles.methodOptionActive]}
                onPress={() => setSelectedMethod('UPI')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'UPI' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="phone-portrait-outline" size={20} color="#EA580C" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>UPI (Google Pay, PhonePe, Paytm)</Text>
                  <Text style={styles.methodSub}>Instant UPI & QR payment</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'CARD' && styles.methodOptionActive]}
                onPress={() => setSelectedMethod('CARD')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'CARD' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="card-outline" size={20} color="#2563EB" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Credit / Debit Card</Text>
                  <Text style={styles.methodSub}>Visa, Mastercard, RuPay</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'NETBANKING' && styles.methodOptionActive]}
                onPress={() => setSelectedMethod('NETBANKING')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'NETBANKING' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="business-outline" size={20} color="#16A34A" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Net Banking</Text>
                  <Text style={styles.methodSub}>All major Indian banks supported</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Price Breakdown */}
            <View style={styles.pricingCard}>
              <Text style={styles.sectionTitle}>Price Summary</Text>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Base Service Rate</Text>
                <Text style={styles.priceValue}>₹{amountStr}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Platform Safety & Escrow</Text>
                <Text style={[styles.priceValue, { color: '#16A34A' }]}>Included</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>₹{amountStr}</Text>
              </View>

              <View style={styles.securityBanner}>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                <Text style={styles.securityText}>
                  100% Escrow Protection. Funds released only after customer confirmation.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Pay Action Footer */}
      {!paymentSuccess && (
        <View style={styles.footerBar}>
          <View style={styles.footerPriceCol}>
            <Text style={styles.footerLabel}>Total Amount</Text>
            <Text style={styles.footerAmount}>₹{amountStr}</Text>
          </View>

          <AppButton
            title={paying ? 'Processing...' : `Pay ₹${amountStr} Now`}
            variant="primary"
            icon="lock-closed"
            loading={paying}
            disabled={paying}
            onPress={handleProcessPayment}
            fullWidth={false}
            style={styles.payButton}
          />
        </View>
      )}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderCategory: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  orderNumber: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: '#FAFAF9',
  },
  methodOptionActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  methodRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  methodRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EA580C',
  },
  methodTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  methodSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  priceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#F0FDF4',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  securityText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  successIconContainer: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#16A34A',
    marginBottom: spacing.xs,
  },
  successSub: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successNote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#DC2626',
    fontWeight: typography.weights.medium,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadows.md,
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  footerAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  payButton: {
    minWidth: 180,
  },
});
