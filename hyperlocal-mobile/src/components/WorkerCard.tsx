import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { WorkerAvatar } from './WorkerAvatar';
import { AppButton } from './AppButton';
import { normalizeWorkerData } from '../utils/workerUtils';
import { resolveWorkerImage } from '../utils/imageUtils';

interface WorkerCardProps {
  worker: any;
  onPressProfile?: () => void;
  onPressBook?: () => void;
  layout?: 'horizontal' | 'vertical';
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onPressProfile,
  onPressBook,
  layout = 'horizontal',
}) => {
  const normalized = normalizeWorkerData(worker);
  if (!normalized) return null;

  const profileImage = resolveWorkerImage(worker);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <WorkerAvatar
          uri={profileImage}
          name={normalized.name}
          size="lg"
          isVerified={normalized.isVerified}
        />

        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.nameText}>
              {normalized.name}
            </Text>
          </View>

          <Text numberOfLines={1} style={styles.categoryText}>
            {normalized.categoryName}
          </Text>

          <View style={styles.badgeRow}>
            {normalized.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            )}

            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{normalized.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceAmount}>₹{normalized.hourlyRate}</Text>
          <Text style={styles.priceUnit}>/hr</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={onPressProfile}
          activeOpacity={0.7}
        >
          <Text style={styles.profileButtonText}>Profile</Text>
        </TouchableOpacity>

        <AppButton
          title="Book Worker"
          onPress={onPressBook || (() => {})}
          variant="primary"
          size="sm"
          fullWidth={false}
          style={styles.bookButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  priceUnit: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  profileButton: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  bookButton: {
    flex: 1.2,
  },
});
