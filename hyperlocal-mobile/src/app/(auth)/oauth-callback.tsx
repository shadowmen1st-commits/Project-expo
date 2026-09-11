import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography, shadows } from '../../theme';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    oauth?: string;
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    errorCode?: string;
    message?: string;
  }>();

  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'FAILED'>('PROCESSING');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    handleCallback();
  }, [searchParams.oauth, searchParams.token, searchParams.accessToken, searchParams.errorCode]);

  const handleCallback = async () => {
    try {
      console.log('[OAUTH_DEEP_LINK_CALLBACK] Params received:', searchParams);

      if (searchParams.oauth === 'failed' || searchParams.errorCode) {
        setStatus('FAILED');
        setErrorMessage(searchParams.message || searchParams.errorCode || 'Authentication failed or was cancelled.');
        return;
      }

      const token = searchParams.token || searchParams.accessToken;
      if (!token) {
        setStatus('FAILED');
        setErrorMessage('No authentication token received from identity provider.');
        return;
      }

      setStatus('PROCESSING');
      const user = await loginWithToken(token, searchParams.refreshToken);
      setStatus('SUCCESS');

      setTimeout(() => {
        if (user.role === 'WORKER') {
          router.replace('/(worker)/dashboard');
        } else if (user.role === 'ADMIN') {
          router.replace('/(admin)/dashboard');
        } else if (user.role === 'COMPANY') {
          router.replace('/(company)/dashboard');
        } else {
          router.replace('/(customer)/dashboard');
        }
      }, 600);
    } catch (err: any) {
      console.error('[OAUTH_CALLBACK_ERROR]', err);
      setStatus('FAILED');
      setErrorMessage(err.message || 'Failed to complete authentication.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'PROCESSING' && (
          <>
            <ActivityIndicator size="large" color={colors.accent} style={styles.icon} />
            <Text style={styles.title}>Signing You In</Text>
            <Text style={styles.subtitle}>Securing session with Google...</Text>
          </>
        )}

        {status === 'SUCCESS' && (
          <>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.success }]}>Authenticated!</Text>
            <Text style={styles.subtitle}>Redirecting to your dashboard...</Text>
          </>
        )}

        {status === 'FAILED' && (
          <>
            <View style={styles.failedBadge}>
              <Ionicons name="alert-circle" size={56} color={colors.error} />
            </View>
            <Text style={[styles.title, { color: colors.error }]}>Authentication Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.retryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  successBadge: {
    marginBottom: spacing.md,
  },
  failedBadge: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
});
