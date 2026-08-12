import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogin = async (loginEmail?: string, loginPass?: string) => {
    const targetEmail = (loginEmail || email).trim();
    const targetPass = loginPass || password;

    if (!targetEmail || !targetPass) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const user = await login(targetEmail, targetPass);
      if (user.role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else if (user.role === 'ADMIN') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(customer)/dashboard');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'CUSTOMER' | 'WORKER' | 'ADMIN') => {
    if (role === 'CUSTOMER') {
      setEmail('customer@example.com');
      setPassword('Customer@123');
      handleLogin('customer@example.com', 'Customer@123');
    } else if (role === 'WORKER') {
      setEmail('worker@example.com');
      setPassword('Worker@123');
      handleLogin('worker@example.com', 'Worker@123');
    } else {
      setEmail('admin@example.com');
      setPassword('Admin@123');
      handleLogin('admin@example.com', 'Admin@123');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, 24) + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="home-sharp" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.brandTitle}>HyperLocal</Text>
            <Text style={styles.welcomeText}>Welcome back 👋</Text>
            <Text style={styles.subtitleText}>Sign in to access your account & services</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formContainer}>
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
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />
          </View>

          {/* Quick Demo Login Section */}
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>Demo Quick Sign-In</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: colors.accentLight }]}
                onPress={() => handleQuickLogin('CUSTOMER')}
                activeOpacity={0.7}
              >
                <Text style={[styles.demoChipText, { color: colors.accent }]}>Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: colors.primaryLight }]}
                onPress={() => handleQuickLogin('WORKER')}
                activeOpacity={0.7}
              >
                <Text style={[styles.demoChipText, { color: colors.primaryDark }]}>Worker</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: colors.successLight }]}
                onPress={() => handleQuickLogin('ADMIN')}
                activeOpacity={0.7}
              >
                <Text style={[styles.demoChipText, { color: colors.success }]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  subtitleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  demoSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  demoSectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  demoChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  demoChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
});
