import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function CustomerBookingsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState<'AUTH_EXPIRED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchBookings = useCallback(async () => {
    setErrorState(null);
    setErrorMessage('');
    try {
      if (__DEV__) console.log('AUTH: Fetching customer bookings, user:', user?.email);
      const res = await api.get('/bookings/customer').catch(() => api.get('/bookings/customer/my-bookings'));
      const data = Array.isArray(res.data) ? res.data : res.data?.bookings || res.data?.data || [];
      setBookings(data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setErrorState('AUTH_EXPIRED');
        setErrorMessage('Your session has expired. Please sign in again.');
      } else if (!err.response) {
        setErrorState('NETWORK_ERROR');
        setErrorMessage('Unable to connect to the server. Please check your internet connection.');
      } else {
        setErrorState('SERVER_ERROR');
        setErrorMessage(err.response?.data?.message || 'Failed to fetch bookings.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  // CRITICAL: Do NOT fetch bookings until auth has finished loading AND user is set.
  // Without this guard, the request fires before the accessToken is in storage.
  useEffect(() => {
    if (authLoading) return;       // Auth restoration in progress — wait
    if (!user) {
      // Not authenticated — redirect to login
      router.replace('/(auth)/login');
      return;
    }
    fetchBookings();
  }, [authLoading, user?._id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') return ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CONFIRMED'].includes(b.status);
    if (activeTab === 'COMPLETED') return b.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(b.status);
    return true;
  });

  // Show loading while auth is still initializing
  if (authLoading) {
    return <LoadingState message="Verifying authentication..." />;
  }

  return (
    <View style={styles.container}>
      <MobileHeader title="My Bookings" showBack={false} />

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Fetching your booking history..." />
      ) : errorState === 'AUTH_EXPIRED' ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Session Expired"
          description={errorMessage}
          actionTitle="Sign In Again"
          onAction={() => router.replace('/(auth)/login')}
        />
      ) : errorState === 'NETWORK_ERROR' || errorState === 'SERVER_ERROR' ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Connection Error"
          description={errorMessage}
          actionTitle="Try Again"
          onAction={fetchBookings}
        />
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Bookings Found"
              description="You don't have any bookings matching this filter status yet."
              actionTitle="Book a Pro"
              onAction={() => router.push('/(customer)/workers')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(customer)/booking/details/${item._id || item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.categoryTitle}>
                  {item.serviceCategoryName || item.categoryName || 'Service Booking'}
                </Text>
                <Badge status={item.status} />
              </View>

              <View style={styles.detailsRow}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {item.workerId?.name || item.workerName || 'Assigned Professional'}
                </Text>
              </View>

              <View style={styles.detailsRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {new Date(item.bookingDate || Date.now()).toLocaleDateString()} at{' '}
                  {item.startTime || '10:00 AM'} ({item.durationHours || 2} hrs)
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  ₹{item.totalAmount || item.estimatedPrice || 500}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {(item.paymentStatus === 'PAID' || ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'IN_PROGRESS', 'STARTED'].includes(item.status || item.bookingStatus)) && (
                    <TouchableOpacity
                      style={styles.trackingBtn}
                      onPress={() => router.push(`/(customer)/booking/tracking/${item._id || item.id}` as any)}
                    >
                      <Ionicons name="navigate" size={12} color="#10B981" />
                      <Text style={styles.trackingBtnText}>Track Live</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.linkRow}>
                    <Text style={styles.viewDetailsLink}>Details</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  priceText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  trackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  trackingBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#059669',
  },
});
