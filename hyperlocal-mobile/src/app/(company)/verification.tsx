import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileHeader } from '../../components/MobileHeader';
import { AppButton } from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { API_BASE_URL } from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

interface DocumentSlot {
  type: string;
  title: string;
  desc: string;
  required: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

const DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    type: 'BUSINESS_REGISTRATION',
    title: 'Business Registration Proof',
    desc: 'Certificate of Incorporation, Shop Act, or MSME License',
    required: true,
    icon: 'business-outline',
  },
  {
    type: 'COMPANY_PAN',
    title: 'Company PAN Card',
    desc: 'PAN card registered under the company / firm name',
    required: true,
    icon: 'card-outline',
  },
  {
    type: 'ADDRESS_PROOF',
    title: 'Registered Address Proof',
    desc: 'Utility bill, rent agreement, or property tax receipt',
    required: true,
    icon: 'location-outline',
  },
  {
    type: 'AUTHORIZED_PERSON_ID',
    title: 'Authorized Signatory ID',
    desc: 'Aadhaar, Passport, or Voter ID of Authorized Director/Manager',
    required: true,
    icon: 'person-circle-outline',
  },
  {
    type: 'GST_CERTIFICATE',
    title: 'GST Registration Certificate',
    desc: 'Form REG-06 GST certificate (Optional if not applicable)',
    required: false,
    icon: 'receipt-outline',
  },
];

