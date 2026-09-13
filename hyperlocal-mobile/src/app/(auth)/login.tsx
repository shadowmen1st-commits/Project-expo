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

  const [selectedRole, setSelectedRole] = useState<'CUSTOMER' | 'WORKER'>('CUSTOMER');

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
        if (
          loggedInUser.verificationStatus === 'APPROVED' ||
          loggedInUser.isKycVerified === true ||
          loggedInUser.verificationBadge === true
        ) {
          router.replace('/(worker)/dashboard');
        } else {
          router.replace('/(worker)/profile');
        }
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
            <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12, alignSelf: 'center' }}>
              <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
            </View>
            <Text style={styles.title}>Shadowman</Text>
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

            {/* Account Role Selector */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderWidth: 1.5,
                  borderColor: selectedRole === 'CUSTOMER' ? colors.primary : colors.border,
                  borderRadius: radius.md,
                  backgroundColor: selectedRole === 'CUSTOMER' ? colors.primaryLight : colors.surface,
                  gap: 6,
                }}
                onPress={() => setSelectedRole('CUSTOMER')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={selectedRole === 'CUSTOMER' ? colors.primaryDark : colors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selectedRole === 'CUSTOMER' ? '700' : '600',
                    color: selectedRole === 'CUSTOMER' ? colors.primaryDark : colors.textSecondary,
                  }}
                >
                  Customer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderWidth: 1.5,
                  borderColor: selectedRole === 'WORKER' ? colors.primary : colors.border,
                  borderRadius: radius.md,
                  backgroundColor: selectedRole === 'WORKER' ? colors.primaryLight : colors.surface,
                  gap: 6,
                }}
                onPress={() => setSelectedRole('WORKER')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={18}
                  color={selectedRole === 'WORKER' ? colors.primaryDark : colors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selectedRole === 'WORKER' ? '700' : '600',
                    color: selectedRole === 'WORKER' ? colors.primaryDark : colors.textSecondary,
                  }}
                >
                  Worker Pro
                </Text>
              </TouchableOpacity>
            </View>

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
              title={selectedRole === 'WORKER' ? 'Sign In as Worker' : 'Sign In'}
              onPress={() => handleLogin()}
              loading={loading}
              disabled={loading}
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />

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

            {/* Demo Accounts Quick Login */}
            <View style={{ marginTop: spacing.md, padding: spacing.sm, backgroundColor: '#F8FAFC', borderRadius: radius.md, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textAlign: 'center' }}>
                ⚡ Quick Demo Sign In
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm }}
                  onPress={() => {
                    setEmail('admin@test.com');
                    setPassword('Admin@12345');
                    handleLogin('admin@test.com', 'Admin@12345');
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>👑 Admin Demo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm }}
                  onPress={() => {
                    setEmail('company@test.com');
                    setPassword('Company@12345');
                    handleLogin('company@test.com', 'Company@12345');
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>🏢 Company Demo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm }}
                  onPress={() => {
                    setEmail('customer@test.com');
                    setPassword('Customer@12345');
                    handleLogin('customer@test.com', 'Customer@12345');
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>👤 Customer Demo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Social Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <GoogleSignInButton
              mode="LOGIN"
              role={selectedRole}
              label={selectedRole === 'WORKER' ? 'Sign in as Worker with Google' : 'Continue with Google'}
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
