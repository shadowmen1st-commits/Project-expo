import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { Ionicons } from '@expo/vector-icons';
import { checkServerHealth } from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { storage } from '../../utils/storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Perform server health check diagnostic on login screen load
    checkServerHealth().catch(() => {});
  }, []);

  const handleLogin = async (customEmail?: any, customPassword?: any) => {
    // If called directly without explicit string arguments (e.g. from Pressable event), use state
    const targetEmail = typeof customEmail === 'string' && customEmail.length > 0 ? customEmail : email;
    const targetPassword = typeof customPassword === 'string' && customPassword.length > 0 ? customPassword : password;

    if (!targetEmail.trim() || !targetPassword.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const loggedInUser = await login(targetEmail.trim(), targetPassword);

      if (loggedInUser?.role === 'ADMIN') {
        router.replace('/(admin)/dashboard');
      } else if (loggedInUser?.role === 'COMPANY') {
        router.replace('/(company)/dashboard');
      } else if (loggedInUser?.role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else {
        // Check if there is a pending guest booking to resume
        const pendingRaw = await storage.getItem('JOBNEST_GUEST_PENDING_BOOKING');
        let targetWorkerId = params.workerId ? String(params.workerId) : '';
        if (pendingRaw) {
          try {
            const p = JSON.parse(pendingRaw);
            if (p?.workerId) targetWorkerId = p.workerId;
          } catch {}
        }
        if (params.redirect === 'booking' || targetWorkerId) {
          router.replace(`/(customer)/booking/${targetWorkerId}` as any);
        } else {
          router.replace('/(customer)/dashboard');
        }
      }
    } catch (err: any) {
      if (err.userMessage) {
        setError(err.userMessage);
      } else if (err.response?.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="home" size={28} color={colors.accent} />
            </View>
            <Text style={styles.title}>Jobnest</Text>
            <Text style={styles.subtitle}>Welcome back 👋</Text>
            <Text style={styles.subtext}>Sign in to access your account & services</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <AppInput
              label="Email Address"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <AppInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />

            <AppButton
              title="Sign In"
              onPress={() => handleLogin()}
              loading={loading}
              disabled={loading}
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />

            {/* Explore Demo Customer Account Button */}
            <TouchableOpacity
              style={styles.demoAccountBtn}
              onPress={() => handleLogin('demo@jobnest.com', 'Demo@123')}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Ionicons name="sparkles" size={16} color={colors.accent} />
              <Text style={styles.demoAccountBtnText}>Explore Demo Account</Text>
            </TouchableOpacity>

            {/* Browse as Guest Link */}
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: 6 }}
              onPress={() => router.replace('/(customer)/dashboard')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                ← Browse Marketplace as Guest
              </Text>
            </TouchableOpacity>

            {/* Social Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <GoogleSignInButton
              mode="LOGIN"
              role="CUSTOMER"
              label="Continue with Google"
              onError={(err) => setError(err)}
            />
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.footerContainer, { marginTop: spacing.md }]}>
            <TouchableOpacity onPress={() => router.push('/(auth)/company-register')}>
              <Text style={[styles.signupLink, { color: colors.accent, fontWeight: '700' }]}>
                🏢 Register as a Company / Business
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  subtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formContainer: {
    gap: spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    flex: 1,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  demoAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  demoAccountBtnText: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  signupLink: {
    color: colors.primaryDark,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight || '#E2E8F0',
  },
  dividerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted || '#94A3B8',
    letterSpacing: 0.5,
  },
});
