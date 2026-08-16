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
import { ServiceCard } from '../../components/ServiceCard';
import { WorkerSwipeStack } from '../../components/WorkerSwipeStack';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCanonicalWorkerId } from '../../utils/workerUtils';

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
        api.get('/bookings/customer').catch(() => api.get('/bookings/customer/my-bookings')),
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
        setWorkers(wList);
      }

      if (bookingRes.status === 'fulfilled' && bookingRes.value.data) {
        const bList = Array.isArray(bookingRes.value.data)
          ? bookingRes.value.data
          : bookingRes.value.data.bookings || bookingRes.value.data.data || [];
        setRecentBookings(bList.slice(0, 2));
      }
    } catch (err) {
      // Ignore dashboard fetch error safely
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

  const handleSelectWorker = (worker: any) => {
    const canonicalId = getCanonicalWorkerId(worker);
    if (canonicalId) {
      router.push(`/(customer)/worker/${canonicalId}`);
    }
  };

  const handleBookWorker = (worker: any) => {
    const canonicalId = getCanonicalWorkerId(worker);
    if (canonicalId) {
      router.push(`/(customer)/booking/${canonicalId}`);
    }
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
        {/* 1. Header Greeting & Location */}
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

        {/* 2. Search / Categories Quick Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(customer)/services')}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.searchPlaceholder}>Search plumbers, electricians, cleaners...</Text>
          <View style={styles.filterChip}>
            <Ionicons name="options-outline" size={16} color={colors.textPrimary} />
          </View>
        </TouchableOpacity>

        {/* 3. Horizontal Categories Slider */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Services & Categories</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/services')}>
            <Text style={styles.seeAllText}>Explore All</Text>
          </TouchableOpacity>
        </View>

        {loading && categories.length === 0 ? (
          <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: spacing.md }} />
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
                onPress={() => router.push('/(customer)/services')}
              />
            ))}
          </ScrollView>
        )}

        {/* 4. Featured Promotional Card */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <View style={styles.promoTag}>
              <Text style={styles.promoTagText}>HYPERLOCAL GUARANTEE</Text>
            </View>
            <Text style={styles.promoTitle}>Verified Professionals at Your Doorstep</Text>
            <Text style={styles.promoSub}>Swipe to discover top-rated experts in your neighborhood</Text>
          </View>
          <View style={styles.promoIconBox}>
            <Ionicons name="shield-checkmark" size={44} color={colors.primaryDark} />
          </View>
        </View>

        {/* 5. TINDER-STYLE WORKER CARD SLIDER */}
        <View style={styles.tinderSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Top Professionals</Text>
              <Text style={styles.sectionSubtitle}>Swipe right to shortlist, left to pass</Text>
            </View>
          </View>

          {loading && workers.length === 0 ? (
            <View style={styles.loaderArea}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loaderText}>Finding top professionals nearby...</Text>
            </View>
          ) : workers.length > 0 ? (
            <WorkerSwipeStack
              workers={workers}
              onSelectWorker={handleSelectWorker}
              onBookWorker={handleBookWorker}
            />
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No available verified workers found right now.</Text>
            </View>
          )}
        </View>

        {/* 6. Recent Active Bookings */}
        {recentBookings.length > 0 && (
          <View style={styles.recentBookingContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Booking</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/bookings')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.recentBookingCard}
              onPress={() => router.push(`/(customer)/booking/details/${recentBookings[0]._id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.recentBookingRow}>
                <View style={styles.bookingIconBox}>
                  <Ionicons name="calendar-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.recentBookingTitle}>
                    {recentBookings[0].serviceCategoryName || 'Home Service Request'}
                  </Text>
                  <Text style={styles.recentBookingSub}>
                    {new Date(recentBookings[0].bookingDate || recentBookings[0].scheduledStart || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.recentBookingStatus}>{recentBookings[0].status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 7. Footer Note */}
        <View style={styles.footerNote}>
          <Ionicons name="sparkles" size={16} color={colors.accent} />
          <Text style={styles.footerNoteText}>
            100% Background-Checked Professionals • Safe & Secure Payments
          </Text>
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
    marginBottom: 4,
    gap: 4,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  filterChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBanner: {
    marginHorizontal: spacing.lg,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.lg,
  },
  promoContent: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  promoTag: {
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginBottom: 6,
  },
  promoTagText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.textInverted,
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  promoSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  promoIconBox: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  categoryScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tinderSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  loaderArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loaderText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  recentBookingContainer: {
    paddingTop: spacing.xs,
  },
  recentBookingCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  recentBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentLight,
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
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  recentBookingStatus: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
