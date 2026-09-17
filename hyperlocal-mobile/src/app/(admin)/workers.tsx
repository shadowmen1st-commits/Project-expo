import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
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
  submissionId?: string;
  workerId?: string;
  userId?: any;
  fullName?: string;
  primaryCategoryName?: string;
  verificationStatus: string;
  documents?: any[];
  [key: string]: any;
}

export interface CompanyItem {
  _id: string;
  userId?: any;
  companyName?: string;
  authorizedPersonName?: string;
  phone?: string;
  businessType?: string;
  gstNumber?: string;
  city?: string;
  state?: string;
  address?: string;
  verificationStatus: string;
  documents?: any[];
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
  };
  rejectionReason?: string;
  [key: string]: any;
}

const normalizeWorkers = (rawList: any[]): WorkerItem[] => {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const normalized: WorkerItem[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!raw || typeof raw !== 'object') continue;

    // Handle VerificationSubmission schema
    if (raw.workerId && (raw.profileSnapshot || raw.serviceSnapshot || raw.submissionNumber)) {
      const workerUser = typeof raw.workerId === 'object' ? raw.workerId : null;
      const workerUserId = String(workerUser?._id || raw.workerId || '').trim();
      const submissionId = String(raw._id || '').trim();
      const uniqueKey = workerUserId || submissionId;
      if (!uniqueKey || seenIds.has(uniqueKey)) continue;
      seenIds.add(uniqueKey);

      normalized.push({
        _id: submissionId || workerUserId,
        id: submissionId || workerUserId,
        submissionId: submissionId || undefined,
        workerId: workerUserId,
        userId: workerUser || { name: raw.profileSnapshot?.fullName, email: raw.profileSnapshot?.email },
        fullName: raw.profileSnapshot?.fullName || workerUser?.name || 'Worker Applicant',
        primaryCategoryName: raw.serviceSnapshot?.primaryCategoryName || 'General Services',
        phone: workerUser?.phone || raw.profileSnapshot?.phone || '',
        bio: raw.profileSnapshot?.bio || '',
        hourlyRate: raw.profileSnapshot?.hourlyRate || raw.hourlyRate,
        yearsOfExperience: raw.profileSnapshot?.yearsOfExperience ?? raw.yearsOfExperience,
        verificationStatus: String(raw.status || 'PENDING_APPROVAL').toUpperCase(),
        documents: Array.isArray(raw.documentIds) ? raw.documentIds : Array.isArray(raw.documents) ? raw.documents : [],
        raw,
      });
      continue;
    }

    // Handle WorkerProfile schema
    const target = raw.profile || raw;
    const workerUserId = String(
      (typeof target.userId === 'object' ? target.userId?._id : target.userId) ||
      (typeof target.workerId === 'object' ? target.workerId?._id : target.workerId) ||
      target._id ||
      target.id ||
      ''
    ).trim();

    if (!workerUserId || seenIds.has(workerUserId)) continue;
    seenIds.add(workerUserId);

    const userObj = target.userId && typeof target.userId === 'object' ? target.userId : raw.user || undefined;
    const fullName = target.fullName || userObj?.name || 'Worker Applicant';
    const primaryCategoryName = target.primaryCategoryName || target.primaryServiceCategoryId?.name || 'General Services';
    const status = String(target.verificationStatus || raw.verificationStatus || 'PENDING_APPROVAL').toUpperCase();

    normalized.push({
      _id: workerUserId,
      id: workerUserId,
      workerId: workerUserId,
      userId: userObj || { name: fullName, email: target.email },
      fullName,
      primaryCategoryName,
      phone: userObj?.phone || target.phone || '',
      bio: target.bio || '',
      hourlyRate: target.hourlyRate || raw.hourlyRate,
      yearsOfExperience: target.yearsOfExperience ?? raw.yearsOfExperience,
      verificationStatus: status,
      documents: Array.isArray(raw.documents) ? raw.documents : Array.isArray(target.documents) ? target.documents : [],
      raw,
    });
  }

  return normalized;
};

