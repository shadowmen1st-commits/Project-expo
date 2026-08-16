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

  const [metrics, setMetrics] = useState<any>(null);
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    setError(null);
    try {
      const [analyticsRes, pendingRes, bookingsRes] = await Promise.allSettled([
        api.get('/admin/analytics'),
        api.get('/admin/workers/pending'),
        api.get('/bookings')
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.metrics) {
        setMetrics(analyticsRes.value.data.metrics);
      }

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data) {
        const list = Array.isArray(pendingRes.value.data)
          ? pendingRes.value.data
          : pendingRes.value.data.data || pendingRes.value.data.workers || [];
        setPendingWorkers(list);
      }

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.data) {
        const bList = Array.isArray(bookingsRes.value.data)
          ? bookingsRes.value.data
          : bookingsRes.value.data.bookings || bookingsRes.value.data.data || [];
        setRecentBookings(bList.slice(0, 5));
      }
    } catch (err: any) {
      console.error('Failed fetching admin dashboard data:', err);
      setError('Unable to load live dashboard metrics.');
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

  const totalUsers = (metrics?.totalCustomers || 0) + (metrics?.totalWorkers || 0);
  const totalBookings =
    (metrics?.activeBookings || 0) +
    (metrics?.completedBookings || 0) +
    (metrics?.cancelledBookings || 0);
  const revenuePaise = metrics?.grossBookingValue || 0;
  const revenueRupees = (revenuePaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

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

        {/* Live Overview Stats Cards */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(admin)/users')}>
            <Ionicons name="people-outline" size={24} color="#EA580C" />
            <Text style={styles.statVal}>{loading && !metrics ? '...' : totalUsers}</Text>
            <Text style={styles.statLbl}>Total Users ({metrics?.totalCustomers || 0}C / {metrics?.totalWorkers || 0}W)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(admin)/workers')}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#16A34A" />
            <Text style={styles.statVal}>{loading && !metrics ? '...' : metrics?.totalWorkers || 0}</Text>
            <Text style={styles.statLbl}>Verified Pros</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(admin)/bookings')}>
            <Ionicons name="calendar-outline" size={24} color="#2563EB" />
            <Text style={styles.statVal}>{loading && !metrics ? '...' : totalBookings}</Text>
            <Text style={styles.statLbl}>Total Bookings ({metrics?.activeBookings || 0} Active)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(admin)/workers')}>
            <Ionicons name="time-outline" size={24} color="#D97706" />
            <Text style={styles.statVal}>
              {loading && !metrics ? '...' : metrics?.pendingApprovals ?? pendingWorkers.length}
            </Text>
            <Text style={styles.statLbl}>Pending KYC</Text>
          </TouchableOpacity>
        </View>

        {/* Revenue Summary Banner */}
        <View style={styles.revenueBanner}>
          <View>
            <Text style={styles.revenueLabel}>Gross Booking Value</Text>
            <Text style={styles.revenueAmount}>₹{revenueRupees}</Text>
          </View>
          <View style={styles.commissionPill}>
            <Ionicons name="trending-up" size={14} color="#16A34A" />
            <Text style={styles.commissionText}>
              Platform Comm: ₹{((metrics?.platformCommission || 0) / 100).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Quick Admin Navigation Grid */}
        <View style={styles.quickNavGrid}>
          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(admin)/bookings')}>
            <View style={[styles.navIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="list" size={20} color="#2563EB" />
            </View>
            <Text style={styles.navText}>Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(admin)/workers')}>
            <View style={[styles.navIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
            </View>
            <Text style={styles.navText}>Workers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(admin)/users')}>
            <View style={[styles.navIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="people" size={20} color="#EA580C" />
            </View>
            <Text style={styles.navText}>Users</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(admin)/services')}>
            <View style={[styles.navIconBox, { backgroundColor: '#FDF4FF' }]}>
              <Ionicons name="grid" size={20} color="#9333EA" />
            </View>
            <Text style={styles.navText}>Services</Text>
          </TouchableOpacity>
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
            <View key={pw._id || pw.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <ProfileAvatar user={pw.userId || pw} size="md" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>
                    {pw.userId?.name || pw.fullName || pw.name || 'Worker Applicant'}
                  </Text>
                  <Text style={styles.itemSub}>{pw.categoryName || 'General Services'}</Text>
                </View>
                <Badge status={pw.verificationStatus || 'PENDING_APPROVAL'} size="sm" />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={36} color="#16A34A" />
            <Text style={styles.emptyText}>All worker KYC applications are reviewed!</Text>
          </View>
        )}

        {/* Recent Live Bookings */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/bookings')}>
            <Text style={styles.seeAllText}>View All ({totalBookings})</Text>
          </TouchableOpacity>
        </View>

        {recentBookings.length > 0 ? (
          recentBookings.slice(0, 3).map((b) => (
            <View key={b.id || b._id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {b.category?.name || b.serviceCategoryName || 'Service Booking'}
                  </Text>
                  <Text style={styles.itemSub}>
                    Customer: {b.customer?.name || b.customerName || 'Customer'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge status={b.bookingStatus || b.status} size="sm" />
                  <Text style={[styles.itemSub, { marginTop: 4, fontWeight: '700', color: '#0F172A' }]}>
                    ₹{typeof b.totalAmount === 'number' ? b.totalAmount : (b.totalAmountPaise ? b.totalAmountPaise / 100 : 500)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={36} color="#64748B" />
            <Text style={[styles.emptyText, { color: '#64748B' }]}>No bookings found in platform database.</Text>
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
  },
  revenueBanner: {
    backgroundColor: '#0F172A',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  revenueLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600'
  },
  revenueAmount: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
    marginTop: 2
  },
  commissionPill: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20
  },
  commissionText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4
  },
  quickNavGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8
  },
  quickNavItem: {
    alignItems: 'center',
    width: '22%'
  },
  navIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  navText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  }
});
