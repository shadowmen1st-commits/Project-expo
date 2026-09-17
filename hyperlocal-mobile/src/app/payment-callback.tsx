import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../config/api';
import { storage } from '../utils/storage';
import { colors, spacing, radius, typography, shadows } from '../theme';

export const PENDING_PAYMENT_STORAGE_KEY = 'SHADOWMAN_PENDING_PAYMENT';

export default function PaymentCallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    internalPaymentOrderId?: string;
    bookingId?: string;
    error?: string;
    cancelled?: string;
  }>();

  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'FAILED'>('PROCESSING');
  const [statusMessage, setStatusMessage] = useState('Verifying payment details with bank...');
  const [errorMessage, setErrorMessage] = useState('');
  const [resolvedBookingId, setResolvedBookingId] = useState<string | null>(null);
  useEffect(() => {
    handleProcessCallback();
  }, [
    searchParams.razorpay_order_id,
    searchParams.razorpay_payment_id,
    searchParams.razorpay_signature,
    searchParams.error,
    searchParams.cancelled,
  ]);

  const handleProcessCallback = async () => {
    try {
      console.log('[PAYMENT_CALLBACK] Deep link triggered with params:', searchParams);

      // 1. Retrieve stored pending payment context as fallback
      let storedContext: { bookingId?: string; internalPaymentOrderId?: string; razorpayOrderId?: string } = {};
      try {
        const raw = await storage.getItem(PENDING_PAYMENT_STORAGE_KEY);
        if (raw) {
          storedContext = JSON.parse(raw);
          console.log('[PAYMENT_CALLBACK] Found stored pending context:', storedContext);
        }
      } catch (err) {
        console.warn('[PAYMENT_CALLBACK] Failed to read storage context:', err);
      }

      const activeBookingId = searchParams.bookingId || storedContext.bookingId || null;
      if (activeBookingId) {
        setResolvedBookingId(activeBookingId);
      }

      // 2. Check for cancellation / explicit failure
      if (searchParams.cancelled === 'true' || searchParams.error) {
        const reason = searchParams.error || 'Payment was cancelled before completion.';
        console.log('[PAYMENT_CALLBACK] Cancelled/Error state:', reason);
        setStatus('FAILED');
        setErrorMessage(reason);
        return;
      }

      // 3. Extract signature parameters
      const razorpay_order_id = searchParams.razorpay_order_id || storedContext.razorpayOrderId;
      const razorpay_payment_id = searchParams.razorpay_payment_id;
      const razorpay_signature = searchParams.razorpay_signature;
      const internalPaymentOrderId = searchParams.internalPaymentOrderId || storedContext.internalPaymentOrderId;

      if (!razorpay_payment_id || !razorpay_signature) {
        // Check if booking was already confirmed
        if (activeBookingId) {
          try {
            const checkRes = await api.get(`/bookings/${activeBookingId}`);
            const b = checkRes.data?.booking || checkRes.data;
            if (b?.paymentStatus === 'PAID' || ['CONFIRMED', 'PAID'].includes(b?.bookingStatus)) {
              console.log('[PAYMENT_CALLBACK] Booking already PAID in background');
              await storage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
              setStatus('SUCCESS');
              setStatusMessage('Payment verified! Redirecting to booking details...');
              setTimeout(() => {
                router.replace({ pathname: '/(customer)/booking/details/[id]', params: { id: activeBookingId } } as any);
              }, 1200);
              return;
            }
          } catch {
            // continue to error
          }
        }

        console.log('[PAYMENT_CALLBACK] Missing payment credentials in callback');
        setStatus('FAILED');
        setErrorMessage('Incomplete payment response from payment gateway.');
        return;
      }

      // 4. Perform Backend HMAC verification
      setStatus('PROCESSING');
      setStatusMessage('Authorizing & verifying payment with bank...');
      console.log('[PAYMENT_CALLBACK] Calling POST /payments/verify with:', {
        internalPaymentOrderId,
        razorpay_order_id,
        razorpay_payment_id,
      });

      const verifyRes = await api.post('/payments/verify', {
        internalPaymentOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (verifyRes.data?.success) {
        console.log('[PAYMENT_CALLBACK] Signature verification successful:', verifyRes.data);
        const finalBookingId = verifyRes.data?.data?.bookingId || activeBookingId;
        setResolvedBookingId(finalBookingId);

        // Clear stored pending payment context
        await storage.removeItem(PENDING_PAYMENT_STORAGE_KEY);

        // Fetch fresh booking confirmation
        if (finalBookingId) {
          try {
            const freshRes = await api.get(`/bookings/${finalBookingId}`);
            console.log('[PAYMENT_CALLBACK] Fresh booking confirmed:', freshRes.data?._id || freshRes.data?.booking?._id);
          } catch (fetchErr) {
            console.warn('[PAYMENT_CALLBACK] Warning fetching fresh booking:', fetchErr);
          }
        }

        setStatus('SUCCESS');
        setStatusMessage('Payment verified! Redirecting to booking details...');

        // Directly navigate to Booking Details screen
        setTimeout(() => {
          if (finalBookingId) {
            router.replace({
              pathname: '/(customer)/booking/details/[id]',
              params: { id: finalBookingId },
            } as any);
          } else {
            router.replace('/(customer)/bookings' as any);
          }
        }, 1200);
      } else {
        console.log('[PAYMENT_CALLBACK] Verification failed:', verifyRes.data?.message);
        setStatus('FAILED');
        setErrorMessage(verifyRes.data?.message || 'Payment signature verification failed.');
      }
    } catch (err: any) {
      console.log('[PAYMENT_CALLBACK] Exception in callback:', err?.response?.data || err.message);
      setStatus('FAILED');
      setErrorMessage(err?.response?.data?.message || err?.message || 'Could not verify payment.');
    }
  };

  const handleRetry = () => {
    if (resolvedBookingId) {
      router.replace({
        pathname: '/(customer)/booking/payment/[id]',
        params: { id: resolvedBookingId },
      } as any);
    } else {
      router.replace('/(customer)/bookings' as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'PROCESSING' && (
          <>
            <ActivityIndicator size="large" color="#EA580C" style={styles.icon} />
            <Text style={styles.title}>Processing Payment</Text>
            <Text style={styles.subtitle}>{statusMessage}</Text>
          </>
        )}

        {status === 'SUCCESS' && (
          <>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
            </View>
            <Text style={[styles.title, { color: '#16A34A' }]}>Payment Verified</Text>
            <Text style={styles.subtitle}>{statusMessage}</Text>
          </>
        )}

        {status === 'FAILED' && (
          <>
            <View style={styles.failedBadge}>
              <Ionicons name="alert-circle" size={56} color="#EF4444" />
            </View>
            <Text style={[styles.title, { color: '#EF4444' }]}>Payment Incomplete</Text>
            <Text style={styles.subtitle}>{errorMessage || 'Payment was not confirmed.'}</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>
                {resolvedBookingId ? 'Try Payment Again' : 'Go to Bookings'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.replace('/(customer)/bookings' as any)}
            >
              <Text style={styles.cancelBtnText}>Back to Bookings</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  successBadge: {
    marginBottom: spacing.md,
  },
  failedBadge: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#EA580C',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    width: '100%',
    marginBottom: spacing.sm,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
