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
import { getCanonicalWorkerId, normalizeWorkerData } from '../utils/workerUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.32;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - spacing.lg * 2, 380);
const CARD_HEIGHT = Platform.OS === 'ios' ? 420 : 410;

interface WorkerSwipeStackProps {
  workers: any[];
  onShortlist?: (worker: any) => void;
  onSkip?: (worker: any) => void;
  onSelectWorker?: (worker: any) => void;
  onBookWorker?: (worker: any) => void;
}

export const WorkerSwipeStack: React.FC<WorkerSwipeStackProps> = ({
  workers = [],
  onShortlist,
  onSkip,
  onSelectWorker,
  onBookWorker,
}) => {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [shortlistedCount, setShortlistedCount] = useState(0);

  const position = useRef(new Animated.ValueXY()).current;

  // Rotation based on horizontal swipe position
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.8, 0, SCREEN_WIDTH * 0.8],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  // Stamp opacities
  const likeOpacity = position.x.interpolate({
    inputRange: [15, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, -15],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Subtle scale up of underneath card as top card is swiped
  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only take over gesture if significant horizontal swipe is detected
        return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy * 0.4 });
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
    const x = direction === 'right' ? SCREEN_WIDTH * 1.4 : -SCREEN_WIDTH * 1.4;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: 'right' | 'left') => {
    if (workers.length === 0) return;
    const currentWorker = workers[index % workers.length];

    if (direction === 'right') {
      onShortlist?.(currentWorker);
      setShortlistedCount((prev) => prev + 1);
    } else {
      onSkip?.(currentWorker);
    }

    position.setValue({ x: 0, y: 0 });
    // Infinite modular wrap-around
    setIndex((prev) => (prev + 1) % workers.length);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      useNativeDriver: false,
    }).start();
  };

  if (!workers || workers.length === 0) {
    return null;
  }

  // Infinite repeating wrap around
  const currentIndex = index % workers.length;
  const nextIndex = (index + 1) % workers.length;

  const rawCurrentWorker = workers[currentIndex];
  const rawNextWorker = workers.length > 1 ? workers[nextIndex] : rawCurrentWorker;

  const current = normalizeWorkerData(rawCurrentWorker);
  const next = normalizeWorkerData(rawNextWorker);

  const currentImage = resolveWorkerImage(rawCurrentWorker);
  const nextImage = resolveWorkerImage(rawNextWorker);

  const currentWorkerId = getCanonicalWorkerId(rawCurrentWorker);

  const handleOpenProfile = () => {
    if (onSelectWorker) {
      onSelectWorker(rawCurrentWorker);
    } else if (currentWorkerId) {
      router.push(`/(customer)/worker/${currentWorkerId}`);
    }
  };

  const handleBook = () => {
    if (onBookWorker) {
      onBookWorker(rawCurrentWorker);
    } else if (currentWorkerId) {
      router.push(`/(customer)/booking/${currentWorkerId}`);
    }
  };

  return (
    <View style={styles.deckWrapper}>
      {/* Shortlist Badge Counter if > 0 */}
      {shortlistedCount > 0 && (
        <View style={styles.shortlistCounter}>
          <Ionicons name="heart" size={14} color="#10B981" />
          <Text style={styles.shortlistCounterText}>
            {shortlistedCount} Professional{shortlistedCount > 1 ? 's' : ''} Shortlisted
          </Text>
        </View>
      )}

      <View style={styles.cardsStackArea}>
        {/* Underneath Background Card */}
        {next && (
          <Animated.View
            style={[
              styles.cardContainer,
              styles.nextCard,
              {
                transform: [{ scale: nextCardScale }],
              },
            ]}
          >
            <View style={styles.cardHeaderImageArea}>
              {nextImage ? (
                <Image source={{ uri: nextImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.fallbackInitials}>{getUserInitials(next.name)}</Text>
                </View>
              )}
              <View style={styles.topBadgesRow}>
                <View style={styles.verifiedChip}>
                  <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
                  <Text style={styles.verifiedChipText}>VERIFIED</Text>
                </View>
                <View style={styles.rateChip}>
                  <Text style={styles.rateChipText}>₹{next.hourlyRate}/hr</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={styles.workerName}>{next.name}</Text>
                <View style={styles.ratingBox}>
                  <Ionicons name="star" size={13} color="#F59E0B" />
                  <Text style={styles.ratingText}>{next.rating.toFixed(1)}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.categorySubText}>{next.categoryName}</Text>
            </View>
          </Animated.View>
        )}

        {/* Top Interactive Front Card */}
        {current && (
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
            {/* LIKE & NOPE STAMPS */}
            <Animated.View style={[styles.stampOverlay, styles.likeStamp, { opacity: likeOpacity }]}>
              <Text style={styles.likeStampText}>SHORTLIST</Text>
            </Animated.View>

            <Animated.View style={[styles.stampOverlay, styles.nopeStamp, { opacity: nopeOpacity }]}>
              <Text style={styles.nopeStampText}>SKIP</Text>
            </Animated.View>

            <TouchableOpacity
              activeOpacity={0.96}
              style={styles.cardTouchable}
              onPress={handleOpenProfile}
            >
              {/* Photo Area */}
              <View style={styles.cardHeaderImageArea}>
                {currentImage ? (
                  <Image source={{ uri: currentImage }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.fallbackInitials}>{getUserInitials(current.name)}</Text>
                  </View>
                )}

                {/* Floating Top Status Badges */}
                <View style={styles.topBadgesRow}>
                  <View style={styles.verifiedChip}>
                    <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
                    <Text style={styles.verifiedChipText}>VERIFIED PRO</Text>
                  </View>

                  <View style={styles.rateChip}>
                    <Text style={styles.rateChipText}>₹{current.hourlyRate}/hr</Text>
                  </View>
                </View>

                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Active Now</Text>
                </View>
              </View>

              {/* Card Details Area */}
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text numberOfLines={1} style={styles.workerName}>{current.name}</Text>
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.ratingText}>{current.rating.toFixed(1)}</Text>
                  </View>
                </View>

                {/* Category & Meta */}
                <View style={styles.categoryRow}>
                  <View style={styles.categoryPill}>
                    <Ionicons name="briefcase-outline" size={11} color={colors.accent} />
                    <Text numberOfLines={1} style={styles.categoryPillText}>{current.categoryName}</Text>
                  </View>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{current.experienceYears} yrs exp</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{current.completedJobs} jobs</Text>
                </View>

                {/* Skills tags */}
                <View style={styles.skillsRow}>
                  {current.skills.slice(0, 3).map((s: string, i: number) => (
                    <View key={i} style={styles.skillTag}>
                      <Text style={styles.skillTagText}>{s}</Text>
                    </View>
                  ))}
                </View>

                {/* Footer link */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.locationBox}>
                    <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.locationText}>Indiranagar, BLR</Text>
                  </View>
                  <Text style={styles.viewProfilePrompt}>View Profile →</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Action Buttons Toolbar below Card */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.skipBtn]}
          onPress={() => forceSwipe('left')}
          activeOpacity={0.8}
        >
          <Ionicons name="close-sharp" size={24} color="#EF4444" />
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.profileBtn]}
          onPress={handleOpenProfile}
          activeOpacity={0.8}
        >
          <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.profileBtnText}>View Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.shortlistBtn]}
          onPress={() => forceSwipe('right')}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={22} color="#10B981" />
          <Text style={styles.shortlistBtnText}>Shortlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  deckWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  shortlistCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  shortlistCounterText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#065F46',
  },
  cardsStackArea: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.xl || 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.md,
  },
  topCard: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    elevation: 8,
  },
  nextCard: {
    position: 'absolute',
    top: 8,
    zIndex: 5,
    elevation: 4,
  },
  cardTouchable: {
    flex: 1,
  },
  cardHeaderImageArea: {
    height: 220,
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
    fontSize: 44,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  topBadgesRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  rateChipText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.textInverted,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.xs,
  },
  categorySubText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#D97706',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 3,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  skillTag: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  skillTagText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  viewProfilePrompt: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },

  // Stamp Overlays
  stampOverlay: {
    position: 'absolute',
    top: 24,
    zIndex: 25,
    borderWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  likeStamp: {
    left: 20,
    borderColor: '#10B981',
    transform: [{ rotate: '-12deg' }],
  },
  likeStampText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1,
  },
  nopeStamp: {
    right: 20,
    borderColor: '#EF4444',
    transform: [{ rotate: '12deg' }],
  },
  nopeStampText: {
    fontSize: 16,
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
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    gap: 6,
    ...shadows.sm,
  },
  skipBtn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  skipBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#EF4444',
  },
  profileBtn: {
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  profileBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  shortlistBtn: {
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
  },
  shortlistBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#10B981',
  },
});
