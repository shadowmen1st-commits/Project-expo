import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileAvatar from '../../components/ProfileAvatar';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { storage } from '../../utils/storage';
import { WorkerLocationService } from '../../utils/WorkerLocationService';

export default function WorkerDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [isAvailable, setIsAvailable] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [assignedJobs, setAssignedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkerData = useCallback(async () => {
    try {
      const [profRes, jobRes] = await Promise.allSettled([
        api.get('/v1/worker/verification'),
        api.get('/bookings/worker').catch(() => api.get('/bookings/worker/my-jobs'))
      ]);

      if (profRes.status === 'fulfilled' && profRes.value.data) {
        setProfile(profRes.value.data.profile || profRes.value.data);
      }

      if (jobRes.status === 'fulfilled' && jobRes.value.data) {
        const list = Array.isArray(jobRes.value.data)
          ? jobRes.value.data
          : jobRes.value.data.jobs || jobRes.value.data.data || [];
        setAssignedJobs(list);

        // Synchronize background location tracking for any active job
        const token = await storage.getItem('accessToken');
        if (token && user?._id) {
          WorkerLocationService.syncWorkerTracking(list, token, user._id);
        }
      }
    } catch (err) {
      console.error('Failed fetching worker dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchWorkerData();
  }, [fetchWorkerData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkerData();
  };

  const verificationStatus = profile?.verificationStatus || 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
      >
        {/* Worker Header Banner */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Pro Portal 👋</Text>
            <Text style={styles.greetingTitle}>{user?.name || 'Worker Pro'}</Text>
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
              <Text style={styles.verifBtnText}>View KYC</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>₹{profile?.totalEarnings || 14500}</Text>
            <Text style={styles.statLbl}>Total Earnings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{assignedJobs.length || 8}</Text>
            <Text style={styles.statLbl}>Total Jobs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>4.9 ★</Text>
            <Text style={styles.statLbl}>Rating</Text>
          </View>
        </View>

        {/* Assigned Jobs Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Jobs</Text>
          <TouchableOpacity onPress={() => router.push('/(worker)/bookings')}>
            <Text style={styles.seeAllText}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#EA580C" style={{ marginVertical: 20 }} />
        ) : assignedJobs.length > 0 ? (
          assignedJobs.slice(0, 3).map((job) => (
            <TouchableOpacity
              key={job._id}
              style={styles.jobCard}
              onPress={() => router.push('/(worker)/bookings')}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.jobCategory}>{job.serviceCategoryName || 'Service Request'}</Text>
                <Badge status={job.status} />
              </View>
              <Text style={styles.jobAddress} numberOfLines={1}>
                📍 {job.address || 'Customer Location'}
              </Text>
              <View style={styles.jobFooter}>
                <Text style={styles.jobPrice}>₹{job.totalAmount || 600}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {['CONFIRMED', 'IN_PROGRESS', 'PAID', 'WORKER_EN_ROUTE', 'STARTED'].includes(job.status) && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/(worker)/tracking/${job._id || job.id}` as any);
                      }}
                      style={{
                        backgroundColor: '#EA580C',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>GPS Share</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.jobTime}>
                    {new Date(job.bookingDate || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyText}>No assigned jobs right now.</Text>
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
    alignItems: 'center'
  },
  jobCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
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
    color: '#64748B',
    fontSize: 14,
    marginTop: 8
  }
});
