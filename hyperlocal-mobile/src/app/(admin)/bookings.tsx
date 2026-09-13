import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import {
  formatBookingDateIST,
  formatBookingDateTimeIST,
  formatBookingAmount,
  isTrackableBookingStatus,
  normalizeBookingStatus,
  resolveBookingId
} from '../../utils/formatters';

const STATUS_FILTERS = [
  'ALL',
  'PAYMENT_PENDING',
  'PAID',
  'CONFIRMED',
  'WORKER_EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
];

const TERMINAL_STATUSES = [
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
];

const TRACKABLE_STATUSES = [
  'PAID',
  'CONFIRMED',
  'ASSIGNED',
  'ACCEPTED',
  'WORKER_EN_ROUTE',
  'EN_ROUTE',
  'ARRIVED',
  'STARTED',
  'IN_PROGRESS'
];

export default function AdminBookingsScreen() {
  const router = useRouter();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [errorState, setErrorState] = useState<'AUTH_ERROR' | 'SERVER_ERROR' | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 400);
  };

  const handleStatusOverride = async (item: any, targetStatus: string) => {
    const bId = resolveBookingId(item);
    if (!bId) return;

    setActionLoadingId(bId);
    try {
      await api.post(`/bookings/${bId}/override`, {
        status: targetStatus,
        reason: `Marked ${targetStatus} by Admin`,
      });
      fetchBookings(true);
    } catch (err: any) {
      // Try fallback route
      try {
        await api.post(`/v1/bookings/${bId}/override`, {
          status: targetStatus,
          reason: `Marked ${targetStatus} by Admin`,
        });
        fetchBookings(true);
      } catch (e: any) {
        // Handle error silently or log
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const fetchBookings = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setErrorState(null);
    try {
      const params: any = { limit: 100 };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      // 1. Fetch from admin specific endpoint
      let res: any = null;
      try {
        res = await api.get('/bookings/admin', { params });
      } catch (adminErr: any) {
        // Handled via fallback
      }

      let rawList: any[] = [];
      if (res && res.data?.success) {
        rawList = res.data.bookings || [];
      } else {
        // Fallback to /bookings general endpoint
        const fallbackRes = await api.get('/bookings', { params });
        rawList = Array.isArray(fallbackRes.data)
          ? fallbackRes.data
          : fallbackRes.data?.bookings || fallbackRes.data?.data || [];
      }

      const sorted = [...rawList].sort((a: any, b: any) => {
        const tA = new Date(a.createdAt || a.updatedAt || a.scheduledStart || 0).getTime();
        const tB = new Date(b.createdAt || b.updatedAt || b.scheduledStart || 0).getTime();
        return tB - tA;
      });

      setBookings(sorted);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setErrorState('AUTH_ERROR');
      } else {
        setErrorState('SERVER_ERROR');
      }
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="All Platform Bookings" showBack />

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by booking #, customer, worker, ID..."
          placeholderTextColor={colors.textMuted}
          value={searchTerm}
          onChangeText={handleSearchChange}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {STATUS_FILTERS.map((st) => {
            const isSelected = selectedStatus === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setSelectedStatus(st)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {st.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bookings List */}
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
          keyExtractor={(item) => String(item._id || item.id || item.bookingId)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Bookings Found"
              description={
                searchTerm
                  ? `No bookings matching "${searchTerm}".`
                  : `No bookings currently in "${selectedStatus}" status.`
              }
            />
          }
          renderItem={({ item }) => {
            const rawStatus =
              item.bookingStatus ??
              item.status ??
              item.booking_status ??
              item.currentStatus ??
              '';

            const status = String(rawStatus).trim().toUpperCase();
            const bookingId = String(item._id ?? item.id ?? item.bookingId ?? '').trim();

            const isTrackable =
              Boolean(bookingId) &&
              TRACKABLE_STATUSES.includes(status) &&
              !TERMINAL_STATUSES.includes(status);

            console.log('[ADMIN BOOKING TRACK DEBUG]', {
              bookingId,
              bookingNumber: item.bookingNumber,
              bookingStatus: item.bookingStatus,
              status: item.status,
              normalizedStatus: status,
              paymentStatus: item.paymentStatus,
              escrowStatus: item.escrowStatus,
              worker: item.worker?.name ?? item.workerName,
              latestLocation: Boolean(item.latestLocation),
              workerLocation: Boolean(item.workerLocation),
              isTrackable
            });

            console.log('[LIVE TRACK VISIBILITY]', {
              bookingId,
              bookingNumber: item.bookingNumber,
              status,
              isTrackable,
              hasLatestLocation: Boolean(item.latestLocation),
              hasWorkerLocation: Boolean(item.workerLocation)
            });

            const category = item.category?.name || item.serviceCategoryId?.name || item.serviceCategoryName || 'Service Booking';
            const customer = item.customer || item.customerId;
            const worker = item.worker || item.workerId;
            const customerName = customer?.name || item.customerName || 'Customer';
            const customerEmail = customer?.email || '';
            const workerName = worker?.name || item.workerName || 'Unassigned';
            const amountStr = formatBookingAmount(item);
            const dateStr = formatBookingDateTimeIST(item.scheduledStart || item.bookingDate || item.createdAt, item.bookingTime);

            return (
              <View style={styles.card}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <Text style={styles.bookingNumberText}>
                      #{item.bookingNumber || String(bookingId).substring(0, 8)}
                    </Text>
                  </View>
                  <Badge status={status} />
                </View>

                {/* Details */}
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailBold}>Customer: </Text>
                    {customerName} {customerEmail ? `(${customerEmail})` : ''}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="briefcase-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailBold}>Worker: </Text>
                    {workerName}
                  </Text>
                </View>

                {item.serviceAddress ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.serviceAddress}
                    </Text>
                  </View>
                ) : null}

                {/* Footer / Actions */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerInfo}>
                    <Text style={styles.priceText}>₹{amountStr}</Text>
                    <Text style={styles.dateText}>{dateStr}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'REJECTED' ? (
                      <TouchableOpacity
                        style={{
                          backgroundColor: colors.success || '#10B981',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: radius.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          opacity: actionLoadingId === bookingId ? 0.6 : 1,
                        }}
                        disabled={actionLoadingId === bookingId}
                        onPress={() => handleStatusOverride(item, 'COMPLETED')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          Mark Complete
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {isTrackable ? (
                      <TouchableOpacity
                        style={styles.trackButton}
                        onPress={() => {
                          if (!bookingId) return;
                          router.push(`/(admin)/tracking/${bookingId}` as any);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.trackButtonText}>Track</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  filterContainer: {
    marginVertical: spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
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
    width: '100%',
    alignSelf: 'stretch',
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
  bookingNumberText: {
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  detailText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  detailBold: {
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.md,
  },
  footerInfo: {
    flex: 1,
    minWidth: 100,
  },
  trackActionContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 120,
    flexShrink: 0,
    zIndex: 100,
    elevation: 10,
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
  trackButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 115,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    zIndex: 100,
    elevation: 10,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  waitingGpsText: {
    fontSize: 9,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
