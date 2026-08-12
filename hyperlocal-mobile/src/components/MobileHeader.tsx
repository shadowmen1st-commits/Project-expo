import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  transparent?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  rightIcon,
  rightText,
  transparent = false,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/dashboard');
    }
  };

  useEffect(() => {
    if (!showBack) return;

    const onBackPress = () => {
      handleBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [showBack, onBack]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 12) + 4 },
        transparent ? styles.transparent : styles.solid,
      ]}
    >
      <View style={styles.headerContent}>
        <View style={styles.leftContainer}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.titleContainer}>
          <Text numberOfLines={1} style={styles.titleText}>
            {title}
          </Text>
          {subtitle && (
            <Text numberOfLines={1} style={styles.subtitleText}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightContainer}>
          {rightAction && (rightIcon || rightText) && (
            <TouchableOpacity
              style={styles.rightButton}
              onPress={rightAction}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {rightIcon && <Ionicons name={rightIcon} size={22} color={colors.primaryDark} />}
              {rightText && <Text style={styles.rightText}>{rightText}</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  solid: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  headerContent: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  titleText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },
  rightContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
});