export default function CompanyVerificationScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const [verificationStatus, setVerificationStatus] = useState<string>('PENDING');
  const [progress, setProgress] = useState<number>(0);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [needsInfoReason, setNeedsInfoReason] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/company/verification').catch(() => api.get('/v1/company/verification'));
      if (res.data) {
        setVerificationStatus(res.data.verificationStatus || res.data.profile?.verificationStatus || 'PENDING');
        setProgress(res.data.progress ?? 0);
        setCompanyProfile(res.data.profile);
        setUploadedDocs(res.data.documents || []);
        setRejectionReason(res.data.rejectionReason || res.data.profile?.rejectionReason || '');
        setNeedsInfoReason(res.data.needsInfoReason || res.data.profile?.needsInfoReason || '');
      }
    } catch (err: any) {
      console.log('[COMPANY_VERIF_FETCH_ERR]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const pickAndUploadDocument = async (docType: string) => {
    try {
      Alert.alert(
        'Upload Document',
        'Choose an option to upload your document:',
        [
          {
            text: 'Take Photo (Camera)',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });
              if (!result.canceled && result.assets && result.assets[0]) {
                await executeUpload(docType, result.assets[0]);
              }
            },
          },
          {
            text: 'Choose from Gallery / Files',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Photo library permission is required to select documents.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });
              if (!result.canceled && result.assets && result.assets[0]) {
                await executeUpload(docType, result.assets[0]);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Selection Error', err.message || 'Failed to open media picker.');
    }
  };

  const executeUpload = async (docType: string, asset: ImagePicker.ImagePickerAsset) => {
    setUploadingType(docType);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || `${docType.toLowerCase()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

      // @ts-ignore: React Native FormData file object
      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type: mimeType,
      });
      formData.append('documentType', docType);

      const res = await api.post('/company/verification/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        Alert.alert('Upload Successful 🎉', `${docType.replace(/_/g, ' ')} has been uploaded.`);
        fetchStatus();
      }
    } catch (err: any) {
      console.error('[COMPANY_DOC_UPLOAD_ERR]', err);
      const msg = err.response?.data?.message || err.message || 'Failed to upload document.';
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmitVerification = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/company/verification/submit', {});
      if (res.data?.success) {
        Alert.alert(
          'Verification Submitted 🚀',
          'Your KYC documents have been submitted for Admin verification. Our team typically reviews documents within 24 hours.'
        );
        fetchStatus();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit verification.';
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'VERIFIED':
      case 'APPROVED':
        return { bg: '#DCFCE7', text: '#15803D', label: 'KYC VERIFIED', icon: 'shield-checkmark' };
      case 'UNDER_REVIEW':
        return { bg: '#DBEAFE', text: '#1D4ED8', label: 'UNDER ADMIN REVIEW', icon: 'time-outline' };
      case 'NEEDS_INFORMATION':
        return { bg: '#FEF9C3', text: '#854D0E', label: 'ACTION REQUIRED', icon: 'alert-circle-outline' };
      case 'REJECTED':
        return { bg: '#FEE2E2', text: '#B91C1C', label: 'VERIFICATION REJECTED', icon: 'close-circle-outline' };
      default:
        return { bg: '#FFEDD5', text: '#C2410C', label: 'KYC PENDING', icon: 'hourglass-outline' };
    }
  };

  const mandatoryTypes = ['BUSINESS_REGISTRATION', 'COMPANY_PAN', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID'];
  const uploadedCount = mandatoryTypes.filter((t) =>
    uploadedDocs.some((d) => d.documentType === t && (d.status === 'PENDING' || d.status === 'APPROVED'))
  ).length;
  const isAllMandatoryUploaded = uploadedCount === mandatoryTypes.length;
  const isUnderReviewOrApproved = verificationStatus === 'UNDER_REVIEW' || verificationStatus === 'VERIFIED' || verificationStatus === 'APPROVED';

  const badgeInfo = getStatusBadgeStyle(verificationStatus);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <MobileHeader title="Company KYC Verification" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Loading KYC Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MobileHeader title="Company KYC Verification" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Status Header */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: badgeInfo.bg }]}>
              <Ionicons name={badgeInfo.icon as any} size={14} color={badgeInfo.text} />
              <Text style={[styles.statusBadgeText, { color: badgeInfo.text }]}>{badgeInfo.label}</Text>
            </View>
            <Text style={styles.progressPercentText}>{progress}% Completed</Text>
          </View>

          <Text style={styles.companyTitle}>{companyProfile?.companyName || 'Corporate Account'}</Text>
          <Text style={styles.companySub}>{companyProfile?.email || 'Official Business Account'}</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <Text style={styles.progressHint}>
            {isUnderReviewOrApproved
              ? 'Your documents have been received by the compliance team.'
              : `${uploadedCount} of ${mandatoryTypes.length} mandatory documents uploaded`}
          </Text>
        </View>

        {/* Action Alerts */}
        {needsInfoReason ? (
          <View style={[styles.alertBox, { backgroundColor: '#FEF9C3', borderColor: '#FACC15' }]}>
            <Ionicons name="information-circle" size={22} color="#854D0E" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: '#854D0E' }]}>Admin Requested Information</Text>
              <Text style={[styles.alertBody, { color: '#713F12' }]}>{needsInfoReason}</Text>
            </View>
          </View>
        ) : null}

        {rejectionReason ? (
          <View style={[styles.alertBox, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
            <Ionicons name="alert-circle" size={22} color="#B91C1C" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: '#B91C1C' }]}>Rejection Feedback</Text>
              <Text style={[styles.alertBody, { color: '#7F1D1D' }]}>{rejectionReason}</Text>
            </View>
          </View>
        ) : null}

        {/* Document Upload Slots */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verification Documents</Text>
          <Text style={styles.sectionSubtitle}>
            Government ID, commercial licenses, and address proof for verified business badge
          </Text>
        </View>

        {DOCUMENT_SLOTS.map((slot) => {
          const doc = uploadedDocs.find((d) => d.documentType === slot.type);
          const isUploaded = Boolean(doc);
          const isUploading = uploadingType === slot.type;
          const isDocApproved = doc?.status === 'APPROVED';
          const isDocRejected = doc?.status === 'REJECTED';

          return (
            <View key={slot.type} style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docIconBox}>
                  <Ionicons name={slot.icon} size={22} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.docTitleRow}>
                    <Text style={styles.docTitle}>{slot.title}</Text>
                    {slot.required ? <Text style={styles.requiredTag}>REQUIRED</Text> : null}
                  </View>
                  <Text style={styles.docDesc}>{slot.desc}</Text>
                </View>
              </View>

              {/* Document Status / File Preview */}
              {isUploaded ? (
                <View style={styles.uploadedInfoRow}>
                  <Ionicons
                    name={isDocApproved ? 'checkmark-circle' : isDocRejected ? 'close-circle' : 'document-text'}
                    size={16}
                    color={isDocApproved ? '#15803D' : isDocRejected ? '#B91C1C' : colors.primaryDark}
                  />
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {doc.fileName || `${slot.type.toLowerCase()}.jpg`}
                  </Text>
                  <View
                    style={[
                      styles.docStatusPill,
                      {
                        backgroundColor: isDocApproved
                          ? '#DCFCE7'
                          : isDocRejected
                          ? '#FEE2E2'
                          : '#FEF3C7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.docStatusPillText,
                        {
                          color: isDocApproved
                            ? '#15803D'
                            : isDocRejected
                            ? '#B91C1C'
                            : '#92400E',
                        },
                      ]}
                    >
                      {doc.status || 'PENDING'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Action Button */}
              <View style={styles.docActionRow}>
                <TouchableOpacity
                  style={[
                    styles.uploadBtn,
                    isUploaded && styles.uploadBtnSecondary,
                    isUploading && { opacity: 0.6 },
                  ]}
                  onPress={() => pickAndUploadDocument(slot.type)}
                  disabled={isUploading || isDocApproved}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={isUploaded ? colors.primaryDark : '#FFFFFF'} />
                  ) : (
                    <>
                      <Ionicons
                        name={isUploaded ? 'refresh-outline' : 'cloud-upload-outline'}
                        size={16}
                        color={isUploaded ? colors.primaryDark : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.uploadBtnText,
                          isUploaded && { color: colors.primaryDark },
                        ]}
                      >
                        {isDocApproved
                          ? 'Verified'
                          : isUploaded
                          ? 'Re-upload / Replace'
                          : 'Upload Document'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Submit Button */}
        {verificationStatus !== 'VERIFIED' && verificationStatus !== 'APPROVED' ? (
          <View style={styles.submitSection}>
            <AppButton
              title={
                verificationStatus === 'UNDER_REVIEW'
                  ? 'Verification Under Review ⏳'
                  : 'Submit for Admin Verification 🚀'
              }
              onPress={handleSubmitVerification}
              disabled={submitting || !isAllMandatoryUploaded || verificationStatus === 'UNDER_REVIEW'}
              loading={submitting}
              variant="primary"
              size="lg"
            />
            {!isAllMandatoryUploaded ? (
              <Text style={styles.missingDocsText}>
                ⚠️ Please upload all 4 required documents above to enable submission.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.approvedCard}>
            <Ionicons name="checkmark-circle" size={32} color="#15803D" />
            <Text style={styles.approvedTitle}>Company Verified</Text>
            <Text style={styles.approvedSubtitle}>
              Your company has full access to staff scheduling, worker assignment, and job management.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
  },
  progressPercentText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  companyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  companySub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: radius.full,
  },
  progressHint: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  alertTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  alertBody: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  docIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  requiredTag: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  docDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  uploadedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: 8,
    marginTop: spacing.sm,
    gap: 6,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textPrimary,
  },
  docStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  docStatusPillText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  docActionRow: {
    marginTop: spacing.sm,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingVertical: 10,
    gap: 6,
  },
  uploadBtnSecondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  submitSection: {
    marginTop: spacing.lg,
  },
  missingDocsText: {
    fontSize: typography.sizes.xs,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  approvedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  approvedTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#15803D',
  },
  approvedSubtitle: {
    fontSize: typography.sizes.xs,
    color: '#166534',
    textAlign: 'center',
  },
});
