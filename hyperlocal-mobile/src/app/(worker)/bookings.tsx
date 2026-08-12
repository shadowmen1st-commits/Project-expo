import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import Badge from '../../components/Badge';
import { AppButton } from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function WorkerBookingsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<'AUTH_ERROR' | 'SERVER_ERROR' | null>(null);

  const fetchJobs = useCallback(async () => {
    setErrorState(null);
    try {
      let res = await api.get('/bookings/worker');
      let data = Array.isArray(res.data) ? res.data : res.data.bookings || res.data.jobs || res.data.data || [];

      if (!data || data.length === 0) {
        try {
          const fallbackRes = await api.get('/bookings');
          data = Array.isArray(fallbackRes.data) ? fallbackRes.data : fallbackRes.data.bookings || [];
        } catch {
          // Ignore fallback error
        }
      }

      setJobs(data);
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
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleUpdateJobStatus = async (jobId: string, action: 'accept' | 'confirm-completion') => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/bookings/${jobId}/${action}`);
      Alert.alert('Success', `Job status updated.`);
      fetchJobs();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || `Failed to update job status.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return ['PENDING', 'ASSIGNED'].includes(j.status);
    if (activeTab === 'ACTIVE') return ['CONFIRMED', 'IN_PROGRESS'].includes(j.status);
    if (activeTab === 'COMPLETED') return j.status === 'COMPLETED';
    return true;
  });

  return (
    <View style={styles.container}>
      <MobileHeader title="Assigned Jobs" showBack={false} />

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'].map((tab) => (
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
        <LoadingState message="Fetching your assigned jobs..." />
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
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title="No Jobs Found"
              description="No assigned jobs found under this category filter."
            />
          }
          renderItem={({ item }) => {
            const isPending = ['PENDING', 'ASSIGNED'].includes(item.status);
            const isActive = ['CONFIRMED', 'IN_PROGRESS'].includes(item.status);
            const isProcessing = actionLoadingId === item._id || actionLoadingId === item.id;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryTitle}>
                    {item.serviceCategoryName || item.categoryName || 'Service Request'}
                  </Text>
                  <Badge status={item.status} />
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {item.customerId?.name || item.customerName || 'Customer'}
                  </Text>
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {new Date(item.bookingDate || Date.now()).toLocaleDateString()} at{' '}
                    {item.startTime || '10:00 AM'} ({item.durationHours || 2} hrs)
                  </Text>
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {item.address || 'Customer Service Location'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceText}>
                    Earnings: ₹{item.totalAmount || item.estimatedPrice || 500}
                  </Text>

                  {isPending ? (
                    <AppButton
                      title="Accept Job"
                      size="sm"
                      onPress={() => handleUpdateJobStatus(item._id || item.id, 'accept')}
                      loading={isProcessing}
                    />
                  ) : isActive ? (
                    <AppButton
                      title="Complete Work"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleUpdateJobStatus(item._id || item.id, 'confirm-completion')}
                      loading={isProcessing}
                    />
                  ) : null}
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
    flex: 1,
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
    color: colors.success,
  },
});
