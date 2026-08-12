import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isPrimary && styles.btnPrimary,
        isSecondary && styles.btnSecondary,
        isOutline && styles.btnOutline,
        isDanger && styles.btnDanger,
        isSm && styles.btnSm,
        isLg && styles.btnLg,
        disabled && styles.btnDisabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isSecondary ? '#EA580C' : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && styles.textPrimary,
            isSecondary && styles.textSecondary,
            isOutline && styles.textOutline,
            isDanger && styles.textDanger,
            isSm && styles.textSm,
            isLg && styles.textLg,
            disabled && styles.textDisabled,
            textStyle
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  btnLg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14
  },
  btnPrimary: {
    backgroundColor: '#EA580C'
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9'
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#EA580C'
  },
  btnDanger: {
    backgroundColor: '#DC2626'
  },
  btnDisabled: {
    backgroundColor: '#CBD5E1',
    borderColor: '#CBD5E1'
  },
  text: {
    fontWeight: '700',
    fontSize: 15
  },
  textSm: {
    fontSize: 13
  },
  textLg: {
    fontSize: 17
  },
  textPrimary: {
    color: '#FFFFFF'
  },
  textSecondary: {
    color: '#334155'
  },
  textOutline: {
    color: '#EA580C'
  },
  textDanger: {
    color: '#FFFFFF'
  },
  textDisabled: {
    color: '#94A3B8'
  }
});

export default Button;
