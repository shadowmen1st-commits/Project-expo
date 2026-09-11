import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../theme';

interface GoogleSignInButtonProps {
  mode?: 'LOGIN' | 'SIGNUP';
  role?: 'CUSTOMER' | 'WORKER';
  label?: string;
  style?: ViewStyle;
  onError?: (errorMsg: string) => void;
  onSuccess?: () => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  mode = 'LOGIN',
  role = 'CUSTOMER',
  label = 'Continue with Google',
  style,
  onError,
  onSuccess,
}) => {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePress = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const user = await googleLogin(mode, role);
      if (onSuccess) {
        onSuccess();
      } else {
        if (user.role === 'WORKER') {
          router.replace('/(worker)/dashboard');
        } else if (user.role === 'ADMIN') {
          router.replace('/(admin)/dashboard');
        } else if (user.role === 'COMPANY') {
          router.replace('/(company)/dashboard');
        } else {
          router.replace('/(customer)/dashboard');
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Google sign-in could not be completed.';
      if (onError) {
        onError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style, loading && styles.buttonDisabled]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <View style={styles.contentRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="logo-google" size={20} color="#4285F4" />
          </View>
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#1E293B',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    letterSpacing: -0.2,
  },
});
