import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { WorkerCard } from '../../components/WorkerCard';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, workerRes, bookingRes] = await Promise.allSettled([
        api.get('/categories'),
        api.get('/workers/search'),
        api.get('/bookings/customer/my-bookings')
      ]);

      if (catRes.status === 'fulfilled' && catRes.value.data) {
        const cats = Array.isArray(catRes.value.data)
          ? catRes.value.data
          : catRes.value.data.categories || catRes.value.data.data || [];
        setCategories(cats);
      }

      if (workerRes.status === 'fulfilled' && workerRes.value.data) {
        const wList = Array.isArray(workerRes.value.data)
          ? workerRes.value.data
          : workerRes.value.data.workers || workerRes.value.data.data || [];
        setWorkers(wList.slice(0, 5));
      }

      if (bookingRes.status === 'fulfilled' && bookingRes.value.data) {
        const bList = Array.isArray(bookingRes.value.data)
          ? bookingRes.value.data
          : bookingRes.value.data.bookings || bookingRes.value.data.data || [];
        setRecentBookings(bList.slice(0, 2));
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getCategoryIcon = (name: string) => {
    const n = name?.toLowerCase() || '';
    if (n.includes('clean')) return 'sparkles-outline';
    if (n.includes('electric')) return 'flash-outline';
    if (n.includes('plumb')) return 'water-outline';
    if (n.includes('paint')) return 'color-palette-outline';
    if (n.includes('care') || n.includes('nurse')) return 'medical-outline';
    if (n.includes('driver')) return 'car-outline';
    return 'construct-outline';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
      >
        {/* User Greeting Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Hello 👋</Text>
            <Text style={styles.greetingTitle}>{user?.name || 'Customer'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)/profile')}>
            <ProfileAvatar user={user} size="lg" />
          </TouchableOpacity>
        </View>

        {/* Quick Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(customer)/workers')}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <Text style={styles.searchPlaceholder}>Search plumbers, electricians, cleaners...</Text>
        </TouchableOpacity>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Services</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/services')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#EA580C" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.categoryGrid}>
            {(categories.length > 0 ? categories : [
              { _id: '1', name: 'Home Cleaning', slug: 'cleaning' },
              { _id: '2', name: 'Electrician', slug: 'electrician' },
              { _id: '3', name: 'Plumber', slug: 'plumber' },
              { _id: '4', name: 'Caregiver', slug: 'caregiver' }
            ]).slice(0, 4).map((cat) => (
              <TouchableOpacity
                key={cat._id}
                style={styles.categoryCard}
                onPress={() => router.push(`/(customer)/workers?category=${cat._id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconCircle}>
                  <Ionicons name={getCategoryIcon(cat.name) as any} size={24} color="#EA580C" />
                </View>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Active Bookings Banner */}
        {recentBookings.length > 0 ? (
          <View style={styles.recentBookingContainer}>
            <Text style={styles.sectionTitle}>Recent Booking</Text>
            <TouchableOpacity
              style={styles.recentBookingCard}
              onPress={() => router.push(`/(customer)/booking/details/${recentBookings[0]._id}`)}
            >
              <View style={styles.recentBookingRow}>
                <Ionicons name="time-outline" size={24} color="#EA580C" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recentBookingTitle}>
                    {recentBookings[0].serviceCategoryName || 'Service Request'}
                  </Text>
                  <Text style={styles.recentBookingSub}>
                    {new Date(recentBookings[0].bookingDate || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.recentBookingStatus}>{recentBookings[0].status}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Top Verified Workers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Verified Pros</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/workers')}>
            <Text style={styles.seeAllText}>Explore All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#EA580C" style={{ marginVertical: 20 }} />
        ) : workers.length > 0 ? (
          workers.map((w) => (
            <WorkerCard
              key={w._id}
              worker={w}
              onPressProfile={() => router.push(`/(customer)/worker/${w._id}`)}
              onPressBook={() => router.push(`/(customer)/booking/${w._id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No available workers at the moment.</Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  searchPlaceholder: {
    marginLeft: 10,
    color: '#94A3B8',
    fontSize: 14
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14
  },
  categoryCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: '1%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center'
  },
  recentBookingContainer: {
    paddingHorizontal: 20,
    marginTop: 8
  },
  recentBookingCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 14,
    padding: 14
  },
  recentBookingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  recentBookingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  recentBookingSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  recentBookingStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
    textTransform: 'uppercase'
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
    fontSize: 14
  }
});
