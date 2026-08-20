import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileAvatar from '../../components/ProfileAvatar';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api, { SOCKET_BASE_URL } from '../../config/api';
import { storage } from '../../utils/storage';
import { WorkerLocationService } from '../../utils/WorkerLocationService';
import { io, Socket } from 'socket.io-client';

export default function WorkerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    displayName,
    city,
    state,
    latitude,
    longitude,
    loading: locationLoading,
    error: locationError,
    refreshLocation,
  } = useLocationContext();

  const [isAvailable, setIsAvailable] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [assignedJobs, setAssignedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const workerId = user?._id || user?.id || (user as any)?.userId;

  const fetchWorkerData = useCallback(async () => {
    console.log('[WORKER_DASHBOARD_START]', { timestamp: new Date().toISOString() });
    console.log('[WORKER_ID_RESOLVED]', { workerId, email: user?.email, role: user?.role });

    try {
      console.log('[WORKER_BOOKINGS_REQUEST] endpoint=/bookings/worker');

      const [profRes, jobRes, walletRes] = await Promise.allSettled([
        api.get('/v1/worker/verification').catch(() => null),
        api.get('/bookings/worker').catch(async () => {
          return api.get('/bookings');
        }),
        api.get('/wallet/details').catch(async () => {
          return api.get('/v1/wallet/details');
        })
      ]);

      if (profRes.status === 'fulfilled' && profRes.value?.data) {
        setProfile(profRes.value.data.profile || profRes.value.data);
      }

      if (jobRes.status === 'fulfilled' && jobRes.value?.data) {
        const raw = jobRes.value.data;
        const list = Array.isArray(raw)
          ? raw
          : raw.bookings || raw.jobs || raw.data || [];
        
        console.log('[WORKER_BOOKINGS_RESPONSE]', { count: list.length });
        setAssignedJobs(list);

        // Synchronize background location tracking for any active job
        const token = await storage.getItem('accessToken');
        if (token && workerId) {
          WorkerLocationService.syncWorkerTracking(list, token, workerId);
        }
      } else {
        console.warn('[WORKER_BOOKINGS_ERROR] Failed resolving bookings', (jobRes as any).reason);
      }

      if (walletRes.status === 'fulfilled' && walletRes.value?.data) {
        setWallet(walletRes.value.data);
      }
    } catch (err: any) {
      console.error('[WORKER_DASHBOARD_ERROR]', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workerId, user?.email, user?.role]);

  // Synchronize Worker Real GPS location to backend
  useEffect(() => {
    if (latitude && longitude && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      api.post('/worker/location', {
        latitude,
        longitude,
        city: displayName || city || undefined,
        state: state || undefined,
      }).catch((err) => {
        console.log('[WORKER_LOCATION_SYNC_FAIL]', err?.message);
      });
    }
  }, [latitude, longitude, displayName, city, state]);

  // Screen focus auto-refresh
  useFocusEffect(
    useCallback(() => {
      fetchWorkerData();
    }, [fetchWorkerData])
  );

  // Setup real-time socket updates
  useEffect(() => {
    let socket: Socket | null = null;
    const setupSocket = async () => {
      const token = await storage.getItem('accessToken');
      if (!token) return;

      try {
        socket = io(SOCKET_BASE_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
          console.log('[WORKER_SOCKET_CONNECTED]', { id: socket?.id, workerId });
        });

        socket.on('booking:created', (data) => {
          console.log('[WORKER_SOCKET_BOOKING_CREATED]', data?.bookingNumber || data?.id);
          fetchWorkerData();
        });

        socket.on('booking:updated', (data) => {
          console.log('[WORKER_SOCKET_BOOKING_UPDATED]', data?.bookingNumber || data?.id);
          fetchWorkerData();
        });

        socket.on('notification', () => {
          fetchWorkerData();
        });

        socketRef.current = socket;
      } catch (e) {
        console.warn('[WORKER_SOCKET_SETUP_ERROR]', e);
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [workerId, fetchWorkerData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshLocation(true);
    fetchWorkerData();
  };

  const verificationStatus = profile?.verificationStatus || user?.verificationStatus || 'NOT_SUBMITTED';

  // Calculate real earnings from wallet or completed bookings
  const completedJobs = assignedJobs.filter((j) => (j.bookingStatus || j.status) === 'COMPLETED');
  const fallbackEarnings = completedJobs.reduce((sum, j) => sum + (j.workerEarning || j.totalAmount || 0), 0);
  const totalEarningsVal = wallet?.balances?.totalEarned != null
    ? (wallet.balances.totalEarned / 100).toFixed(0)
    : fallbackEarnings.toFixed(0);

  const ratingVal = profile?.averageRating != null
    ? Number(profile.averageRating).toFixed(1)
    : '5.0';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
      >
        {/* Worker Header Banner with Real GPS Location */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Real-time Location Pill */}
            <View style={styles.locationPill}>
              {locationLoading ? (
                <>
                  <ActivityIndicator size="small" color="#EA580C" style={{ transform: [{ scale: 0.75 }], marginRight: 2 }} />
                  <Text style={styles.locationText}>Detecting your location...</Text>
                </>
              ) : locationError ? (
                <>
                  <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
                  <Text style={[styles.locationText, { color: '#EF4444' }]}>Location Unavailable</Text>
                  <TouchableOpacity
                    onPress={() => refreshLocation(true)}
                    style={styles.locationRefreshBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="refresh-outline" size={13} color="#EF4444" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="location-sharp" size={13} color="#EA580C" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {displayName || city || 'Current Location'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => refreshLocation(true)}
                    style={styles.locationRefreshBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="refresh-outline" size={13} color="#EA580C" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={styles.greetingTitle}>{user?.name || 'Worker Pro'}</Text>
            <Text style={styles.greetingSub}>Pro Portal 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(worker)/profile')}>
            <ProfileAvatar user={user} size="lg" showBadge />
          </TouchableOpacity>
        </View>

        {/* Availability Toggle Box */}
        <View style={styles.availabilityCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.availTitle}>
              {isAvailable ? '🟢 Online & Available' : '🔴 Offline'}
            </Text>
            <Text style={styles.availSub}>
              {isAvailable
                ? 'You are visible to customers for instant bookings'
                : 'Turn online to receive new service requests'}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
            thumbColor={isAvailable ? '#EA580C' : '#F1F5F9'}
          />
        </View>

        {/* Verification Status Card */}
        <View style={styles.verificationCard}>
          <View style={styles.verifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifLabel}>KYC Verification Status</Text>
              <View style={{ marginTop: 4 }}>
                <Badge status={verificationStatus} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.verifBtn}
              onPress={() => router.push('/(worker)/profile')}
            >
              <Text style={styles.verifBtnText}>
                {verificationStatus === 'APPROVED'
                  ? 'View KYC'
                  : ['PENDING_APPROVAL', 'UNDER_REVIEW', 'SUBMITTED'].includes(verificationStatus)
                  ? 'View Status'
                  : verificationStatus === 'REJECTED'
                  ? 'Resubmit KYC'
                  : 'Complete KYC'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => router.push('/(worker)/earnings')}>
            <Text style={styles.statVal}>₹{totalEarningsVal}</Text>
            <Text style={styles.statLbl}>Total Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => router.push('/(worker)/bookings')}>
            <Text style={styles.statVal}>{assignedJobs.length}</Text>
            <Text style={styles.statLbl}>Total Jobs</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{ratingVal} ★</Text>
            <Text style={styles.statLbl}>Rating</Text>
          </View>
        </View>

        {/* Assigned Jobs Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Jobs</Text>
          <TouchableOpacity onPress={() => router.push('/(worker)/bookings')}>
            <Text style={styles.seeAllText}>Manage All ({assignedJobs.length})</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#EA580C" style={{ marginVertical: 20 }} />
        ) : assignedJobs.length > 0 ? (
          assignedJobs.slice(0, 5).map((job) => {
            const currentStatus = job.bookingStatus || job.status || 'PENDING';
            const categoryTitle = job.category?.name || job.serviceCategoryName || job.categoryName || 'Service Request';
            const customerTitle = job.customer?.name || job.customerName || 'Customer';
            const addressTitle = job.serviceAddress || job.addressSnapshot?.addressLine || job.address || 'Customer Location';
            const priceVal = job.workerEarning || job.totalAmount || 0;
            const dateStr = job.bookingDate || (job.scheduledStart ? new Date(job.scheduledStart).toLocaleDateString() : 'Scheduled');
            const timeStr = job.bookingTime || '';
            const isActive = ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'STARTED', 'IN_PROGRESS'].includes(currentStatus);

            return (
              <TouchableOpacity
                key={job.id || job._id}
                style={styles.jobCard}
                onPress={() => router.push('/(worker)/bookings')}
                activeOpacity={0.7}
              >
                <View style={styles.jobHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.jobCategory} numberOfLines={1}>{categoryTitle}</Text>
                    <Text style={styles.jobCustomer}>{customerTitle}</Text>
                  </View>
                  <Badge status={currentStatus} />
                </View>
                <Text style={styles.jobAddress} numberOfLines={1}>
                  📍 {addressTitle}
                </Text>
                <View style={styles.jobFooter}>
                  <Text style={styles.jobPrice}>₹{priceVal}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/(worker)/tracking/${job.id || job._id}` as any);
                        }}
                        style={styles.gpsShareBtn}
                      >
                        <Ionicons name="navigate" size={11} color="#FFFFFF" />
                        <Text style={styles.gpsShareText}>Live GPS</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.jobTime}>
                      {dateStr} {timeStr}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyText}>No assigned jobs right now.</Text>
            <Text style={styles.emptySubText}>New customer bookings assigned to you will appear here instantly.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  scrollContent: {
    paddingBottom: 110
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    maxWidth: '92%',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
    marginLeft: 4,
    marginRight: 2,
    flexShrink: 1,
  },
  locationRefreshBtn: {
    padding: 2,
    marginLeft: 4,
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500'
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A'
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  availTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  availSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  verificationCard: {
    backgroundColor: '#FFF7ED',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5'
  },
  verifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  verifLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  verifBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  verifBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A'
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C'
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  jobCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  jobCustomer: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  jobAddress: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC'
  },
  jobPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EA580C'
  },
  gpsShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  gpsShareText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  jobTime: {
    fontSize: 12,
    color: '#64748B'
  },
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  emptyText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4
  }
});
