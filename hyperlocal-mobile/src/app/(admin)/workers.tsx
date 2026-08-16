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
import ProfileAvatar from '../../components/ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function AdminWorkersScreen() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const [pendingRes, allRes] = await Promise.allSettled([
        api.get('/admin/workers/pending'),
        api.get('/workers/search')
      ]);

      let combined: any[] = [];
      if (pendingRes.status === 'fulfilled' && pendingRes.value.data) {
        const pList = Array.isArray(pendingRes.value.data)
          ? pendingRes.value.data
          : pendingRes.value.data.workers || pendingRes.value.data.data || [];
        combined = [...combined, ...pList];
      }
      if (allRes.status === 'fulfilled' && allRes.value.data) {
        const aList = Array.isArray(allRes.value.data)
          ? allRes.value.data
          : allRes.value.data.data || allRes.value.data.workers || [];
        for (const item of aList) {
          const itemWorkerId = item.workerId || item._id || item.id;
          if (!combined.some((c) => (c.workerId || c._id || c.id) === itemWorkerId)) {
            combined.push({ ...item, verificationStatus: item.verificationStatus || 'APPROVED' });
          }
        }
      }
      setWorkers(combined);
    } catch (err) {
      console.error('Error fetching admin worker submissions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkers();
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/admin/workers/verify/${id}`, { action: 'APPROVED', reason: 'Approved by admin' }).catch(() =>
        api.patch(`/admin/workers/${id}/approve`)
      );
      Alert.alert('Approved', 'Worker KYC has been approved.');
      fetchWorkers();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Approval failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/admin/workers/verify/${id}`, { action: 'REJECTED', reason: 'Documents incomplete' }).catch(() =>
        api.patch(`/admin/workers/${id}/reject`, { reason: 'Documents incomplete' })
      );
      Alert.alert('Rejected', 'Worker application rejected.');
      fetchWorkers();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    if (activeTab === 'PENDING') return ['PENDING_APPROVAL', 'PENDING'].includes(w.verificationStatus);
    if (activeTab === 'APPROVED') return w.verificationStatus === 'APPROVED';
    if (activeTab === 'REJECTED') return w.verificationStatus === 'REJECTED';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Worker Verification Queue" />

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {['PENDING', 'APPROVED', 'REJECTED'].map((tab) => (
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
          data={filteredWorkers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Workers Found</Text>
              <Text style={styles.emptySub}>No worker applications in this status filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isProcessing = actionLoadingId === item._id;
            const isPending = ['PENDING_APPROVAL', 'PENDING'].includes(item.verificationStatus);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ProfileAvatar user={item.userId || item} size="lg" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.workerName}>
                      {item.userId?.name || item.fullName || 'Worker Applicant'}
                    </Text>
                    <Text style={styles.categoryText}>
                      {item.primaryCategoryName || 'General Services'}
                    </Text>
                    <Text style={styles.emailText}>
                      {item.userId?.email || 'email@example.com'}
                    </Text>
                  </View>
                  <Badge status={item.verificationStatus} />
                </View>

                {isPending ? (
                  <View style={styles.actionRow}>
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      onPress={() => handleReject(item._id)}
                      loading={isProcessing}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Approve"
                      size="sm"
                      onPress={() => handleApprove(item._id)}
                      loading={isProcessing}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
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
    alignItems: 'center'
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  categoryText: {
    fontSize: 13,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 2
  },
  emailText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
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
