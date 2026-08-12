import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function AdminBookingsScreen() {
  const router = useRouter();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState<'AUTH_ERROR' | 'SERVER_ERROR' | null>(null);

  const fetchBookings = useCallback(async () => {
    setErrorState(null);
    try {
      // First attempt to fetch platform bookings via main bookings endpoint
      let res = await api.get('/bookings');
      let list = Array.isArray(res.data) ? res.data : res.data?.bookings || res.data?.data || [];
      
      // Fallback to admin analytics overview if /bookings returned empty or different format
      if (!list || list.length === 0) {
        try {
          const analyticsRes = await api.get('/v1/admin/analytics/overview');
          if (analyticsRes.data?.recentBookings) {
            list = analyticsRes.data.recentBookings;
          }
        } catch {
          // Ignore fallback error
        }
      }

      setBookings(list);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setErrorState('AUTH_ERROR');
      } else {
        setErrorState('SERVER_ERROR');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="All Platform Bookings" showBack />

      {loading && !refreshing ? (
        <LoadingState message="Fetching all platform bookings..." />
      ) : errorState === 'AUTH_ERROR' ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Access Restricted"
          description="Admin authorization is required to view platform bookings."
          actionTitle="Sign In as Admin"
          onAction={() => router.replace('/(auth)/login')}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Platform Bookings"
              description="There are currently no bookings placed across the platform."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.categoryTitle}>
                  {item.serviceCategoryName || item.categoryName || 'Service Booking'}
                </Text>
                <Badge status={item.status} />
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  Customer: {item.customerId?.name || item.customerName || 'Customer'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  Worker: {item.workerId?.name || item.workerName || 'Assigned Worker'}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  ₹{item.totalAmount || item.estimatedPrice || 500}
                </Text>
                <Text style={styles.dateText}>
                  {new Date(item.bookingDate || Date.now()).toLocaleDateString()}
                </Text>
              </View>
            </View>
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
  detailRow: {
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
  dateText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
