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
import { MobileHeader } from '../../../../components/MobileHeader';
import { AppButton } from '../../../../components/AppButton';
import { EmptyState } from '../../../../components/EmptyState';
import { ProfileAvatar } from '../../../../components/ProfileAvatar';
import Badge from '../../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api, { API_BASE_URL } from '../../../../config/api';
import { storage } from '../../../../utils/storage';
import { useLocation } from '../../../../hooks/useLocation';
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
  if (distanceKm === null || distanceKm <= 0) return 1;
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

        if (res.data.latestLocation) {
          setWorkerLocation(res.data.latestLocation);
          setLastPingTime(new Date(res.data.latestLocation.timestamp || Date.now()));
        }

        const addr = res.data.addressSnapshot;
        if (addr?.latitude && addr?.longitude) {
          setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
        } else if (deviceLocation) {
          setCustomerCoords({ latitude: deviceLocation.latitude, longitude: deviceLocation.longitude });
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
      if (res.data?.success && res.data.location) {
        setWorkerLocation(res.data.location);
        setLastPingTime(new Date(res.data.location.timestamp || Date.now()));
      }
    } catch {
      // Non-blocking background poll
    }
  }, [bookingId]);

  // ── 3. Lifecycle & Socket.IO ───────────────────────────────────────
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
        socketInstance?.emit('join_tracking', { bookingId });
      });

      socketInstance.on('disconnect', () => {
        setSocketConnected(false);
      });

      socketInstance.on('location:updated', (payload: any) => {
        if (payload && String(payload.bookingId) === String(bookingId)) {
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
        {/* Permission Denied UI */}
        {permissionStatus === 'denied' && (
          <View style={styles.permissionCard}>
            <Ionicons name="location-outline" size={24} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.permissionTitle}>Location Access Required</Text>
              <Text style={styles.permissionSub}>
                Enable device location to get live distance and ETA to your location.
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
                  {distanceKm !== null ? `${distanceKm} km` : 'Locating GPS...'}
                </Text>
              </View>
            </View>

            <View style={styles.radarStatBox}>
              <Ionicons name="time-outline" size={16} color="#10B981" />
              <View>
                <Text style={styles.statLabel}>ETA</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {etaMinutes !== null ? `~${etaMinutes} mins` : 'Calculating...'}
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
              <Text style={styles.pinLabel}>Professional</Text>
              {workerLocation ? (
                <Text style={styles.coordsText}>
                  {workerLocation.latitude.toFixed(3)}, {workerLocation.longitude.toFixed(3)}
                </Text>
              ) : (
                <Text style={[styles.coordsText, { color: '#F59E0B' }]}>
                  Location Signal Unavailable
                </Text>
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
              <Text style={styles.pinLabel}>Your Location</Text>
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
              Last Ping: {lastPingTime ? lastPingTime.toLocaleTimeString() : 'Awaiting signal'}
            </Text>
          </View>
        </View>

        {/* Temporary Signal Unavailable Notice if worker location is null */}
        {!workerLocation && (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
            <Text style={styles.noticeText}>
              Professional location temporarily unavailable. Retrying connection...
            </Text>
          </View>
        )}

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
            <Text style={styles.addressText}>
              {booking?.serviceAddress || booking?.address || 'Customer Service Location'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionGroup}>
          <AppButton
            title="View Booking Details"
            variant="primary"
            onPress={() => router.push(`/(customer)/booking/details/${bookingId}` as any)}
          />
          <AppButton
            title="Back to Bookings"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: spacing.xs }}
          />
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
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.md,
  },
  noticeText: {
    fontSize: typography.sizes.xs,
    color: '#92400E',
    fontWeight: typography.weights.medium,
    flex: 1,
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
    color: colors.accent,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: spacing.xs,
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
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
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
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  addressText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionGroup: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  permissionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#991B1B',
  },
  permissionSub: {
    fontSize: typography.sizes.xs,
    color: '#7F1D1D',
    marginTop: 2,
  },
  enableLocBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  enableLocBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
