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
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { MobileHeader } from '../../../../components/MobileHeader';
import { AppButton } from '../../../../components/AppButton';
import { EmptyState } from '../../../../components/EmptyState';
import { ProfileAvatar } from '../../../../components/ProfileAvatar';
import Badge from '../../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api, { API_BASE_URL, SOCKET_BASE_URL } from '../../../../config/api';
import { storage } from '../../../../utils/storage';
import { useLocation, isValidCoordinate } from '../../../../hooks/useLocation';
import { colors, spacing, typography, radius, shadows } from '../../../../theme';

const { width } = Dimensions.get('window');

// Haversine formula to compute distance in KM
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in KM
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

// Estimate ETA in minutes (assuming average city driving speed of ~25 km/h)
const estimateEtaMinutes = (distanceKm: number | null): number | null => {
  if (distanceKm === null || distanceKm <= 0) return null;
  const speedKmh = 25;
  const hours = distanceKm / speedKmh;
  return Math.max(1, Math.round(hours * 60));
};

export default function CustomerLiveTrackingScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    location: deviceLocation,
    permissionStatus,
    requestLocation,
    openSettings,
  } = useLocation(true);

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

  // ── 1. Fetch Tracking Info from Backend ─────────────────────────────
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

        if (res.data.latestLocation && isValidCoordinate(res.data.latestLocation.latitude, res.data.latestLocation.longitude)) {
          setWorkerLocation(res.data.latestLocation);
          setLastPingTime(new Date(res.data.latestLocation.timestamp || Date.now()));
        }

        const addr = res.data.addressSnapshot;
        if (addr && isValidCoordinate(addr.latitude, addr.longitude)) {
          setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
        } else if (deviceLocation && isValidCoordinate(deviceLocation.latitude, deviceLocation.longitude)) {
          setCustomerCoords({ latitude: deviceLocation.latitude, longitude: deviceLocation.longitude });
        } else {
          setCustomerCoords(null);
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setErrorState('NOT_FOUND');
        setErrorMessage('Tracking information is not available yet.');
      } else if (status === 401 || status === 403) {
        setErrorState('FORBIDDEN');
        setErrorMessage('You are not authorized to view tracking for this booking.');
      } else {
        setErrorState('NETWORK_ERROR');
        setErrorMessage(err.response?.data?.message || 'Connection lost. Retrying...');
      }
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, deviceLocation]);

  // ── 2. 8-Second Location Fallback Polling ──────────────────────────
  const pollLocation = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await api.get(`/bookings/${bookingId}/location`);
      if (res.data?.success && res.data.location && isValidCoordinate(res.data.location.latitude, res.data.location.longitude)) {
        setWorkerLocation(res.data.location);
        setLastPingTime(new Date(res.data.location.timestamp || Date.now()));
      }
    } catch {
      // Non-blocking background poll
    }
  }, [bookingId]);

  // ── 3. Lifecycle & Socket.IO ───────────────────────────────────────
  useEffect(() => {
    console.log('[TRACKING_SCREEN]', { bookingId });
    fetchTracking();

    let socketInstance: Socket | null = null;
    const initSocket = async () => {
      const socketUrl = SOCKET_BASE_URL;
      const token = await storage.getItem('accessToken');

      console.log('[SOCKET_AUTH]', { hasToken: Boolean(token), socketUrl });

      socketInstance = io(socketUrl, {
        auth: { token: token || '' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socketInstance;

      socketInstance.on('connect', () => {
        console.log('[SOCKET_CONNECT]', { socketId: socketInstance?.id, bookingId });
        setSocketConnected(true);
        console.log('[SOCKET_JOIN]', `tracking:${bookingId}`);
        socketInstance?.emit('join_tracking', { bookingId });
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('[SOCKET_DISCONNECT]', reason);
        setSocketConnected(false);
      });

      socketInstance.on('location:updated', (payload: any) => {
        console.log('[SOCKET_LOCATION_UPDATED]', {
          bookingId: payload?.bookingId,
          latitude: payload?.latitude,
          longitude: payload?.longitude,
          heading: payload?.heading,
          speed: payload?.speed,
        });
        if (payload && String(payload.bookingId) === String(bookingId) && isValidCoordinate(payload.latitude, payload.longitude)) {
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
      pollLocation();
    }, 8000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (socketInstance) {
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
        <MobileHeader title="Live Tracking" showBack />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Connecting to live GPS tracking...</Text>
        </View>
      </View>
    );
  }

  if (errorState && !booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Live Tracking" showBack />
        <EmptyState
          icon={errorState === 'FORBIDDEN' ? 'lock-closed-outline' : 'navigate-outline'}
          title={errorState === 'NOT_FOUND' ? 'Tracking Not Ready' : 'Access Restricted'}
          description={errorMessage}
          actionTitle="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const worker = booking?.workerId || booking?.worker;
  const status = booking?.bookingStatus || booking?.status || 'PAID';
  const headingDeg = workerLocation?.heading || 0;

  return (
    <View style={styles.container}>
      <MobileHeader title="Live Tracking" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Permission Notice */}
        {permissionStatus === 'denied' && (
          <View style={styles.permissionCard}>
            <Ionicons name="location-outline" size={24} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.permissionTitle}>Location Access Required</Text>
              <Text style={styles.permissionSub}>
                Enable device location to get live distance and ETA to your current location.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.enableLocBtn}
              onPress={() => requestLocation({ promptIfDenied: true })}
            >
              <Text style={styles.enableLocBtnText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Radar Map Visualizer Card */}
        <View style={styles.radarCard}>
          {/* Top Status Header */}
          <View style={styles.radarHeader}>
            <View style={styles.radarStatBox}>
              <Ionicons name="compass-outline" size={16} color={colors.accent} />
              <View>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>
                  {distanceKm !== null ? `${distanceKm} km` : workerLocation ? 'Calculating...' : 'Waiting for GPS...'}
                </Text>
              </View>
            </View>

            <View style={styles.radarStatBox}>
              <Ionicons name="time-outline" size={16} color="#10B981" />
              <View>
                <Text style={styles.statLabel}>ETA</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {etaMinutes !== null ? `~${etaMinutes} mins` : workerLocation ? 'Calculating...' : 'Awaiting signal'}
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
                    backgroundColor: workerLocation ? colors.accent : '#94A3B8',
                    transform: [{ rotate: `${headingDeg}deg` }],
                  },
                ]}
              >
                <Ionicons name="car-sport" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.pinLabel}>Professional</Text>
              {workerLocation ? (
                <Text style={styles.coordsText}>
                  {workerLocation.latitude.toFixed(4)}, {workerLocation.longitude.toFixed(4)}
                </Text>
              ) : (
                <Text style={[styles.coordsText, { color: '#F59E0B' }]}>
                  Waiting for worker GPS...
                </Text>
              )}
            </View>

            {/* Signal Pulse */}
            <View style={styles.pulseWrapper}>
              <Ionicons name="radio" size={22} color={workerLocation ? '#10B981' : '#FBBF24'} />
            </View>

            {/* Destination Pin */}
            <View style={styles.pinWrapper}>
              <View style={[styles.pinCircle, { backgroundColor: customerCoords ? '#10B981' : '#94A3B8' }]}>
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.pinLabel}>Your Location</Text>
              {customerCoords ? (
                <Text style={styles.coordsText}>
                  {customerCoords.latitude.toFixed(4)}, {customerCoords.longitude.toFixed(4)}
                </Text>
              ) : (
                <Text style={[styles.coordsText, { color: colors.textMuted }]}>
                  Address Registered
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
                  {mode === 'FIT' ? 'Fit Both' : mode === 'WORKER' ? 'Worker Focus' : 'My Location'}
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
                {socketConnected ? 'Live Socket Stream (Real-Time)' : 'Polling Fallback (8s)'}
              </Text>
            </View>

            <Text style={styles.lastPingText}>
              Last Ping: {lastPingTime ? lastPingTime.toLocaleTimeString() : 'Awaiting worker GPS signal'}
            </Text>
          </View>
        </View>

        {/* Worker Professional Card */}
        <View style={styles.card}>
          <View style={styles.workerRow}>
            <ProfileAvatar user={worker} size="lg" showBadge />
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>{worker?.name || 'Assigned Professional'}</Text>
              <Text style={styles.workerCategory}>
                {booking?.serviceCategoryId?.name || booking?.category?.name || 'Verified Professional'}
              </Text>
              <View style={styles.badgeRow}>
                <Badge status={status} />
              </View>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Payment</Text>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>PAID ✓</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Booking #</Text>
              <Text style={styles.metricVal}>
                {booking?.bookingNumber || String(booking?._id || booking?.id).substring(0, 8)}
              </Text>
            </View>
          </View>
        </View>

        {/* Service Address Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Destination</Text>
          <View style={styles.addressRow}>
            <Ionicons name="map-outline" size={18} color={colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText}>{booking?.serviceAddress || 'Registered Address'}</Text>
              {booking?.addressSnapshot?.instructions && (
                <Text style={styles.instructionsText}>
                  Note: {booking.addressSnapshot.instructions}
                </Text>
              )}
            </View>
          </View>
        </View>
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
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#DC2626',
  },
  permissionSub: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
  },
  enableLocBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  enableLocBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  radarCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  radarStatBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#F8FAFC',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  trackLine: {
    position: 'absolute',
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: '#334155',
    top: '50%',
    zIndex: 0,
  },
  pinWrapper: {
    alignItems: 'center',
    zIndex: 1,
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#F8FAFC',
    marginTop: 6,
  },
  coordsText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pulseWrapper: {
    zIndex: 1,
  },
  mapControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  mapCtrlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#1E293B',
  },
  mapCtrlBtnActive: {
    backgroundColor: colors.accent,
  },
  mapCtrlBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: typography.weights.medium,
  },
  mapCtrlBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  radarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  signalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signalText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  lastPingText: {
    fontSize: 10,
    color: '#64748B',
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
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  workerCategory: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  badgeRow: {
    marginTop: 4,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricVal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  addressText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  instructionsText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
