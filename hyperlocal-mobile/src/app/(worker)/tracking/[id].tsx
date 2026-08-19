import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import { MobileHeader } from '../../../components/MobileHeader';
import { AppButton } from '../../../components/AppButton';
import { EmptyState } from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api, { API_BASE_URL, SOCKET_BASE_URL } from '../../../config/api';
import { storage } from '../../../utils/storage';
import { colors, spacing, typography, radius, shadows } from '../../../theme';
import { isValidCoordinate } from '../../../hooks/useLocation';

// Haversine formula to compute distance in KM
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

export default function WorkerLiveTrackingScreen() {
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed?: number | null;
    accuracy?: number | null;
  } | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSharingGps, setIsSharingGps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastBroadcastTime, setLastBroadcastTime] = useState<Date | null>(null);
  const [errorState, setErrorState] = useState<'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK_ERROR' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [pingsCount, setPingsCount] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openURL('app-settings:');
    }
  }, []);

  // ── 1. Fetch Booking Tracking Details ──────────────────────────────
  const fetchBookingInfo = useCallback(async (isSilent = false) => {
    if (!bookingId) return;
    if (!isSilent) setLoading(true);
    setErrorState(null);
    setErrorMessage('');

    try {
      const res = await api.get(`/bookings/${bookingId}/tracking`);
      if (res.data?.success) {
        const b = res.data.booking;
        setBooking(b);

        const addr = res.data.addressSnapshot;
        if (addr && isValidCoordinate(addr.latitude, addr.longitude)) {
          setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
        } else {
          setCustomerCoords(null);
        }

        // If booking is already finished/cancelled, stop GPS tracking
        if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.bookingStatus || b.status)) {
          stopGpsSharing();
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setErrorState('NOT_FOUND');
        setErrorMessage('Booking not found.');
      } else if (status === 401 || status === 403) {
        setErrorState('FORBIDDEN');
        setErrorMessage('You are not authorized to share GPS for this booking.');
      } else {
        setErrorState('NETWORK_ERROR');
        setErrorMessage(err.response?.data?.message || 'Connection lost.');
      }
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  // ── 2. Broadcast Location Helper ────────────────────────────────────
  const sendLocationPing = async (coords: Location.LocationObjectCoords) => {
    if (!isValidCoordinate(coords.latitude, coords.longitude)) {
      console.log('[GPS_REJECTED_INVALID_COORDS]', coords);
      return;
    }

    const payload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading || 0,
      speed: coords.speed || 0,
      accuracy: coords.accuracy || 0,
      timestamp: new Date(),
    };

    console.log('[GPS_UPDATE]', {
      bookingId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      speed: payload.speed,
      timestamp: payload.timestamp,
    });

    setCurrentCoords(payload);
    setLastBroadcastTime(new Date());
    setPingsCount((prev) => prev + 1);

    // 1. Post to REST API
    try {
      await api.post(`/bookings/${bookingId}/location`, payload);
      console.log('[GPS_TELEMETRY_SENT]', {
        bookingId,
        lat: payload.latitude,
        lng: payload.longitude,
        accuracy: payload.accuracy,
      });
    } catch (err: any) {
      console.log('[GPS_TELEMETRY_ERROR]', err?.response?.data || err.message);
    }

    // 2. Emit over Socket.IO
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('location:update', {
        bookingId,
        ...payload,
      });
    }
  };

  // ── 3. Start GPS Watcher ───────────────────────────────────────────
  const startGpsSharing = async () => {
    try {
      console.log('[LOCATION_SERVICES_CHECK]');
      const isGpsEnabled = await Location.hasServicesEnabledAsync();
      console.log('[LOCATION_SERVICES]', { isGpsEnabled });
      if (!isGpsEnabled) {
        Alert.alert(
          'Location / GPS Disabled',
          'Please turn ON Location Services / GPS on your device to share live tracking.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ]
        );
        return;
      }

      console.log('[LOCATION_PERMISSION_REQUEST]');
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      console.log('[LOCATION_PERMISSION_RESULT]', perm.status);

      if (perm.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        Alert.alert(
          'Location Permission Required',
          'Foreground location permission is required for customers to track your live arrival.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings },
          ]
        );
        return;
      }

      setPermissionDenied(false);
      setIsSharingGps(true);
      console.log('[GPS_WATCH_START]', { bookingId });

      // Get initial position immediately
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync().catch(() => null);
      });

      if (initialPos && isValidCoordinate(initialPos.coords.latitude, initialPos.coords.longitude)) {
        await sendLocationPing(initialPos.coords);
      }

      // Watch position continuously (high accuracy, 4s interval, 5m distance)
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (loc) => {
          await sendLocationPing(loc.coords);
        }
      );

      locationSubRef.current = sub;
    } catch (err: any) {
      console.log('[GPS_ERROR]', err?.message);
      Alert.alert('Location Error', err.message || 'Failed to start GPS tracking.');
      setIsSharingGps(false);
    }
  };

  // ── 4. Stop GPS Watcher ────────────────────────────────────────────
  const stopGpsSharing = () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    setIsSharingGps(false);
  };

  // ── 5. Status Transition Action Handler ───────────────────────────
  const [transitionLoading, setTransitionLoading] = useState(false);
  const handleStatusTransition = async (action: 'accept' | 'en-route' | 'start' | 'request-completion') => {
    setTransitionLoading(true);
    try {
      if (action === 'accept') {
        console.log('[WORKER_ACCEPT]', { bookingId });
      } else if (action === 'en-route') {
        console.log('[WORKER_EN_ROUTE]', { bookingId });
      }
      const res = await api.post(`/bookings/${bookingId}/${action}`);
      if (res.data?.success) {
        Alert.alert('Success', `Booking status updated.`);
        fetchBookingInfo(true);
        if (action === 'en-route' && !isSharingGps) {
          startGpsSharing();
        }
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err.response?.data?.message || 'Failed to update booking status.');
    } finally {
      setTransitionLoading(false);
    }
  };

  // ── 6. Lifecycle & Socket.IO ───────────────────────────────────────
  useEffect(() => {
    fetchBookingInfo();

    let socketInstance: Socket | null = null;
    const initSocket = async () => {
      const socketUrl = SOCKET_BASE_URL;
      const token = await storage.getItem('accessToken');

      socketInstance = io(socketUrl, {
        auth: { token: token || '' },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      socketRef.current = socketInstance;

      socketInstance.on('connect', () => {
        setSocketConnected(true);
        socketInstance?.emit('join_tracking', { bookingId });
      });

      socketInstance.on('disconnect', () => {
        setSocketConnected(false);
      });
    };

    initSocket();

    return () => {
      stopGpsSharing();
      if (socketInstance) {
        socketInstance.emit('leave_tracking', { bookingId });
        socketInstance.disconnect();
      }
    };
  }, [bookingId, fetchBookingInfo]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookingInfo(true);
  };

  const distanceKm =
    currentCoords && customerCoords
      ? calculateDistanceKm(
          currentCoords.latitude,
          currentCoords.longitude,
          customerCoords.latitude,
          customerCoords.longitude
        )
      : null;

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <MobileHeader title="GPS Sharing" showBack />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading booking tracking...</Text>
        </View>
      </View>
    );
  }

  if (errorState && !booking) {
    return (
      <View style={styles.container}>
        <MobileHeader title="GPS Sharing" showBack />
        <EmptyState
          icon="navigate-outline"
          title={errorState === 'NOT_FOUND' ? 'Job Not Found' : 'Access Restricted'}
          description={errorMessage}
          actionTitle="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const status = booking?.bookingStatus || booking?.status || 'PAID';

  return (
    <View style={styles.container}>
      <MobileHeader title="Worker GPS Sharing" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* GPS Broadcast Control Card */}
        <View style={[styles.controlCard, isSharingGps && styles.controlCardActive]}>
          <View style={styles.controlHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.controlTitle}>
                {isSharingGps ? '📡 Broadcasting Live GPS' : '🛰️ GPS Sharing Idle'}
              </Text>
              <Text style={styles.controlSub}>
                {isSharingGps
                  ? 'Your real-time physical GPS coordinates are streaming to the customer.'
                  : 'Start live location so customer can see your real arrival on map.'}
              </Text>
            </View>
            <Switch
              value={isSharingGps}
              onValueChange={(val) => (val ? startGpsSharing() : stopGpsSharing())}
              trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
              thumbColor={isSharingGps ? '#EA580C' : '#F1F5F9'}
            />
          </View>

          <View style={styles.detailsDivider} />

          <View style={styles.liveMetricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLbl}>GPS Pings</Text>
              <Text style={styles.metricNum}>{pingsCount}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLbl}>Distance to Client</Text>
              <Text style={styles.metricNum}>
                {distanceKm !== null ? `${distanceKm} km` : customerCoords ? 'Acquiring GPS...' : 'Address Registered'}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLbl}>Socket Link</Text>
              <Text style={[styles.metricNum, { color: socketConnected ? '#10B981' : '#F59E0B' }]}>
                {socketConnected ? 'Connected' : 'Reconnecting'}
              </Text>
            </View>
          </View>
        </View>

        {/* Live Coordinates Card */}
        {currentCoords ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Current Physical GPS Coordinates</Text>
            <View style={styles.coordsRow}>
              <Ionicons name="navigate-circle" size={24} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.coordsValue}>
                  Lat: {currentCoords.latitude.toFixed(6)} | Lon: {currentCoords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.coordsMeta}>
                  Accuracy: ±{currentCoords.accuracy ? Math.round(currentCoords.accuracy) : 5}m | Speed:{' '}
                  {currentCoords.speed ? (currentCoords.speed * 3.6).toFixed(1) : 0} km/h
                </Text>
              </View>
            </View>

            <Text style={styles.pingTimestamp}>
              Last Sent: {lastBroadcastTime ? lastBroadcastTime.toLocaleTimeString() : 'Just now'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Live GPS Signal</Text>
            <View style={styles.waitingGpsRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.waitingGpsText}>
                {isSharingGps ? 'Acquiring fresh device GPS satellite lock...' : 'GPS sharing is currently paused.'}
              </Text>
            </View>
          </View>
        )}

        {/* Customer Destination Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer Service Destination</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={20} color="#10B981" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText}>
                {booking?.serviceAddress || booking?.address || 'Customer Location'}
              </Text>
              {booking?.addressSnapshot?.instructions && (
                <Text style={styles.instructionsText}>
                  Note: {booking.addressSnapshot.instructions}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Booking Status Summary */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Booking Number</Text>
              <Text style={styles.summaryVal}>
                {booking?.bookingNumber || String(booking?._id || booking?.id).substring(0, 8)}
              </Text>
            </View>
            <Badge status={status} />
          </View>
        </View>

        {/* Status Transition Action Buttons */}
        {['PAID', 'CONFIRMED', 'ASSIGNED'].includes(status) && (
          <AppButton
            title="🚗 Start En Route (Share GPS)"
            variant="primary"
            loading={transitionLoading}
            onPress={() => handleStatusTransition('en-route')}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {['WORKER_EN_ROUTE', 'EN_ROUTE', 'ARRIVED'].includes(status) && (
          <AppButton
            title="🛠️ Start Service"
            variant="primary"
            loading={transitionLoading}
            onPress={() => handleStatusTransition('start')}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {['STARTED', 'IN_PROGRESS'].includes(status) && (
          <AppButton
            title="✅ Complete Service"
            variant="primary"
            loading={transitionLoading}
            onPress={() => handleStatusTransition('request-completion')}
            style={{ marginTop: spacing.sm }}
          />
        )}

        {/* GPS Control Button */}
        <AppButton
          title={isSharingGps ? 'Stop Live GPS Sharing' : 'Start Live GPS Sharing'}
          variant={isSharingGps ? 'danger' : 'secondary'}
          onPress={isSharingGps ? stopGpsSharing : startGpsSharing}
          style={{ marginTop: spacing.sm }}
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
  controlCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  controlCardActive: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFDF9',
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  controlTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  controlSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  liveMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricLbl: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metricNum: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
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
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFF7ED',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  coordsValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  coordsMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pingTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  waitingGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  waitingGpsText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  summaryVal: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
