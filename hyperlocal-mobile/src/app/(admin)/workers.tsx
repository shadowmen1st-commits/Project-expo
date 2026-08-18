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

export interface WorkerItem {
  _id: string;
  id: string;
  workerId?: string;
  userId?: any;
  fullName?: string;
  primaryCategoryName?: string;
  verificationStatus: string;
  [key: string]: any;
}

const extractWorkerId = (item: any): string | null => {
  if (!item || typeof item !== 'object') return null;
  const rawId =
    item._id ??
    item.id ??
    (typeof item.userId === 'string' ? item.userId : item.userId?._id ?? item.userId?.id) ??
    (typeof item.workerId === 'string' ? item.workerId : item.workerId?._id ?? item.workerId?.id);

  if (rawId === null || rawId === undefined) return null;
  const str = String(rawId).trim();
  return str.length > 0 ? str : null;
};

const normalizeAndDeduplicateWorkers = (rawList: any[]): WorkerItem[] => {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const normalized: WorkerItem[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const workerId = extractWorkerId(item);

    if (!workerId) {
      if (__DEV__) {
        console.warn('[workers.tsx] Excluding malformed worker record missing valid ID at index', i, item);
      }
      continue;
    }

    if (seenIds.has(workerId)) {
      if (__DEV__) {
        console.warn('[workers.tsx] Excluding duplicate worker record with ID:', workerId);
      }
      continue;
    }

    seenIds.add(workerId);
    normalized.push({
      ...item,
      _id: workerId,
      id: workerId,
      verificationStatus: item.verificationStatus || 'PENDING',
    });
  }

  return normalized;
};

export default function AdminWorkersScreen() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
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
          const itemWorkerId = extractWorkerId(item);
          if (itemWorkerId && !combined.some((c) => extractWorkerId(c) === itemWorkerId)) {
            combined.push({ ...item, verificationStatus: item.verificationStatus || 'APPROVED' });
          }
        }
      }
      setWorkers(normalizeAndDeduplicateWorkers(combined));
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

  const filteredWorkers = (Array.isArray(workers) ? workers : []).filter((w): w is WorkerItem => {
    if (!w || typeof w !== 'object') return false;
    const status = w.verificationStatus || 'PENDING';
    if (activeTab === 'PENDING') return ['PENDING_APPROVAL', 'PENDING'].includes(status);
    if (activeTab === 'APPROVED') return status === 'APPROVED';
    if (activeTab === 'REJECTED') return status === 'REJECTED';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Worker Verification Queue" />

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {['PENDING', 'APPROVED', 'REJECTED'].map((tab) => (
          <TouchableOpacity
            key={`tab-${tab}`}
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
          keyExtractor={(item) => String(item._id || item.id || '').trim()}
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
            const targetId = item._id;
            const isProcessing = actionLoadingId === targetId;
            const isPending = ['PENDING_APPROVAL', 'PENDING'].includes(item.verificationStatus);

            return (
              <View style={styles.card} key={`card-${targetId}`}>
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
                      onPress={() => handleReject(targetId)}
                      loading={isProcessing}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Approve"
                      size="sm"
                      onPress={() => handleApprove(targetId)}
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
