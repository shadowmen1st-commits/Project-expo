import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return {
          backgroundColor: colors.accent,
          borderColor: colors.accent,
          textColor: colors.textInverted,
          indicatorColor: colors.textInverted,
        };
      case 'secondary':
        return {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
          textColor: colors.textPrimary,
          indicatorColor: colors.textPrimary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primaryDark,
          textColor: colors.primaryDark,
          indicatorColor: colors.primaryDark,
        };
      case 'danger':
        return {
          backgroundColor: colors.error,
          borderColor: colors.error,
          textColor: colors.textInverted,
          indicatorColor: colors.textInverted,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: colors.textSecondary,
          indicatorColor: colors.textSecondary,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          textColor: colors.textPrimary,
          indicatorColor: colors.textPrimary,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { height: 38, paddingHorizontal: spacing.md, fontSize: typography.sizes.sm };
      case 'lg':
        return { height: 54, paddingHorizontal: spacing.xxl, fontSize: typography.sizes.lg };
      case 'md':
      default:
        return { height: 48, paddingHorizontal: spacing.lg, fontSize: typography.sizes.md };
    }
  };

  const variantConfig = getVariantStyles();
  const sizeConfig = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: variantConfig.backgroundColor,
          borderColor: variantConfig.borderColor,
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          width: fullWidth ? '100%' : undefined,
        },
        variant === 'primary' || variant === 'accent' ? shadows.sm : null,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantConfig.indicatorColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={sizeConfig.fontSize + 2}
              color={variantConfig.textColor}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: variantConfig.textColor,
                fontSize: sizeConfig.fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={sizeConfig.fontSize + 2}
              color={variantConfig.textColor}
              style={styles.rightIcon}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: spacing.xs + 2,
  },
  rightIcon: {
    marginLeft: spacing.xs + 2,
  },
});
