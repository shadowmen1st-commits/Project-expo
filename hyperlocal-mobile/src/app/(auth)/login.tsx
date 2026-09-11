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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { Ionicons } from '@expo/vector-icons';
import { checkServerHealth } from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

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
        router.replace('/(customer)/dashboard');
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

  const handleQuickLogin = (role: 'ADMIN' | 'CUSTOMER' | 'WORKER' | 'COMPANY') => {
    let qEmail = 'customer@test.com';
    let qPass = 'Customer@123';
    if (role === 'WORKER') {
      qEmail = 'worker@test.com';
      qPass = 'Worker@123';
    } else if (role === 'COMPANY') {
      qEmail = 'company@test.com';
      qPass = 'Company@12345';
    } else if (role === 'ADMIN') {
      qEmail = 'admin@test.com';
      qPass = 'Admin@12345';
    }
    setEmail(qEmail);
    setPassword(qPass);
    handleLogin(qEmail, qPass);
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

          {/* Quick Demo Sign-In (All 4 Roles) */}
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>Developer Quick Login (Demo)</Text>
            <View style={styles.demoGrid}>
              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: '#F3E8FF', opacity: loading ? 0.5 : 1 }]}
                onPress={() => handleQuickLogin('ADMIN')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons name="shield-checkmark-outline" size={14} color="#7E22CE" />
                <Text style={[styles.demoChipText, { color: '#7E22CE' }]}>Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: colors.accentLight, opacity: loading ? 0.5 : 1 }]}
                onPress={() => handleQuickLogin('CUSTOMER')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons name="person-outline" size={14} color={colors.accent} />
                <Text style={[styles.demoChipText, { color: colors.accent }]}>Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: colors.primaryLight, opacity: loading ? 0.5 : 1 }]}
                onPress={() => handleQuickLogin('WORKER')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons name="construct-outline" size={14} color={colors.primaryDark} />
                <Text style={[styles.demoChipText, { color: colors.primaryDark }]}>Worker</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: '#DCFCE7', opacity: loading ? 0.5 : 1 }]}
                onPress={() => handleQuickLogin('COMPANY')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons name="business-outline" size={14} color="#15803D" />
                <Text style={[styles.demoChipText, { color: "#15803D" }]}>Company</Text>
              </TouchableOpacity>
            </View>
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
  demoSection: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    ...shadows.sm,
  },
  demoSectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    width: '100%',
    justifyContent: 'space-between',
  },
  demoChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
    marginBottom: spacing.xs,
  },
  demoChipText: {
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
