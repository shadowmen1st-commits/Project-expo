import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function WorkerBookingsScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get('/bookings/worker/my-jobs');
      const data = Array.isArray(res.data) ? res.data : res.data.jobs || res.data.data || [];
      setJobs(data);
    } catch (err) {
      console.error('Error fetching worker jobs:', err);
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

  const handleUpdateJobStatus = async (jobId: string, action: 'accept' | 'complete') => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/bookings/${jobId}/${action}`);
      Alert.alert('Success', `Job status updated to ${action === 'accept' ? 'CONFIRMED' : 'COMPLETED'}.`);
      fetchJobs();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || `Failed to ${action} job.`);
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
    <SafeAreaView style={styles.safeArea}>
      <Header title="Assigned Jobs" />

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Jobs Found</Text>
              <Text style={styles.emptySub}>No jobs available under this category.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = ['PENDING', 'ASSIGNED'].includes(item.status);
            const isActive = ['CONFIRMED', 'IN_PROGRESS'].includes(item.status);
            const isProcessing = actionLoadingId === item._id;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryTitle}>{item.serviceCategoryName || 'Service Request'}</Text>
                  <Badge status={item.status} />
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="person-outline" size={16} color="#64748B" />
                  <Text style={styles.detailText}>{item.customerId?.name || item.customerName || 'Customer'}</Text>
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="time-outline" size={16} color="#64748B" />
                  <Text style={styles.detailText}>
                    {new Date(item.bookingDate || Date.now()).toLocaleDateString()} at {item.startTime || '10:00 AM'} ({item.durationHours || 2} hrs)
                  </Text>
                </View>

                <View style={styles.detailsRow}>
                  <Ionicons name="location-outline" size={16} color="#64748B" />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {item.address || 'Customer Location Address'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceText}>Earnings: ₹{item.totalAmount || 500}</Text>
                  
                  {isPending ? (
                    <Button
                      title="Accept Job"
                      size="sm"
                      onPress={() => handleUpdateJobStatus(item._id, 'accept')}
                      loading={isProcessing}
                    />
                  ) : isActive ? (
                    <Button
                      title="Complete Work"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleUpdateJobStatus(item._id, 'complete')}
                      loading={isProcessing}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9'
  },
  tabBtnActive: {
    backgroundColor: '#EA580C'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContent: {
    padding: 16
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8,
    flex: 1
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6
  }
});
