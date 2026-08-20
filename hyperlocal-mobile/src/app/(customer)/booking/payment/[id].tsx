import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MobileHeader } from '../../../../components/MobileHeader';
import { AppButton } from '../../../../components/AppButton';
import { LoadingState } from '../../../../components/LoadingState';
import { EmptyState } from '../../../../components/EmptyState';
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

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type PaymentFlowState =
  | 'SELECT_METHOD'
  | 'CREATING_ORDER'
  | 'CHECKOUT_OPEN'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED';

export default function BookingPaymentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const rawId = Array.isArray(id) ? id[0] : id;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flowState, setFlowState] = useState<PaymentFlowState>('SELECT_METHOD');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState('Connecting to secure payment gateway...');
  const [verifiedTxnDetails, setVerifiedTxnDetails] = useState<{
    paymentId: string;
    transactionNumber: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [methodSelectionError, setMethodSelectionError] = useState('');

  // Razorpay Gateway Modal state
  const [gatewayOrderData, setGatewayOrderData] = useState<any>(null);
  const [upiIdInput, setUpiIdInput] = useState(user?.email ? `${user.email.split('@')[0]}@okaxis` : 'customer@upi');
  const [cardNumberInput, setCardNumberInput] = useState('4532 •••• •••• 8892');
  const [cardExpiryInput, setCardExpiryInput] = useState('12/28');
  const [cardCvvInput, setCardCvvInput] = useState('321');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState('Paytm');

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
        setFlowState('SUCCESS');
        setVerifiedTxnDetails({
          paymentId: b.paymentTransactionId || b.paymentId || 'PAY_VERIFIED_HISTORIC',
          transactionNumber: b.transactionNumber || `TXN-${b.bookingNumber || rawId.substring(0, 8)}`,
        });
      }
    } catch (err: any) {
      console.error('Fetch booking error:', err?.response?.data || err.message);
      setErrorMessage(err?.response?.data?.message || err.userMessage || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchBooking();
    console.log('[PAYMENT_SCREEN_INIT]', { bookingId: rawId });
  }, [fetchBooking, rawId]);

  // Handle Payment Method Selection: ONLY updates state, NEVER triggers payment
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    console.log('[PAYMENT] Method selected:', method);
    setSelectedMethod(method);
    setMethodSelectionError('');
    setErrorMessage('');
    if (flowState === 'FAILED') {
      setFlowState('SELECT_METHOD');
    }
  };

  // Continue to Payment Button Handler: Validates method, creates order, and opens Razorpay Checkout
  const handleContinueToPayment = async () => {
    if (!selectedMethod) {
      setMethodSelectionError('Please select a payment method');
      return;
    }

    if (isProcessingPayment || flowState === 'CREATING_ORDER' || flowState === 'VERIFYING' || isProcessingRef.current || !booking) {
      return;
    }

    const bId = resolveBookingId(booking) || rawId;
    isProcessingRef.current = true;
    setIsProcessingPayment(true);
    setFlowState('CREATING_ORDER');
    setPaymentStatusText('Creating secure payment order...');
    setErrorMessage('');
    setMethodSelectionError('');

    console.log('[PAYMENT] Method selected:', selectedMethod);
    console.log('[PAYMENT] Creating Razorpay order');

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
      console.log('[PAYMENT] Opening Razorpay Checkout');

      setGatewayOrderData({
        ...orderData,
        bookingId: bId,
        internalPaymentOrderId,
        razorpayOrderId,
        preferredMethod: selectedMethod,
      });

      // Web platform standard Razorpay checkout support
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
          name: 'Jobnest Services',
          description: `Payment for booking #${orderData.bookingNumber || bId}`,
          order_id: razorpayOrderId,
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
            contact: user?.phone || '',
            method: selectedMethod,
          },
          notes: {
            bookingId: bId,
            bookingNumber: orderData.bookingNumber,
          },
          theme: { color: '#EA580C' },
          modal: {
            ondismiss: function () {
              console.log('[PAYMENT_FAILED] reason=Customer cancelled payment');
              setFlowState('FAILED');
              setErrorMessage('Payment was not completed. You can try again.');
              setIsProcessingPayment(false);
              isProcessingRef.current = false;
            },
          },
          handler: async function (response: any) {
            console.log('[PAYMENT] Checkout success');
            console.log('[PAYMENT] Payment ID:', response.razorpay_payment_id);
            console.log('[PAYMENT] Order ID:', response.razorpay_order_id);
            console.log('[PAYMENT] Signature received');
            await handleVerifyPaymentSignature({
              internalPaymentOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bId,
            });
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          console.log('[PAYMENT_FAILED]', resp?.error?.description || 'Checkout failed');
          setFlowState('FAILED');
          setErrorMessage(resp?.error?.description || 'Payment was not completed. You can try again.');
          setIsProcessingPayment(false);
          isProcessingRef.current = false;
        });
        rzp.open();
        return;
      }

      // Native mobile: Open Official Razorpay Checkout session in browser modal
      const checkoutUrl = `${api.defaults.baseURL}/payments/checkout/${internalPaymentOrderId}`;
      console.log('[PAYMENT] Opening official Razorpay checkout URL:', checkoutUrl);

      const browserResult = await WebBrowser.openAuthSessionAsync(
        checkoutUrl,
        'jobnest://payment-callback'
      );

      console.log('[PAYMENT] Browser session finished:', browserResult);

      if (browserResult.type === 'success' && browserResult.url) {
        const callbackUrl = browserResult.url;
        const queryIdx = callbackUrl.indexOf('?');
        const queryStr = queryIdx !== -1 ? callbackUrl.substring(queryIdx + 1) : '';
        const params = new URLSearchParams(queryStr);

        const rzpOrderId = params.get('razorpay_order_id');
        const rzpPaymentId = params.get('razorpay_payment_id');
        const rzpSig = params.get('razorpay_signature');
        const errParam = params.get('error');
        const cancelled = params.get('cancelled');

        if (errParam || cancelled) {
          console.log('[PAYMENT_FAILED] Checkout cancelled or failed:', errParam);
          setFlowState('FAILED');
          setErrorMessage(errParam || 'Payment was cancelled.');
          setIsProcessingPayment(false);
          isProcessingRef.current = false;
          return;
        }

        if (rzpOrderId && rzpPaymentId && rzpSig) {
          console.log('[PAYMENT] Official Razorpay payment captured:', { rzpOrderId, rzpPaymentId });
          await handleVerifyPaymentSignature({
            internalPaymentOrderId,
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: rzpPaymentId,
            razorpay_signature: rzpSig,
            bId,
          });
          return;
        }
      }

      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
        console.log('[PAYMENT_FAILED] Customer dismissed checkout window');
        setFlowState('FAILED');
        setErrorMessage('Payment was not completed. You can try again.');
        setIsProcessingPayment(false);
        isProcessingRef.current = false;
      }
    } catch (err: any) {
      console.log('[PAYMENT_FAILED]', err?.response?.data?.message || err.message);
      setFlowState('FAILED');
      setErrorMessage(err?.response?.data?.message || err.userMessage || 'Payment was not completed. You can try again.');
      setIsProcessingPayment(false);
      isProcessingRef.current = false;
    }
  };

  // Step 3: Backend signature verification & confirmation
  const handleVerifyPaymentSignature = async ({
    internalPaymentOrderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bId,
  }: {
    internalPaymentOrderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    bId: string;
  }) => {
    setIsProcessingPayment(true);
    setFlowState('VERIFYING');
    setPaymentStatusText('Authorizing & verifying payment with bank...');

    try {
      console.log('[PAYMENT] Verifying signature');

      const verifyRes = await api.post('/payments/verify', {
        internalPaymentOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (verifyRes.data?.success) {
        console.log('[PAYMENT] Signature verification successful');
        console.log('[PAYMENT] Booking marked PAID');
        setFlowState('SUCCESS');
        setVerifiedTxnDetails({
          paymentId: razorpay_payment_id,
          transactionNumber: verifyRes.data?.data?.transactionNumber || `TXN-${Date.now()}`,
        });

        // Refresh booking state
        fetchBooking();
      } else {
        console.log('[PAYMENT_FAILED]', verifyRes.data?.message);
        setFlowState('FAILED');
        setErrorMessage(verifyRes.data?.message || 'Payment verification rejected.');
      }
    } catch (vErr: any) {
      console.log('[PAYMENT_FAILED]', vErr.response?.data?.message || vErr.message);
      setFlowState('FAILED');
      setErrorMessage(vErr.response?.data?.message || vErr.userMessage || 'Payment verification failed.');
    } finally {
      setIsProcessingPayment(false);
      isProcessingRef.current = false;
    }
  };

  const handleDismissGatewayModal = () => {
    console.log('[PAYMENT_FAILED] reason=Customer cancelled payment');
    setFlowState('FAILED');
    setErrorMessage('Payment was not completed. You can try again.');
    setIsProcessingPayment(false);
    isProcessingRef.current = false;
  };

  const handleRetryPayment = () => {
    setFlowState('SELECT_METHOD');
    setErrorMessage('');
    setMethodSelectionError('');
  };

  const getMethodDisplayName = (m: PaymentMethod | null) => {
    switch (m) {
      case 'upi':
        return 'UPI (Google Pay, PhonePe, Paytm, BHIM)';
      case 'card':
        return 'Credit / Debit Card';
      case 'netbanking':
        return 'Net Banking';
      case 'wallet':
        return 'Wallets (Paytm, Mobikwik, PhonePe)';
      default:
        return 'None selected';
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

  const isSuccess = flowState === 'SUCCESS';

  return (
    <View style={styles.container}>
      <MobileHeader title={isSuccess ? "Booking Confirmed" : "Choose Payment Method"} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Payment Success State */}
        {isSuccess ? (
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={58} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>PAYMENT SUCCESSFUL</Text>
            <Text style={styles.successSub}>
              ₹{amountStr} received securely via Razorpay Escrow.
            </Text>

            {/* Confirmation details */}
            <View style={styles.confirmDetailsBox}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Booking ID</Text>
                <Text style={styles.confirmVal}>#{booking.bookingNumber || bId.substring(0, 8)}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Service</Text>
                <Text style={styles.confirmVal}>{categoryName}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Professional</Text>
                <Text style={styles.confirmVal}>{workerName}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Date & Time</Text>
                <Text style={styles.confirmVal}>{dateTimeStr}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Amount Paid</Text>
                <Text style={[styles.confirmVal, { color: '#16A34A', fontWeight: 'bold' }]}>₹{amountStr}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Payment ID</Text>
                <Text style={styles.confirmValMonospace}>
                  {verifiedTxnDetails?.paymentId || 'pay_verified'}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Payment Status</Text>
                <Text style={[styles.confirmVal, { color: '#16A34A', fontWeight: 'bold' }]}>PAID</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Escrow Status</Text>
                <Text style={[styles.confirmVal, { color: '#16A34A', fontWeight: 'bold' }]}>HELD (100% Protected)</Text>
              </View>
            </View>

            <Text style={styles.successNote}>
              🛡️ 100% Escrow Protection active. Funds are held safely and only released when you confirm service completion.
            </Text>

            <AppButton
              title="🧭 View Live Tracking"
              variant="primary"
              icon="navigate-outline"
              onPress={() => router.replace(`/(customer)/booking/tracking/${bId}` as any)}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />

            <TouchableOpacity
              onPress={() => router.replace('/(customer)/bookings')}
              style={styles.backBookingLink}
            >
              <Text style={styles.backBookingText}>Back to Bookings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Error / Failure Notice */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={22} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>Payment was not completed.</Text>
                  <Text style={styles.errorSubText}>{errorMessage}</Text>
                  <View style={styles.retryActionsRow}>
                    <TouchableOpacity
                      onPress={handleRetryPayment}
                      style={styles.retryBtn}
                    >
                      <Ionicons name="refresh-outline" size={14} color="#EA580C" />
                      <Text style={styles.retryBtnText}>Try Payment Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.replace('/(customer)/bookings')}
                      style={styles.cancelBookingBtn}
                    >
                      <Text style={styles.cancelBookingBtnText}>Back to Booking</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Method Selection Required Notice */}
            {methodSelectionError ? (
              <View style={[styles.errorBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
                <Text style={[styles.errorText, { color: '#B45309' }]}>{methodSelectionError}</Text>
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
                <Text style={styles.metaText}>
                  Provider: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{workerName}</Text>
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={2}>
                  {booking.serviceAddress || 'Registered Address'}
                </Text>
              </View>
            </View>

            {/* Payment Method Selection */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Choose Payment Method</Text>
              <Text style={styles.sectionSubTitle}>Select your preferred payment mode below:</Text>

              {/* UPI Option */}
              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'upi' && styles.methodOptionActive]}
                onPress={() => handleSelectPaymentMethod('upi')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'upi' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="phone-portrait-outline" size={20} color="#EA580C" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>UPI</Text>
                  <Text style={styles.methodSub}>Google Pay, PhonePe, Paytm, BHIM, UPI QR</Text>
                </View>
                {selectedMethod === 'upi' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Card Option */}
              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'card' && styles.methodOptionActive]}
                onPress={() => handleSelectPaymentMethod('card')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'card' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="card-outline" size={20} color="#2563EB" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Credit / Debit Card</Text>
                  <Text style={styles.methodSub}>Visa, Mastercard, RuPay, Maestro</Text>
                </View>
                {selectedMethod === 'card' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Net Banking Option */}
              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'netbanking' && styles.methodOptionActive]}
                onPress={() => handleSelectPaymentMethod('netbanking')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'netbanking' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="business-outline" size={20} color="#16A34A" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Net Banking</Text>
                  <Text style={styles.methodSub}>HDFC, ICICI, SBI, Axis & all major banks</Text>
                </View>
                {selectedMethod === 'netbanking' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Wallets Option */}
              <TouchableOpacity
                style={[styles.methodOption, selectedMethod === 'wallet' && styles.methodOptionActive]}
                onPress={() => handleSelectPaymentMethod('wallet')}
                activeOpacity={0.8}
              >
                <View style={styles.methodRadio}>
                  {selectedMethod === 'wallet' && <View style={styles.methodRadioInner} />}
                </View>
                <Ionicons name="wallet-outline" size={20} color="#9333EA" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Wallets</Text>
                  <Text style={styles.methodSub}>Paytm Wallet, Mobikwik, PhonePe Wallet</Text>
                </View>
                {selectedMethod === 'wallet' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Selected Method Display */}
              {selectedMethod ? (
                <View style={styles.selectedSummaryRow}>
                  <Ionicons name="information-circle-outline" size={16} color="#EA580C" />
                  <Text style={styles.selectedSummaryText}>
                    Selected method: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{getMethodDisplayName(selectedMethod)}</Text>
                  </Text>
                </View>
              ) : null}
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
                <Text style={[styles.priceValue, { color: '#16A34A' }]}>Included (₹0)</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Taxes & GST</Text>
                <Text style={[styles.priceValue, { color: '#16A34A' }]}>Included (₹0)</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>₹{amountStr}</Text>
              </View>

              <View style={styles.securityBanner}>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                <Text style={styles.securityText}>
                  100% Escrow Protection. Funds released only after customer confirms completion.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Continue to Payment Footer Action */}
      {!isSuccess && (
        <View style={styles.footerBar}>
          <View style={styles.footerPriceCol}>
            <Text style={styles.footerLabel}>Total Amount</Text>
            <Text style={styles.footerAmount}>₹{amountStr}</Text>
          </View>

          <AppButton
            title={
              flowState === 'CREATING_ORDER'
                ? 'Creating Order...'
                : flowState === 'VERIFYING'
                ? 'Verifying...'
                : 'Continue to Payment'
            }
            variant="primary"
            icon="arrow-forward"
            loading={flowState === 'CREATING_ORDER' || flowState === 'VERIFYING' || isProcessingPayment}
            disabled={flowState === 'CREATING_ORDER' || flowState === 'VERIFYING' || isProcessingPayment}
            onPress={handleContinueToPayment}
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
    marginBottom: 2,
  },
  sectionSubTitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
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
  selectedBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  selectedSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  selectedSummaryText: {
    fontSize: 12,
    color: '#9A3412',
    flex: 1,
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
    marginTop: spacing.md,
    ...shadows.md,
  },
  successIconContainer: {
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#16A34A',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  successSub: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  confirmLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  confirmVal: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  confirmValMonospace: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.textSecondary,
  },
  successNote: {
    fontSize: 11,
    color: '#16A34A',
    textAlign: 'center',
    lineHeight: 16,
    backgroundColor: '#F0FDF4',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  backBookingLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  backBookingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    textDecorationLine: 'underline',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: '#DC2626',
    fontWeight: typography.weights.bold,
  },
  errorSubText: {
    fontSize: typography.sizes.xs,
    color: '#7F1D1D',
    marginTop: 2,
  },
  retryActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
  },
  cancelBookingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  cancelBookingBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 20,
  },
  gatewayContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    ...shadows.lg,
  },
  gatewayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gatewayBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  razorpayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C2340',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    gap: 4,
  },
  razorpayBadgeText: {
    color: '#528FF0',
    fontWeight: typography.weights.bold,
    fontSize: 12,
  },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.xs,
    gap: 3,
  },
  securePillText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: '#16A34A',
    letterSpacing: 0.3,
  },
  gatewayCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  gatewayMerchant: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  gatewayOrderId: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  gatewayAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
  },
  gatewayBody: {
    marginBottom: spacing.lg,
  },
  gatewaySection: {
    marginBottom: spacing.sm,
  },
  gatewayFieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  gatewayInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#FFFFFF',
  },
  gatewayInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  gatewayHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  bankChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  bankChipActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  bankChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  bankChipTextActive: {
    color: '#EA580C',
    fontWeight: typography.weights.bold,
  },
  gatewayActions: {
    alignItems: 'center',
  },
  gatewayCancelBtn: {
    paddingVertical: 8,
  },
  gatewayCancelText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
});
