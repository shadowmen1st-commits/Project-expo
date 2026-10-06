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
import { useLocationContext } from '../../context/LocationContext';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { WorkerSwipeStack } from '../../components/WorkerSwipeStack';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCanonicalWorkerId } from '../../utils/workerUtils';
import { formatBookingDateTimeIST } from '../../utils/formatters';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    displayName,
    city,
    loading: locationLoading,
    error: locationError,
    refreshLocation,
    latitude,
    longitude,
  } = useLocationContext();

  const [workers, setWorkers] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const searchParams = latitude && longitude ? { lat: latitude, lng: longitude } : {};
      const [workerRes, bookingRes] = await Promise.allSettled([
        api.get('/workers/search', { params: searchParams }),
        api.get('/bookings/customer')
          .catch(() => api.get('/bookings'))
          .catch(() => api.get('/bookings/customer/my-bookings')),
      ]);

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
  }, [latitude, longitude]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshLocation(true);
    fetchData();
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
      {/* 1. Header Greeting & Dynamic Real GPS Location (FIXED TOP) */}
      <View style={[styles.header, { 
        paddingTop: Math.max(insets.top, 16), 
        backgroundColor: colors.background,
        paddingBottom: 12,
        marginBottom: 0,
        zIndex: 10,
        elevation: 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight
      }]}>
        <View style={styles.headerLeft}>
          <View style={styles.locationPill}>
            {locationLoading ? (
              <>
                <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.75 }], marginRight: 2 }} />
                <Text style={styles.locationText}>Detecting your location...</Text>
              </>
            ) : locationError ? (
              <>
                <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                <Text style={[styles.locationText, { color: colors.error }]}>Location Unavailable</Text>
                <TouchableOpacity
                  onPress={() => refreshLocation(true)}
                  style={styles.locationRefreshBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="refresh-outline" size={13} color={colors.error} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="location-sharp" size={13} color={colors.accent} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {displayName || city || 'Current Location'}
                </Text>
                <TouchableOpacity
                  onPress={() => refreshLocation(true)}
                  style={styles.locationRefreshBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="refresh-outline" size={13} color={colors.accent} />
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.greetingTitle}>
            SHADOWMEN
          </Text>
        </View>

        {user ? (
          <TouchableOpacity onPress={() => router.push('/(customer)/profile')} activeOpacity={0.8}>
            <ProfileAvatar user={user} size="lg" showBadge />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            style={styles.signInHeaderBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
            <Text style={styles.signInHeaderBtnText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
        }
      >
        {/* 2. Search / Quick Bar */}
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

        {/* 3. TOP PROFESSIONAL HORIZONTAL SWIPE CAROUSEL (First in content order) */}
        <View style={styles.tinderSection}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Top Professionals</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                  <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                </View>
              </View>
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
    maxWidth: 220,
  },
  locationRefreshBtn: {
    marginLeft: 4,
    padding: 2,
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
  tinderSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.success,
    letterSpacing: 0.3,
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
    lineHeight: 16,
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
  signInHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  signInHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
