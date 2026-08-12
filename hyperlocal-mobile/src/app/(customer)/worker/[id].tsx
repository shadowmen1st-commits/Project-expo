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

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorker = async () => {
      try {
        const res = await api.get(`/workers/${id}`);
        if (res.data?.worker) {
          setWorker(res.data.worker);
        } else if (res.data) {
          setWorker(res.data);
        }
      } catch (err: any) {
        try {
          const searchRes = await api.get('/workers/search');
          const list = Array.isArray(searchRes.data)
            ? searchRes.data
            : searchRes.data.workers || [];
          const found = list.find((w: any) => (w._id || w.id) === id);
          if (found) {
            setWorker(found);
          } else {
            setError('Worker profile not found.');
          }
        } catch {
          setError('Unable to load worker profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchWorker();
  }, [id]);

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

  const name =
    worker.fullName ||
    worker.name ||
    worker.user?.name ||
    worker.user?.fullName ||
    'Professional Specialist';

  const profileImage =
    worker.profileImage ||
    worker.profilePhoto ||
    worker.profileImageUrl ||
    worker.profilePhotoUrl ||
    worker.user?.profileImage ||
    worker.user?.profilePhoto;

  const categoryName =
    worker.categoryName ||
    worker.serviceCategory ||
    worker.category?.name ||
    worker.services?.[0]?.name ||
    'General Services';

  const hourlyRate =
    worker.hourlyRate || worker.pricePerHour || worker.rate || (worker.hourlyRatePaise ? worker.hourlyRatePaise / 100 : 300);

  const rating = worker.rating || worker.avgRating || 4.8;
  const experienceYears = worker.yearsOfExperience || worker.experience || 2;
  const isVerified = worker.isVerified || worker.verified || worker.verificationStatus === 'APPROVED';

  return (
    <View style={styles.container}>
      <MobileHeader title="Worker Profile" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Worker Hero Profile Card */}
        <View style={styles.profileHeroCard}>
          <WorkerAvatar uri={profileImage} name={name} size="xxl" isVerified={isVerified} />
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.categoryText}>{categoryName}</Text>

          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.verifiedText}>SHADOW MEN VERIFIED PRO</Text>
            </View>
          )}

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={20} color={colors.gold} />
              <Text style={styles.statVal}>{Number(rating).toFixed(1)}</Text>
              <Text style={styles.statLbl}>Rating</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="briefcase-outline" size={20} color={colors.accent} />
              <Text style={styles.statVal}>{experienceYears} Yrs</Text>
              <Text style={styles.statLbl}>Experience</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="cash-outline" size={20} color={colors.success} />
              <Text style={styles.statVal}>₹{hourlyRate}</Text>
              <Text style={styles.statLbl}>Per Hour</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About Worker</Text>
          <Text style={styles.bioText}>
            {worker.bio ||
              `${name} is a background-verified, experienced ${categoryName} specialist committed to quality, punctual service and clean workmanship.`}
          </Text>
        </View>

        {/* Service Information Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="grid-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Category:</Text>
            <Text style={styles.infoValue}>{categoryName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Coverage Area:</Text>
            <Text style={styles.infoValue}>{worker.city || 'Indiranagar & Nearby (5km)'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.infoLabel}>Availability:</Text>
            <Text style={styles.infoValue}>Mon - Sat (8:00 AM - 8:00 PM)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Booking Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceColumn}>
          <Text style={styles.bottomPriceLabel}>Standard Rate</Text>
          <Text style={styles.bottomPriceValue}>
            ₹{hourlyRate} <Text style={styles.unitText}>/ hr</Text>
          </Text>
        </View>

        <AppButton
          title="Book This Worker"
          variant="primary"
          icon="calendar-outline"
          onPress={() => router.push(`/(customer)/booking/${worker._id || worker.id}`)}
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
