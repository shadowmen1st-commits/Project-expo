import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { resolveWorkerImage, getUserInitials } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface WorkerSwipeStackProps {
  workers: any[];
  onShortlist?: (worker: any) => void;
  onSkip?: (worker: any) => void;
  onSelectWorker?: (worker: any) => void;
  onResetDeck?: () => void;
}

export const WorkerSwipeStack: React.FC<WorkerSwipeStackProps> = ({
  workers,
  onShortlist,
  onSkip,
  onSelectWorker,
  onResetDeck,
}) => {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shortlistedCount, setShortlistedCount] = useState(0);

  const position = useRef(new Animated.ValueXY()).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.8, 0, SCREEN_WIDTH * 0.8],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [10, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, -10],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [1, 0.94, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const forceSwipe = (direction: 'right' | 'left') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: 'right' | 'left') => {
    const item = workers[currentIndex];
    if (direction === 'right') {
      onShortlist?.(item);
      setShortlistedCount((prev) => prev + 1);
    } else {
      onSkip?.(item);
    }
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setShortlistedCount(0);
    onResetDeck?.();
  };

  if (currentIndex >= workers.length) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="sparkles-sharp" size={44} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>
            You've reviewed all available verified professionals in this search.
          </Text>

          {shortlistedCount > 0 && (
            <View style={styles.shortlistBadgeBox}>
              <Ionicons name="heart" size={18} color={colors.accent} />
              <Text style={styles.shortlistBadgeText}>
                {shortlistedCount} Professional{shortlistedCount > 1 ? 's' : ''} Shortlisted
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color={colors.textInverted} />
            <Text style={styles.resetBtnText}>Start Over</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentWorker = workers[currentIndex];
  const nextWorker = workers[currentIndex + 1];

  const currentImage = resolveWorkerImage(currentWorker);
  const nextImage = nextWorker ? resolveWorkerImage(nextWorker) : null;

  const currentName = currentWorker.name || currentWorker.user?.name || 'Verified Pro';
  const nextName = nextWorker ? nextWorker.name || nextWorker.user?.name || 'Verified Pro' : '';

  const categoryName =
    currentWorker.categoryName ||
    currentWorker.serviceCategoryName ||
    currentWorker.category?.name ||
    'Home Services';

  const hourlyRate = currentWorker.hourlyRate || currentWorker.rate || 499;
  const rating = currentWorker.rating || currentWorker.averageRating || 4.9;
  const completedJobs = currentWorker.completedBookingsCount || currentWorker.jobsCount || 24;
  const experience = currentWorker.yearsOfExperience || currentWorker.experience || 3;
  const skills: string[] = Array.isArray(currentWorker.skills) ? currentWorker.skills : ['Verified Service', 'Top Rated'];

  return (
    <View style={styles.deckContainer}>
      {/* Background Next Card */}
      {nextWorker && (
        <Animated.View
          style={[
            styles.cardContainer,
            styles.nextCard,
            {
              transform: [{ scale: nextCardScale }],
            },
          ]}
        >
          <View style={styles.cardHeader}>
            {nextImage ? (
              <Image source={{ uri: nextImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.fallbackInitials}>{getUserInitials(nextName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.workerName}>{nextName}</Text>
            <Text style={styles.categoryBadgeText}>{nextWorker.categoryName || 'Service Professional'}</Text>
          </View>
        </Animated.View>
      )}

      {/* Top Interactive Front Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardContainer,
          styles.topCard,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate: rotate },
            ],
          },
        ]}
      >
        {/* Swipe Overlays */}
        <Animated.View style={[styles.stampOverlay, styles.likeStamp, { opacity: likeOpacity }]}>
          <Text style={styles.likeStampText}>INTERESTED</Text>
        </Animated.View>

        <Animated.View style={[styles.stampOverlay, styles.nopeStamp, { opacity: nopeOpacity }]}>
          <Text style={styles.nopeStampText}>SKIP</Text>
        </Animated.View>

        {/* Card Header & Photo */}
        <TouchableOpacity
          activeOpacity={0.95}
          style={styles.cardTouchable}
          onPress={() => {
            if (onSelectWorker) onSelectWorker(currentWorker);
            else router.push(`/(customer)/worker/${currentWorker._id || currentWorker.id}`);
          }}
        >
          <View style={styles.cardHeader}>
            {currentImage ? (
              <Image source={{ uri: currentImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.fallbackInitials}>{getUserInitials(currentName)}</Text>
              </View>
            )}

            {/* Floating Top Badges */}
            <View style={styles.topBadgesRow}>
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-seal-sharp" size={14} color="#0284C7" />
                <Text style={styles.verifiedChipText}>VERIFIED PRO</Text>
              </View>

              <View style={styles.rateChip}>
                <Text style={styles.rateChipText}>₹{hourlyRate}/hr</Text>
              </View>
            </View>
          </View>

          {/* Card Body Details */}
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.workerName}>{currentName}</Text>
              <View style={styles.ratingBox}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
              </View>
            </View>

            <View style={styles.categoryRow}>
              <View style={styles.categoryPill}>
                <Ionicons name="briefcase-outline" size={12} color={colors.accent} />
                <Text style={styles.categoryPillText}>{categoryName}</Text>
              </View>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{experience} yrs exp</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{completedJobs} jobs</Text>
            </View>

            {/* Skills Pills */}
            <View style={styles.skillsRow}>
              {skills.slice(0, 3).map((skill, i) => (
                <View key={i} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                </View>
              ))}
            </View>

            <View style={styles.footerRow}>
              <View style={styles.locationBox}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>Bengaluru • Active Now</Text>
              </View>
              <Text style={styles.tapDetailText}>Tap for full bio →</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Action Buttons Toolbar below Card */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={() => forceSwipe('left')}
          activeOpacity={0.8}
        >
          <Ionicons name="close-sharp" size={26} color="#EF4444" />
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.detailsButton]}
          onPress={() => {
            if (onSelectWorker) onSelectWorker(currentWorker);
            else router.push(`/(customer)/worker/${currentWorker._id || currentWorker.id}`);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.detailsButtonText}>View Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => forceSwipe('right')}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={24} color="#10B981" />
          <Text style={styles.likeButtonText}>Shortlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  deckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cardContainer: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: Platform.OS === 'ios' ? 470 : 450,
    borderRadius: radius.xxl || 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.lg,
  },
  topCard: {
    position: 'absolute',
    zIndex: 10,
    elevation: 8,
  },
  nextCard: {
    position: 'absolute',
    zIndex: 5,
    elevation: 4,
    top: 10,
  },
  cardTouchable: {
    flex: 1,
  },
  cardHeader: {
    height: 250,
    width: '100%',
    backgroundColor: colors.surfaceSecondary,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInitials: {
    fontSize: 48,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  topBadgesRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
    ...shadows.sm,
  },
  verifiedChipText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  rateChip: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  rateChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textInverted,
  },
  cardBody: {
    padding: spacing.md,
    justifyContent: 'space-between',
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  ratingText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#D97706',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 4,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  categoryBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  skillChip: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  skillChipText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  tapDetailText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },

  // Stamp Overlays
  stampOverlay: {
    position: 'absolute',
    top: 30,
    zIndex: 20,
    borderWidth: 3,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  likeStamp: {
    left: 24,
    borderColor: '#10B981',
    transform: [{ rotate: '-15deg' }],
  },
  likeStampText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1,
  },
  nopeStamp: {
    right: 24,
    borderColor: '#EF4444',
    transform: [{ rotate: '15deg' }],
  },
  nopeStampText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 1,
  },

  // Action Buttons Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: Platform.OS === 'ios' ? 490 : 470,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    gap: 6,
    ...shadows.sm,
  },
  skipButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  skipButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#EF4444',
  },
  detailsButton: {
    borderColor: colors.border,
  },
  detailsButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  likeButton: {
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
  },
  likeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#10B981',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl || 24,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
    maxWidth: 340,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  shortlistBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
    gap: 6,
  },
  shortlistBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    gap: 8,
  },
  resetBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textInverted,
  },
});