const normalizeCompanies = (rawList: any[]): CompanyItem[] => {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const normalized: CompanyItem[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!raw || typeof raw !== 'object') continue;
    const profile = raw.profile || raw;
    const userObj = raw.user || profile.user || (typeof profile.userId === 'object' ? profile.userId : null);

    const targetId = String(profile._id || raw._id || userObj?._id || profile.userId || '').trim();
    if (!targetId || seenIds.has(targetId)) continue;
    seenIds.add(targetId);

    const companyName = profile.companyName || userObj?.name || raw.companyName || 'Corporate Account';
    const status = String(profile.verificationStatus || raw.verificationStatus || 'PENDING').toUpperCase();

    normalized.push({
      ...raw,
      ...profile,
      _id: targetId,
      companyName,
      email: profile.email || userObj?.email || raw.email || '',
      phone: profile.phone || userObj?.phone || raw.phone || '',
      verificationStatus: status,
      user: userObj || undefined,
      documents: Array.isArray(raw.documents) ? raw.documents : Array.isArray(profile.documents) ? profile.documents : [],
    });
  }

  return normalized;
};

export default function AdminVerificationScreen() {
  // Segment: 'WORKERS' | 'COMPANIES'
  const [selectedSegment, setSelectedSegment] = useState<'WORKERS' | 'COMPANIES'>('WORKERS');

  // Workers states
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [workerTab, setWorkerTab] = useState<string>('PENDING');

  // Companies states
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyTab, setCompanyTab] = useState<string>('PENDING');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [targetCompany, setTargetCompany] = useState<CompanyItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchAllData = useCallback(async () => {
    try {
      const [workerVerifRes, pendingWorkersRes, compVerifRes] = await Promise.allSettled([
        api.get('/admin/worker-verifications?limit=100'),
        api.get('/admin/workers/pending'),
        api.get('/admin/company-verifications'),
      ]);

      // 1. Process Workers
      let rawWorkerList: any[] = [];
      if (workerVerifRes.status === 'fulfilled' && workerVerifRes.value.data?.data) {
        rawWorkerList = [...rawWorkerList, ...workerVerifRes.value.data.data];
      }
      if (pendingWorkersRes.status === 'fulfilled' && pendingWorkersRes.value.data) {
        const pList = Array.isArray(pendingWorkersRes.value.data)
          ? pendingWorkersRes.value.data
          : pendingWorkersRes.value.data.workers || pendingWorkersRes.value.data.data || [];
        rawWorkerList = [...rawWorkerList, ...pList];
      }
      setWorkers(normalizeWorkers(rawWorkerList));

      // 2. Process Companies
      let rawCompanyList: any[] = [];
      if (compVerifRes.status === 'fulfilled' && compVerifRes.value.data) {
        const cData = compVerifRes.value.data;
        const list = Array.isArray(cData)
          ? cData
          : cData.verifications || cData.data || cData.companies || [];
        rawCompanyList = list;
      }
      setCompanies(normalizeCompanies(rawCompanyList));
    } catch (err) {
      console.error('Error fetching admin verification items:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  // --- Worker Actions ---
  const handleApproveWorker = async (item: WorkerItem) => {
    const workerUserId = item.workerId || (typeof item.userId === 'object' ? item.userId?._id : item.userId) || item._id;
    const submissionId = item.submissionId;
    const targetKey = item._id;
    setActionLoadingId(targetKey);
    try {
      if (submissionId) {
        await api.post(`/v1/admin/worker-verifications/${submissionId}/approve`).catch(async () => {
          if (workerUserId) {
            await api.post(`/admin/workers/verify/${workerUserId}`, { action: 'APPROVED', reason: 'Approved by admin' });
          }
        });
      } else if (workerUserId) {
        await api.post(`/admin/workers/verify/${workerUserId}`, { action: 'APPROVED', reason: 'Approved by admin' }).catch(() =>
          api.patch(`/admin/workers/${workerUserId}/approve`)
        );
      }
      Alert.alert('Approved', 'Worker KYC has been approved.');
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Worker approval failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectWorker = async (item: WorkerItem) => {
    const workerUserId = item.workerId || (typeof item.userId === 'object' ? item.userId?._id : item.userId) || item._id;
    const submissionId = item.submissionId;
    const targetKey = item._id;
    setActionLoadingId(targetKey);
    try {
      if (submissionId) {
        await api.post(`/v1/admin/worker-verifications/${submissionId}/reject`, {
          reasonCode: 'INVALID_DOCUMENT',
          comment: 'Documents incomplete or invalid'
        }).catch(async () => {
          if (workerUserId) {
            await api.post(`/admin/workers/verify/${workerUserId}`, { action: 'REJECTED', reason: 'Documents incomplete' });
          }
        });
      } else if (workerUserId) {
        await api.post(`/admin/workers/verify/${workerUserId}`, { action: 'REJECTED', reason: 'Documents incomplete' }).catch(() =>
          api.patch(`/admin/workers/${workerUserId}/reject`, { reason: 'Documents incomplete' })
        );
      }
      Alert.alert('Rejected', 'Worker application rejected.');
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Worker rejection failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // --- Company Actions ---
  const getCompanyTargetId = (company: CompanyItem): string => {
    if (typeof company.userId === 'string') return company.userId;
    if (company.userId?._id) return company.userId._id;
    if (company.userId?.id) return company.userId.id;
    return company._id;
  };

  const handleApproveCompany = async (company: CompanyItem) => {
    const targetId = getCompanyTargetId(company);
    setActionLoadingId(targetId);
    try {
      await api.post(`/admin/company-verifications/${targetId}/approve`).catch(() =>
        api.patch(`/admin/companies/${targetId}/verification/approve`)
      );
      Alert.alert('Success', `Company "${company.companyName || 'Account'}" is now VERIFIED.`);
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to verify company.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openCompanyRejectModal = (company: CompanyItem) => {
    setTargetCompany(company);
    setRejectionReason('Documents provided are incomplete or invalid.');
    setRejectModalVisible(true);
  };

  const handleConfirmCompanyReject = async () => {
    if (!targetCompany) return;
    const targetId = getCompanyTargetId(targetCompany);
    setActionLoadingId(targetId);
    setRejectModalVisible(false);

    try {
      await api.post(`/admin/company-verifications/${targetId}/reject`, {
        reason: rejectionReason || 'KYC documentation rejected by admin.'
      }).catch(() =>
        api.patch(`/admin/companies/${targetId}/verification/reject`, {
          reason: rejectionReason || 'KYC documentation rejected by admin.'
        })
      );
      Alert.alert('Rejected', `Company application for "${targetCompany.companyName}" has been rejected.`);
      fetchAllData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to reject company.');
    } finally {
      setActionLoadingId(null);
      setTargetCompany(null);
    }
  };

  // --- Filtering ---
  const filteredWorkers = (Array.isArray(workers) ? workers : []).filter((w): w is WorkerItem => {
    if (!w || typeof w !== 'object') return false;
    const status = String(w.verificationStatus || '').toUpperCase();
    if (workerTab === 'PENDING') return ['PENDING_APPROVAL', 'PENDING', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'SUBMITTED', 'CHANGES_REQUIRED'].includes(status);
    if (workerTab === 'APPROVED') return ['APPROVED', 'VERIFIED'].includes(status);
    if (workerTab === 'REJECTED') return ['REJECTED', 'SUSPENDED'].includes(status);
    return true;
  });

  const filteredCompanies = (Array.isArray(companies) ? companies : []).filter((c) => {
    if (!c || typeof c !== 'object') return false;
    const status = String(c.verificationStatus || '').toUpperCase();
    if (companyTab === 'PENDING') return ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'PENDING_APPROVAL', 'SUBMITTED', 'CHANGES_REQUIRED'].includes(status);
    if (companyTab === 'APPROVED') return ['APPROVED', 'VERIFIED'].includes(status);
    if (companyTab === 'REJECTED') return ['REJECTED', 'SUSPENDED'].includes(status);
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="KYC Verification Hub" />

      {/* Primary Segment Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, selectedSegment === 'WORKERS' && styles.segmentBtnActive]}
          onPress={() => setSelectedSegment('WORKERS')}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={selectedSegment === 'WORKERS' ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.segmentText, selectedSegment === 'WORKERS' && styles.segmentTextActive]}>
            Workers KYC ({workers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, selectedSegment === 'COMPANIES' && styles.segmentBtnActive]}
          onPress={() => setSelectedSegment('COMPANIES')}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={selectedSegment === 'COMPANIES' ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.segmentText, selectedSegment === 'COMPANIES' && styles.segmentTextActive]}>
            Companies KYC ({companies.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Filter Tabs */}
      <View style={styles.tabsRow}>
        {['PENDING', 'APPROVED', 'REJECTED'].map((tab) => {
          const isActive = (selectedSegment === 'WORKERS' ? workerTab : companyTab) === tab;
          return (
            <TouchableOpacity
              key={`tab-${tab}`}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => {
                if (selectedSegment === 'WORKERS') setWorkerTab(tab);
                else setCompanyTab(tab);
              }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab === 'PENDING' ? (selectedSegment === 'COMPANIES' ? 'Pending Review' : 'Pending') : tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : selectedSegment === 'WORKERS' ? (
        /* WORKERS LIST */
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
            const isPending = ['PENDING_APPROVAL', 'PENDING', 'UNDER_REVIEW', 'SUBMITTED', 'CHANGES_REQUIRED', 'MORE_INFO_REQUIRED'].includes(item.verificationStatus);
            const docs = Array.isArray(item.documents) ? item.documents : [];

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
                      {item.userId?.email || item.email || 'email@example.com'}
                      {item.phone ? ` • 📞 ${item.phone}` : ''}
                    </Text>
                  </View>
                  <Badge status={item.verificationStatus} />
                </View>

                {/* Worker Details Grid */}
                <View style={styles.detailsBox}>
                  {item.phone ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Phone Number:</Text>
                      <Text style={styles.detailVal}>{item.phone}</Text>
                    </View>
                  ) : null}
                  {item.hourlyRate ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Hourly Rate:</Text>
                      <Text style={styles.detailVal}>₹{item.hourlyRate}/hr</Text>
                    </View>
                  ) : null}
                  {item.yearsOfExperience !== undefined && item.yearsOfExperience !== null ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Experience:</Text>
                      <Text style={styles.detailVal}>{item.yearsOfExperience} Year(s)</Text>
                    </View>
                  ) : null}
                  {item.bio ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Bio:</Text>
                      <Text style={[styles.detailVal, { flex: 1 }]} numberOfLines={2}>{item.bio}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Uploaded Documents List */}
                <View style={styles.docsSection}>
                  <Text style={styles.docsSectionTitle}>
                    Submitted KYC Documents ({docs.length})
                  </Text>
                  {docs.length > 0 ? (
                    docs.map((doc: any, index: number) => {
                      const formattedType = (doc.documentType || 'DOCUMENT').replace(/_/g, ' ');
                      const last4 = doc.documentNumberLast4 ? `(•••• ${doc.documentNumberLast4})` : '';
                      const docStatus = doc.verificationStatus || doc.status || 'PENDING_REVIEW';
                      return (
                        <View key={doc._id || `worker-doc-${index}`} style={styles.docItem}>
                          <Ionicons name="document-text-outline" size={16} color="#475569" />
                          <Text style={styles.docItemName} numberOfLines={1}>
                            {formattedType} {last4}
                          </Text>
                          <Badge status={docStatus} />
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noDocsText}>⚠️ No KYC documents uploaded</Text>
                  )}
                </View>

                {isPending ? (
                  <View style={styles.actionRow}>
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      onPress={() => handleRejectWorker(item)}
                      loading={isProcessing}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Approve"
                      size="sm"
                      onPress={() => handleApproveWorker(item)}
                      loading={isProcessing}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      ) : (
        /* COMPANIES LIST */
        <FlatList
          data={filteredCompanies}
          keyExtractor={(item) => String(item._id || getCompanyTargetId(item) || '').trim()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Companies Found</Text>
              <Text style={styles.emptySub}>No corporate registration applications under this filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const targetId = getCompanyTargetId(item);
            const isProcessing = actionLoadingId === targetId;
            const isPending = ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFORMATION'].includes(item.verificationStatus);
            const docs = Array.isArray(item.documents) ? item.documents : [];

            return (
              <View style={styles.card} key={`company-card-${targetId}`}>
                <View style={styles.companyHeader}>
                  <View style={styles.companyIconBox}>
                    <Ionicons name="business" size={24} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.companyTitleText}>{item.companyName || item.user?.name || 'Corporate Account'}</Text>
                    <Text style={styles.companySubText}>
                      {item.user?.email || 'No email provided'} • {item.phone || item.user?.phone || 'No phone'}
                    </Text>
                    <Text style={styles.companyCityText}>
                      📍 {item.city ? `${item.city}, ${item.state || 'India'}` : 'Pan-India'}
                    </Text>
                  </View>
                  <Badge status={item.verificationStatus} />
                </View>

                {/* Company Details Grid */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Authorized Person:</Text>
                    <Text style={styles.detailVal}>{item.authorizedPersonName || item.user?.name || 'N/A'}</Text>
                  </View>
                  {item.gstNumber ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>GST Number:</Text>
                      <Text style={styles.detailVal}>{item.gstNumber}</Text>
                    </View>
                  ) : null}
                  {item.businessType ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Business Type:</Text>
                      <Text style={styles.detailVal}>{item.businessType}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Uploaded Documents List */}
                <View style={styles.docsSection}>
                  <Text style={styles.docsSectionTitle}>
                    Submitted KYC Documents ({docs.length})
                  </Text>
                  {docs.length > 0 ? (
                    docs.map((doc: any, index: number) => {
                      const formattedType = (doc.documentType || 'DOCUMENT').replace(/_/g, ' ');
                      return (
                        <View key={doc._id || `doc-${index}`} style={styles.docItem}>
                          <Ionicons name="document-text-outline" size={16} color="#475569" />
                          <Text style={styles.docItemName} numberOfLines={1}>
                            {formattedType}
                          </Text>
                          <Badge status={doc.status || 'PENDING'} />
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noDocsText}>⚠️ No documents uploaded yet</Text>
                  )}
                </View>

                {/* Actions */}
                {isPending ? (
                  <View style={styles.actionRow}>
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      onPress={() => openCompanyRejectModal(item)}
                      loading={isProcessing}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      title="Approve & Verify"
                      size="sm"
                      onPress={() => handleApproveCompany(item)}
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

      {/* Reject Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Company KYC</Text>
            <Text style={styles.modalSub}>
              Provide feedback or rejection reason for {targetCompany?.companyName || 'this company'}:
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={3}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="E.g. Document image is blurry or expired PAN card"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmCompanyReject}
              >
                <Text style={styles.modalConfirmText}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#0F172A',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: '#EA580C',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryText: {
    fontSize: 13,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 2,
  },
  emailText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  companySubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  companyCityText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailKey: {
    fontSize: 12,
    color: '#64748B',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  docsSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  docsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
  },
  docItemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  noDocsText: {
    fontSize: 12,
    color: '#D97706',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 40,
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
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
