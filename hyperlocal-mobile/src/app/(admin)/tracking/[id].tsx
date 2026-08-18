import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { MobileHeader } from '../../../components/MobileHeader';
import { AppButton } from '../../../components/AppButton';
import { EmptyState } from '../../../components/EmptyState';
import { ProfileAvatar } from '../../../components/ProfileAvatar';
import Badge from '../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api, { API_BASE_URL } from '../../../config/api';
import { storage } from '../../../utils/storage';
import { colors, spacing, typography, radius, shadows } from '../../../theme';

const { width } = Dimensions.get('window');

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

const estimateEtaMinutes = (distanceKm: number | null): number | null => {
  if (distanceKm === null || distanceKm <= 0) return 1;
  const speedKmh = 25;
  const hours = distanceKm / speedKmh;
  return Math.max(1, Math.round(hours * 60));
};

export default function AdminLiveTrackingScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [workerLocation, setWorkerLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    timestamp?: string | Date;
  } | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState<'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK_ERROR' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [activeFocus, setActiveFocus] = useState<'FIT' | 'WORKER' | 'CUSTOMER'>('FIT');

  const socketRef = useRef<Socket | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTracking = useCallback(async (isSilent = false) => {
    if (!bookingId) return;
    if (!isSilent) setLoading(true);
    setErrorState(null);
    setErrorMessage('');

    try {
      const res = await api.get(`/bookings/${bookingId}/tracking`);
      if (res.data?.success) {
        const b = res.data.booking;
        setBooking(b);

        if (res.data.latestLocation) {
          setWorkerLocation(res.data.latestLocation);
          setLastPingTime(new Date(res.data.latestLocation.timestamp || Date.now()));
        }

        const addr = res.data.addressSnapshot;
        if (addr?.latitude && addr?.longitude) {
          setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
        } else {
          setCustomerCoords({ latitude: 12.9716, longitude: 77.5946 });
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setErrorState('NOT_FOUND');
        setErrorMessage('Tracking information is not available yet.');
      } else if (status === 401 || status === 403) {
        setErrorState('FORBIDDEN');
        setErrorMessage('Admin authorization required.');
      } else {
        setErrorState('NETWORK_ERROR');
        setErrorMessage(err.response?.data?.message || 'Connection lost.');
      }
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  const pollLocation = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await api.get(`/bookings/${bookingId}/location`);
      if (res.data?.success && res.data.location) {
        setWorkerLocation(res.data.location);
        setLastPingTime(new Date(res.data.location.timestamp || Date.now()));
      }
    } catch {
      // Background poll
    }
  }, [bookingId]);

  useEffect(() => {
    fetchTracking();

    let socketInstance: Socket | null = null;
    const initSocket = async () => {
      const socketUrl = API_BASE_URL.replace('/api', '');
      const token = await storage.getItem('accessToken');

      socketInstance = io(socketUrl, {
        auth: { token: token || '' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socketInstance;

      socketInstance.on('connect', () => {
        setSocketConnected(true);
        if (__DEV__) {
          console.log('[MOBILE TRACKING] socket connected', {
            socketId: socketInstance?.id,
            bookingId,
            room: `tracking:${bookingId}`,
          });
        }
        socketInstance?.emit('join_tracking', { bookingId });
      });

      socketInstance.on('disconnect', () => {
        setSocketConnected(false);
        if (__DEV__) {
          console.log('[MOBILE TRACKING] socket disconnected', { bookingId });
        }
      });

      socketInstance.on('location:updated', (payload: any) => {
        if (payload && String(payload.bookingId) === String(bookingId)) {
          if (__DEV__) {
            console.log('[MOBILE TRACKING] location received:', {
              bookingId: payload.bookingId,
              latitude: payload.latitude,
              longitude: payload.longitude,
              heading: payload.heading,
              speed: payload.speed,
              timestamp: payload.timestamp,
            });
          }
          setWorkerLocation({
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
            speed: payload.speed,
            accuracy: payload.accuracy,
            timestamp: payload.timestamp || new Date(),
          });
          setLastPingTime(new Date(payload.timestamp || Date.now()));
        }
      });
    };

    initSocket();

    pollingTimerRef.current = setInterval(() => {
      if (!socketRef.current?.connected) {
        pollLocation();
      }
    }, 8000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (socketInstance) {
        socketInstance.off('location:updated');
        socketInstance.emit('leave_tracking', { bookingId });
        socketInstance.disconnect();
      }
    };
  }, [bookingId, fetchTracking, pollLocation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTracking(true);
  };

  const distanceKm =
    workerLocation && customerCoords
      ? calculateDistanceKm(
          workerLocation.latitude,
          workerLocation.longitude,
          customerCoords.latitude,
          customerCoords.longitude
        )
      : null;

  const etaMinutes = estimateEtaMinutes(distanceKm);

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Admin Live Tracking" showBack />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Connecting to platform GPS telemetry...</Text>
        </View>
      </View>
    );
  }

  if (errorState && !booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Admin Live Tracking" showBack />
        <EmptyState
          icon="navigate-outline"
          title={errorState === 'NOT_FOUND' ? 'Tracking Not Found' : 'Access Denied'}
          description={errorMessage}
          actionTitle="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const worker = booking?.workerId || booking?.worker;
  const customer = booking?.customerId || booking?.customer;
  const status = booking?.bookingStatus || booking?.status || 'PAID';
  const headingDeg = workerLocation?.heading || 0;

  return (
    <View style={styles.container}>
      <MobileHeader title="Admin Live Tracking" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Radar Map Card */}
        <View style={styles.radarCard}>
          {/* Top Bar */}
          <View style={styles.radarHeader}>
            <View style={styles.radarStatBox}>
              <Ionicons name="compass-outline" size={16} color={colors.accent} />
              <View>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>
                  {distanceKm !== null ? `${distanceKm} km` : 'Awaiting GPS'}
                </Text>
              </View>
            </View>

            <View style={styles.radarStatBox}>
              <Ionicons name="time-outline" size={16} color="#10B981" />
              <View>
                <Text style={styles.statLabel}>ETA</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {etaMinutes !== null ? `~${etaMinutes} mins` : 'Calculating'}
                </Text>
              </View>
            </View>

            <View style={styles.radarStatBox}>
              <Ionicons name="speedometer-outline" size={16} color="#38BDF8" />
              <View>
                <Text style={styles.statLabel}>Speed</Text>
                <Text style={[styles.statValue, { color: '#38BDF8' }]}>
                  {workerLocation?.speed ? (workerLocation.speed * 3.6).toFixed(1) : '0'} km/h
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Route Track Track */}
          <View style={styles.routeContainer}>
            <View style={styles.trackLine} />

            {/* Worker Pin */}
            <View style={styles.pinWrapper}>
              <View
                style={[
                  styles.pinCircle,
                  {
                    backgroundColor: colors.accent,
                    transform: [{ rotate: `${headingDeg}deg` }],
                  },
                ]}
              >
                <Ionicons name="car-sport" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.pinLabel}>Worker Pin</Text>
              {workerLocation ? (
                <Text style={styles.coordsText}>
                  {workerLocation.latitude.toFixed(3)}, {workerLocation.longitude.toFixed(3)}
                </Text>
              ) : (
                <Text style={[styles.coordsText, { color: '#F59E0B' }]}>Waiting for professional location...</Text>
              )}
            </View>

            {/* Signal Pulse */}
            <View style={styles.pulseWrapper}>
              <Ionicons name="radio" size={22} color="#FBBF24" />
            </View>

            {/* Destination Pin */}
            <View style={styles.pinWrapper}>
              <View style={[styles.pinCircle, { backgroundColor: '#10B981' }]}>
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.pinLabel}>Customer</Text>
              {customerCoords && (
                <Text style={styles.coordsText}>
                  {customerCoords.latitude.toFixed(3)}, {customerCoords.longitude.toFixed(3)}
                </Text>
              )}
            </View>
          </View>

          {/* Map Controls */}
          <View style={styles.mapControlsRow}>
            {(['FIT', 'WORKER', 'CUSTOMER'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.mapCtrlBtn, activeFocus === mode && styles.mapCtrlBtnActive]}
                onPress={() => setActiveFocus(mode)}
              >
                <Text style={[styles.mapCtrlBtnText, activeFocus === mode && styles.mapCtrlBtnTextActive]}>
                  {mode === 'FIT' ? 'Fit Both' : mode === 'WORKER' ? 'Worker Focus' : 'Customer Focus'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Radar Bottom Signal Bar */}
          <View style={styles.radarFooter}>
            <View style={styles.signalStatus}>
              <Ionicons
                name={socketConnected ? 'wifi' : 'wifi-outline'}
                size={14}
                color={socketConnected ? '#10B981' : '#F59E0B'}
              />
              <Text style={[styles.signalText, { color: socketConnected ? '#10B981' : '#F59E0B' }]}>
                {socketConnected ? 'Live Socket Stream (0s)' : 'Polling Fallback (8s)'}
              </Text>
            </View>

            <Text style={styles.lastPingText}>
              Last Ping: {lastPingTime ? lastPingTime.toLocaleTimeString() : 'Awaiting signal'}
            </Text>
          </View>
        </View>

        {/* Booking Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.categoryTitle}>
                {booking?.serviceCategoryId?.name || booking?.category?.name || 'Service Booking'}
              </Text>
              <Text style={styles.bookingNumberText}>
                Booking #{booking?.bookingNumber || String(booking?._id || booking?.id).substring(0, 8)}
              </Text>
            </View>
            <Badge status={status} />
          </View>

          <View style={styles.detailsDivider} />

          {/* Customer Row */}
          <View style={styles.partyRow}>
            <ProfileAvatar user={customer} size="md" />
            <View style={{ flex: 1 }}>
              <Text style={styles.partyRole}>Customer</Text>
              <Text style={styles.partyName}>{customer?.name || 'Customer'}</Text>
              <Text style={styles.partyMeta}>{customer?.phone || customer?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          {/* Worker Row */}
          <View style={styles.partyRow}>
            <ProfileAvatar user={worker} size="md" showBadge />
            <View style={{ flex: 1 }}>
              <Text style={styles.partyRole}>Assigned Worker</Text>
              <Text style={styles.partyName}>{worker?.name || 'Unassigned'}</Text>
              <Text style={styles.partyMeta}>{worker?.phone || worker?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          {/* Address */}
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={18} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={styles.addressText}>
              {booking?.serviceAddress || booking?.address || 'Customer Location'}
            </Text>
          </View>
        </View>

        {/* Back Action */}
        <AppButton
          title="Back to All Bookings"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: spacing.xs }}
        />
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
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  radarCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  radarStatBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  routeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    position: 'relative',
  },
  trackLine: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: 32,
    height: 3,
    backgroundColor: '#F97316',
    borderRadius: 2,
  },
  pinWrapper: {
    alignItems: 'center',
    zIndex: 2,
  },
  pinCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.md,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: '#E2E8F0',
    marginTop: spacing.xs,
  },
  coordsText: {
    fontSize: 8,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  pulseWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  mapCtrlBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: '#1E293B',
  },
  mapCtrlBtnActive: {
    backgroundColor: colors.accent,
  },
  mapCtrlBtnText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: typography.weights.semibold,
  },
  mapCtrlBtnTextActive: {
    color: '#FFFFFF',
  },
  radarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  signalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signalText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  lastPingText: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  bookingNumberText: {
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partyRole: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  partyMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  addressText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
