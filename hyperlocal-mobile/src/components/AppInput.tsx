import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

const webOutlineStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } as any) : {};

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...restProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const isPasswordInput = secureTextEntry !== undefined;
  const showSecureText = isPasswordInput && !isPasswordVisible;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          webOutlineStyle,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.primaryDark : colors.textMuted}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[styles.input, webOutlineStyle, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={showSecureText}
          {...restProps}
        />
        {isPasswordInput ? (
          <TouchableOpacity
            style={styles.rightIconButton}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : (
          rightIcon && (
            <TouchableOpacity
              style={styles.rightIconButton}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightIcon} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )
        )}
      </View>
      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.error,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIconButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
});
