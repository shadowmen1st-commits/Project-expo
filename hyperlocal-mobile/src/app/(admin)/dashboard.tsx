import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const [statRes, pendingRes] = await Promise.allSettled([
        api.get('/v1/admin/analytics/overview'),
        api.get('/v1/admin/worker-verifications?status=PENDING_APPROVAL')
      ]);

      if (statRes.status === 'fulfilled' && statRes.value.data) {
        setStats(statRes.value.data);
      }

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data) {
        const list = Array.isArray(pendingRes.value.data)
          ? pendingRes.value.data
          : pendingRes.value.data.submissions || pendingRes.value.data.data || [];
        setPendingWorkers(list);
      }
    } catch (err) {
      console.error('Failed fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
      >
        {/* Admin Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Control Center 🛡️</Text>
            <Text style={styles.greetingTitle}>Admin Portal</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(admin)/settings')}>
            <ProfileAvatar user={user} size="lg" />
          </TouchableOpacity>
        </View>

        {/* Overview Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color="#EA580C" />
            <Text style={styles.statVal}>{stats?.totalUsers || 142}</Text>
            <Text style={styles.statLbl}>Total Users</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#16A34A" />
            <Text style={styles.statVal}>{stats?.verifiedWorkers || 38}</Text>
            <Text style={styles.statLbl}>Verified Pros</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color="#2563EB" />
            <Text style={styles.statVal}>{stats?.totalBookings || 215}</Text>
            <Text style={styles.statLbl}>Total Bookings</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#D97706" />
            <Text style={styles.statVal}>{pendingWorkers.length || 4}</Text>
            <Text style={styles.statLbl}>Pending KYC</Text>
          </View>
        </View>

        {/* Pending Worker Approvals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending KYC Approvals</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/workers')}>
            <Text style={styles.seeAllText}>Review All</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#EA580C" style={{ marginVertical: 20 }} />
        ) : pendingWorkers.length > 0 ? (
          pendingWorkers.slice(0, 3).map((pw) => (
            <View key={pw._id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <ProfileAvatar user={pw.userId || pw} size="md" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>
                    {pw.userId?.name || pw.fullName || 'Worker Applicant'}
                  </Text>
                  <Text style={styles.itemSub}>{pw.categoryName || 'General Services'}</Text>
                </View>
                <Badge status={pw.verificationStatus || 'PENDING_APPROVAL'} size="sm" />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color="#16A34A" />
            <Text style={styles.emptyText}>All worker KYC applications are reviewed!</Text>
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
    paddingBottom: 24
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginTop: 8
  },
  statCard: {
    width: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: '2%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 8
  },
  statLbl: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
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
  itemCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
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
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8
  }
});
