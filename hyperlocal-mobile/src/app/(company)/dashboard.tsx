import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function CompanyDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { displayName, city } = useLocationContext();

  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCompanyData = useCallback(async () => {
    try {
      const [profRes, walletRes, jobsRes] = await Promise.allSettled([
        api.get('/company/profile').catch(() => api.get('/v1/company/profile')),
        api.get('/company/wallet').catch(() => api.get('/v1/company/wallet')),
        api.get('/company/jobs').catch(() => api.get('/v1/company/jobs')),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value?.data) {
        setCompanyProfile(profRes.value.data.company || profRes.value.data.profile || profRes.value.data);
      }

      if (walletRes.status === 'fulfilled' && walletRes.value?.data) {
        setWallet(walletRes.value.data.wallet || walletRes.value.data);
      }

      if (jobsRes.status === 'fulfilled' && jobsRes.value?.data) {
        const rawJobs = jobsRes.value.data;
        const list = Array.isArray(rawJobs)
          ? rawJobs
          : rawJobs.jobs || rawJobs.data || [];
        setJobs(list);
      }
    } catch (err: any) {
      console.log('[COMPANY_DASHBOARD_FETCH_ERROR]', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCompanyData();
    }, [fetchCompanyData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompanyData();
  };

  const verifStatus = companyProfile?.verificationStatus || user?.verificationStatus || 'PENDING';
  const companyName = companyProfile?.companyName || user?.name || 'Company Portal';
  const balancePaise = wallet?.availableBalancePaise || wallet?.balance || 0;
  const balanceRupees = (balancePaise / 100).toFixed(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={styles.badgePill}>
              <Ionicons name="business" size={12} color="#16A34A" />
              <Text style={styles.badgePillText}>Corporate Account</Text>
            </View>
            <Text style={styles.companyTitle} numberOfLines={1}>{companyName}</Text>
            <Text style={styles.companySub}>{user?.email}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Verification Status Banner */}
        <View style={styles.verificationCard}>
          <View style={styles.verifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifLabel}>Business Verification</Text>
              <View style={{ marginTop: 4 }}>
                <Badge status={verifStatus} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.verifBtn}
              onPress={() => router.push('/(company)/profile')}
            >
              <Text style={styles.verifBtnText}>
                {verifStatus === 'APPROVED' ? 'Verified' : 'View KYC'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>₹{balanceRupees}</Text>
            <Text style={styles.statLbl}>Wallet Balance</Text>
          </View>
          <TouchableOpacity
            style={styles.statBox}
            onPress={() => router.push('/(company)/jobs')}
          >
            <Text style={styles.statVal}>{jobs.length}</Text>
            <Text style={styles.statLbl}>Active Postings</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{companyProfile?.city || city || 'Pan-India'}</Text>
            <Text style={styles.statLbl}>HQ City</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Company Services & Postings</Text>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#16A34A" style={{ marginVertical: 30 }} />
        ) : jobs.length > 0 ? (
          jobs.slice(0, 5).map((job: any) => (
            <View key={job._id || job.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle}>{job.title || job.categoryName || 'Service Requirement'}</Text>
                  <Text style={styles.jobSub}>📍 {job.location || job.city || 'On-site'}</Text>
                </View>
                <Badge status={job.status || 'OPEN'} />
              </View>
              <View style={styles.jobFooter}>
                <Text style={styles.jobBudget}>₹{(job.budgetPaise ? job.budgetPaise / 100 : job.budget || 0)} budget</Text>
                <Text style={styles.jobDate}>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Active'}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No job postings yet</Text>
            <Text style={styles.emptySub}>Manage team hiring and professional service requirements directly from here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 4,
  },
  companyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  companySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  verificationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  verifBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  verifBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  jobSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  jobBudget: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  jobDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
