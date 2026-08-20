import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MobileHeader } from '../../../components/MobileHeader';
import { WorkerAvatar } from '../../../components/WorkerAvatar';
import { AppButton } from '../../../components/AppButton';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../../theme';
import { getCanonicalWorkerId, isValidObjectId, normalizeWorkerData } from '../../../utils/workerUtils';
import { resolveWorkerImage } from '../../../utils/imageUtils';

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rawId = Array.isArray(id) ? id[0] : id;
  const canonicalParamId = getCanonicalWorkerId(rawId);

  useEffect(() => {
    const fetchWorker = async () => {
      if (!canonicalParamId || !isValidObjectId(canonicalParamId)) {
        setError('Invalid worker ID parameter. Please select a valid professional.');
        setLoading(false);
        return;
      }

      try {
        const res = await api
          .get(`/workers/profile/${canonicalParamId}`)
          .catch(() => api.get(`/workers/${canonicalParamId}`));

        const data = res.data?.data || res.data?.worker || res.data;
        if (data && (data.workerId || data._id || data.id || data.name)) {
          setWorker(data);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        // Fallback to search list
      }

      try {
        const searchRes = await api.get('/workers/search');
        const list = Array.isArray(searchRes.data)
          ? searchRes.data
          : searchRes.data?.data || searchRes.data?.workers || [];

        const found = list.find((w: any) => getCanonicalWorkerId(w) === canonicalParamId);
        if (found) {
          setWorker(found);
        } else {
          setError('Worker profile not found in active database.');
        }
      } catch {
        setError('Unable to load worker profile. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorker();
  }, [canonicalParamId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Worker Profile" showBack />
        <LoadingState message="Loading worker profile details..." />
      </View>
    );
  }

  if (error || !worker) {
    return (
      <View style={styles.container}>
        <MobileHeader title="Worker Profile" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Profile Unavailable"
          description={error || 'The requested worker profile could not be found.'}
          actionTitle="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const normalized = normalizeWorkerData(worker);
  const targetWorkerId = getCanonicalWorkerId(worker) || canonicalParamId;
  const profileImage = resolveWorkerImage(worker);

  return (
    <View style={styles.container}>
      <MobileHeader title="Worker Profile" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Worker Hero Profile Card */}
        <View style={styles.profileHeroCard}>
          <WorkerAvatar
            uri={profileImage}
            name={normalized.name}
            size="xl"
            isVerified={normalized.isVerified}
          />

          <Text style={styles.nameText}>{normalized.name}</Text>
          <Text style={styles.categoryText}>{normalized.categoryName}</Text>

          {normalized.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.verifiedText}>Verified Professional</Text>
            </View>
          )}

          {/* Quick Stats Row */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={styles.statVal}>{normalized.rating.toFixed(1)}</Text>
              <Text style={styles.statLbl}>Rating</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="briefcase" size={18} color={colors.accent} />
              <Text style={styles.statVal}>{normalized.completedJobs}</Text>
              <Text style={styles.statLbl}>Jobs Done</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="ribbon" size={18} color={colors.primaryDark} />
              <Text style={styles.statVal}>{normalized.experienceYears}+ yrs</Text>
              <Text style={styles.statLbl}>Experience</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About Professional</Text>
          <Text style={styles.bioText}>{normalized.bio}</Text>
        </View>

        {/* Skills & Specialties */}
        {normalized.skills && normalized.skills.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Skills & Specialties</Text>
            <View style={styles.skillsRow}>
              {normalized.skills.map((skill: string, index: number) => (
                <View key={index} style={styles.skillChip}>
                  <Ionicons name="checkmark" size={12} color={colors.accent} />
                  <Text style={styles.skillChipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Service Information Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Information</Text>

          <View style={styles.infoRow}>
            <Ionicons name="grid-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Primary Service:</Text>
            <Text style={styles.infoValue}>{normalized.categoryName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Coverage Area:</Text>
            <Text style={styles.infoValue}>
              {worker.city ? `${worker.city} & Surrounding Areas` : worker.serviceArea || 'Local City & Surrounding Areas'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Working Hours:</Text>
            <Text style={styles.infoValue}>Mon - Sat (8:00 AM - 8:00 PM)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Booking Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceColumn}>
          <Text style={styles.bottomPriceLabel}>Standard Rate</Text>
          <Text style={styles.bottomPriceValue}>
            ₹{normalized.hourlyRate} <Text style={styles.unitText}>/ hr</Text>
          </Text>
        </View>

        <AppButton
          title="Book This Worker"
          variant="primary"
          icon="calendar-outline"
          onPress={() => {
            if (targetWorkerId && isValidObjectId(targetWorkerId)) {
              router.push(`/(customer)/booking/${targetWorkerId}`);
            } else {
              setError('Unable to book this worker due to missing canonical ID.');
            }
          }}
          fullWidth={false}
          style={styles.bookButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 3,
  },
  profileHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  nameText: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: spacing.md,
    gap: 4,
  },
  verifiedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    width: '100%',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  statLbl: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bioText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  skillChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    flex: 1,
    textAlign: 'right',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.lg,
  },
  priceColumn: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  bottomPriceValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  unitText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.regular,
  },
  bookButton: {
    flex: 1.4,
  },
});
