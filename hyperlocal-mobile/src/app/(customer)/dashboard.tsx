import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { WorkerCard } from '../../components/WorkerCard';
import { ServiceCard } from '../../components/ServiceCard';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        api.get('/bookings/customer/my-bookings'),
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

  const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 16) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
        }
      >
        {/* User Greeting Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.locationPill}>
              <Ionicons name="location-sharp" size={12} color={colors.accent} />
              <Text style={styles.locationText}>Indiranagar, Bengaluru</Text>
            </View>
            <Text style={styles.greetingTitle}>Hello, {user?.name?.split(' ')[0] || 'Customer'} 👋</Text>
          </View>

          <TouchableOpacity onPress={() => router.push('/(customer)/profile')} activeOpacity={0.8}>
            <ProfileAvatar user={user} size="lg" showBadge />
          </TouchableOpacity>
        </View>

        {/* Quick Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(customer)/workers')}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.searchPlaceholder}>Search plumbers, electricians, cleaners...</Text>
          <View style={styles.filterChip}>
            <Ionicons name="options-outline" size={16} color={colors.textPrimary} />
          </View>
        </TouchableOpacity>

        {/* Promotional Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <View style={styles.promoTag}>
              <Text style={styles.promoTagText}>HYPERLOCAL GUARANTEE</Text>
            </View>
            <Text style={styles.promoTitle}>Verified Professionals at Your Doorstep</Text>
            <Text style={styles.promoSub}>Up to ₹500 off on first home service booking</Text>
          </View>
          <View style={styles.promoIconBox}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primaryDark} />
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/services')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: spacing.xl }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {(categories.length > 0
              ? categories
              : [
                  { _id: '1', name: 'Cleaning' },
                  { _id: '2', name: 'Electrician' },
                  { _id: '3', name: 'Plumber' },
                  { _id: '4', name: 'Carpenter' },
                ]
            ).map((cat) => (
              <ServiceCard
                key={cat._id || cat.id}
                name={cat.name}
                icon={getCategoryIcon(cat.name)}
                onPress={() => router.push(`/(customer)/workers?category=${cat._id || cat.id}`)}
              />
            ))}
          </ScrollView>
        )}

        {/* Recent Active Bookings Banner */}
        {recentBookings.length > 0 && (
          <View style={styles.recentBookingContainer}>
            <Text style={styles.sectionTitle}>Recent Booking</Text>
            <TouchableOpacity
              style={styles.recentBookingCard}
              onPress={() => router.push(`/(customer)/booking/details/${recentBookings[0]._id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.recentBookingRow}>
                <View style={styles.bookingIconBox}>
                  <Ionicons name="time-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.recentBookingTitle}>
                    {recentBookings[0].serviceCategoryName || 'Home Service Request'}
                  </Text>
                  <Text style={styles.recentBookingSub}>
                    {new Date(recentBookings[0].bookingDate || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.recentBookingStatus}>{recentBookings[0].status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Top Verified Workers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Verified Pros</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/workers')}>
            <Text style={styles.seeAllText}>Explore All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.workerListContainer}>
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: spacing.xl }} />
          ) : workers.length > 0 ? (
            workers.map((w) => (
              <WorkerCard
                key={w._id || w.id}
                worker={w}
                onPressProfile={() => router.push(`/(customer)/worker/${w._id || w.id}`)}
                onPressBook={() => router.push(`/(customer)/booking/${w._id || w.id}`)}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No available verified workers at the moment.</Text>
            </View>
          )}
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
    paddingBottom: spacing.xxxl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  locationText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  greetingTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  filterChip: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  promoContent: {
    flex: 1,
  },
  promoTag: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginBottom: spacing.xs,
  },
  promoTagText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  promoTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  promoSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  promoIconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  categoryScrollContent: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    marginBottom: spacing.lg,
  },
  recentBookingContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  recentBookingCard: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  recentBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBookingTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  recentBookingSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  recentBookingStatus: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textInverted,
    textTransform: 'uppercase',
  },
  workerListContainer: {
    paddingHorizontal: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
  },
});
