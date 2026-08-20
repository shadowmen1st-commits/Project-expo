import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import Badge from '../../components/Badge';
import { AppButton } from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import api, { SOCKET_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { WorkerLocationService } from '../../utils/WorkerLocationService';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { io, Socket } from 'socket.io-client';

export default function WorkerBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<'AUTH_ERROR' | 'SERVER_ERROR' | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const workerId = user?._id || user?.id || (user as any)?.userId;

  const fetchJobs = useCallback(async () => {
    setErrorState(null);
    console.log('[WORKER_BOOKINGS_FETCH_START]', { workerId });
    try {
      let res = await api.get('/bookings/worker');
      let data = Array.isArray(res.data)
        ? res.data
        : res.data?.bookings || res.data?.jobs || res.data?.data || [];

      if (!data || data.length === 0) {
        try {
          const fallbackRes = await api.get('/bookings');
          data = Array.isArray(fallbackRes.data) ? fallbackRes.data : fallbackRes.data?.bookings || [];
        } catch {
          // Ignore fallback error
        }
      }

      console.log('[WORKER_BOOKINGS_FETCH_SUCCESS]', { count: data.length });
      setJobs(data);

      const token = await storage.getItem('accessToken');
      if (token && workerId) {
        WorkerLocationService.syncWorkerTracking(data, token, workerId);
      }
    } catch (err: any) {
      console.error('[WORKER_BOOKINGS_FETCH_ERROR]', err?.response?.status, err?.message);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setErrorState('AUTH_ERROR');
      } else {
        setErrorState('SERVER_ERROR');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workerId]);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  useEffect(() => {
    let socket: Socket | null = null;
    const setupSocket = async () => {
      const token = await storage.getItem('accessToken');
      if (!token) return;

      try {
        socket = io(SOCKET_BASE_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
        });

        socket.on('booking:created', () => fetchJobs());
        socket.on('booking:updated', () => fetchJobs());
        socket.on('notification', () => fetchJobs());
        socketRef.current = socket;
      } catch (e) {
        // socket setup non-fatal
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [fetchJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleBookingAction = async (
    bookingId: string,
    action: 'accept' | 'reject' | 'en-route' | 'start' | 'request-completion' | 'confirm-completion'
  ) => {
    setActionLoadingId(bookingId);
    try {
      if (action === 'reject') {
        await api.post(`/bookings/${bookingId}/reject`, { reason: 'Worker unavailable' });
      } else {
        await api.post(`/bookings/${bookingId}/${action}`);
      }
      Alert.alert('Success', `Booking status updated successfully.`);
      fetchJobs();
    } catch (err: any) {
      const msg = err.response?.data?.message || `Failed to perform action.`;
      Alert.alert('Action Failed', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const status = j.bookingStatus || j.status || 'PENDING';
    if (activeTab === 'ALL') return true;
    if (activeTab === 'REQUESTS' || activeTab === 'PENDING') {
      return ['REQUESTED', 'PENDING', 'PAYMENT_PENDING', 'PAID'].includes(status);
    }
    if (activeTab === 'ACTIVE') {
      return ['ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED', 'IN_PROGRESS', 'COMPLETION_REQUESTED'].includes(status);
    }
    if (activeTab === 'COMPLETED') {
      return status === 'COMPLETED';
    }
    if (activeTab === 'CANCELLED') {
      return ['CANCELLED', 'REJECTED'].includes(status);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <MobileHeader title="Assigned Bookings" showBack={false} />

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {[
          { key: 'ALL', label: 'All' },
          { key: 'REQUESTS', label: 'Requests' },
          { key: 'ACTIVE', label: 'Active' },
          { key: 'COMPLETED', label: 'Completed' },
          { key: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Fetching assigned bookings from server..." />
      ) : errorState === 'AUTH_ERROR' ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Session Expired"
          description="Please sign in as a worker to access assigned jobs."
          actionTitle="Sign In"
          onAction={() => router.replace('/(auth)/login')}
        />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title="No Bookings Found"
              description="No assigned customer bookings found under this tab."
            />
          }
          renderItem={({ item }) => {
            const bookingId = String(item.id || item._id);
            const status = item.bookingStatus || item.status || 'PENDING';
            const isProcessing = actionLoadingId === bookingId;

            const categoryTitle = item.category?.name || item.serviceCategoryName || item.categoryName || 'Service Request';
            const customerName = item.customer?.name || item.customerName || 'Customer';
            const customerPhone = item.customer?.phone || null;
            const address = item.serviceAddress || item.addressSnapshot?.addressLine || item.address || 'Customer Service Location';
            const bookingNum = item.bookingNumber || `BK-${bookingId.substring(0, 8).toUpperCase()}`;
            const dateDisplay = item.bookingDate || (item.scheduledStart ? new Date(item.scheduledStart).toLocaleDateString() : 'Scheduled');
            const timeDisplay = item.bookingTime || '';
            const durationDisplay = item.durationMinutes ? `(${Math.round(item.durationMinutes / 60)} hrs)` : '';
            const earningVal = item.workerEarning || item.totalAmount || 0;

            const isPaidPendingAccept = status === 'PAID';
            const isConfirmedOrAccepted = status === 'CONFIRMED' || status === 'ACCEPTED';
            const isEnRoute = status === 'WORKER_EN_ROUTE';
            const isStarted = status === 'STARTED' || status === 'IN_PROGRESS';
            const isCompletionRequested = status === 'COMPLETION_REQUESTED';
            const isTrackingActive = ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'STARTED', 'IN_PROGRESS'].includes(status);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.categoryTitle}>{categoryTitle}</Text>
                    <Text style={styles.bookingNumberText}>#{bookingNum}</Text>
                  </View>
                  <Badge status={status} />
                </View>

                {/* Customer Row with Call option */}
                <View style={styles.detailsRow}>
                  <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{customerName}</Text>
                  {customerPhone ? (
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                    >
                      <Ionicons name="call" size={12} color="#16A34A" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Date & Time */}
                <View style={styles.detailsRow}>
                  <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {dateDisplay} {timeDisplay} {durationDisplay}
                  </Text>
                </View>

                {/* Address */}
                <View style={styles.detailsRow}>
                  <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {address}
                  </Text>
                </View>

                {/* Notes if any */}
                {item.customerNotes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>Note: "{item.customerNotes}"</Text>
                  </View>
                ) : null}

                {/* Footer & Actions */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.earningLabel}>Worker Payout</Text>
                    <Text style={styles.priceText}>₹{earningVal}</Text>
                  </View>

                  {/* Contextual Action Buttons */}
                  <View style={styles.actionsContainer}>
                    {isPaidPendingAccept ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <AppButton
                          title="Reject"
                          size="sm"
                          variant="secondary"
                          onPress={() => handleBookingAction(bookingId, 'reject')}
                          loading={isProcessing}
                        />
                        <AppButton
                          title="Accept Job"
                          size="sm"
                          variant="primary"
                          onPress={() => handleBookingAction(bookingId, 'accept')}
                          loading={isProcessing}
                        />
                      </View>
                    ) : isConfirmedOrAccepted ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {isTrackingActive && (
                          <AppButton
                            title="Live GPS"
                            size="sm"
                            variant="secondary"
                            onPress={() => router.push(`/(worker)/tracking/${bookingId}` as any)}
                          />
                        )}
                        <AppButton
                          title="Start En-Route"
                          size="sm"
                          variant="primary"
                          onPress={() => handleBookingAction(bookingId, 'en-route')}
                          loading={isProcessing}
                        />
                      </View>
                    ) : isEnRoute ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <AppButton
                          title="Live GPS"
                          size="sm"
                          variant="secondary"
                          onPress={() => router.push(`/(worker)/tracking/${bookingId}` as any)}
                        />
                        <AppButton
                          title="Start Job"
                          size="sm"
                          variant="primary"
                          onPress={() => handleBookingAction(bookingId, 'start')}
                          loading={isProcessing}
                        />
                      </View>
                    ) : isStarted ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <AppButton
                          title="Live GPS"
                          size="sm"
                          variant="secondary"
                          onPress={() => router.push(`/(worker)/tracking/${bookingId}` as any)}
                        />
                        <AppButton
                          title="Complete Job"
                          size="sm"
                          variant="primary"
                          onPress={() => handleBookingAction(bookingId, 'request-completion')}
                          loading={isProcessing}
                        />
                      </View>
                    ) : isCompletionRequested ? (
                      <View style={styles.waitingBadge}>
                        <Ionicons name="hourglass-outline" size={13} color="#D97706" />
                        <Text style={styles.waitingText}>Awaiting Customer Approval</Text>
                      </View>
                    ) : status === 'COMPLETED' ? (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                        <Text style={styles.completedText}>Completed</Text>
                      </View>
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 4,
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
    fontSize: 11,
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
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  bookingNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  notesBox: {
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  notesText: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
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
  earningLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  priceText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  waitingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
});
