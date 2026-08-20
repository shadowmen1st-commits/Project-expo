import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileHeader } from '../../components/MobileHeader';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function CompanyJobsScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get('/company/jobs').catch(() => api.get('/v1/company/jobs'));
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : raw?.jobs || raw?.data || [];
      setJobs(list);
    } catch (e: any) {
      console.log('[COMPANY_JOBS_FETCH_ERROR]', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <MobileHeader title="Job Postings" />
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title || item.categoryName || 'Requirement'}</Text>
                <Badge status={item.status || 'OPEN'} />
              </View>
              <Text style={styles.cardLocation}>📍 {item.location || item.city || 'India'}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description || 'No description provided.'}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardBudget}>₹{(item.budgetPaise ? item.budgetPaise / 100 : item.budget || 0)}</Text>
                <Text style={styles.cardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Job Postings</Text>
              <Text style={styles.emptySub}>Create jobs and manage requirements for your organization.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  cardLocation: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardBudget: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  cardDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
