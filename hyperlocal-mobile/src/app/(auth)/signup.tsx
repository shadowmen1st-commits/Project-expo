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
import { MobileHeader } from '../../components/MobileHeader';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'WORKER' | 'COMPANY'>('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { registerUser } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const user = await registerUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role,
      });

      if (user.role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else {
        router.replace('/(customer)/dashboard');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="Create Account" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeText}>Join HyperLocal 🚀</Text>
            <Text style={styles.subtitleText}>Create your account to start booking services</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Account Role Selector */}
          <Text style={styles.roleLabel}>Select Account Type</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleOption, role === 'CUSTOMER' && styles.roleOptionActive]}
              onPress={() => setRole('CUSTOMER')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={role === 'CUSTOMER' ? colors.primaryDark : colors.textMuted}
              />
              <Text style={[styles.roleText, role === 'CUSTOMER' && styles.roleTextActive]}>
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === 'WORKER' && styles.roleOptionActive]}
              onPress={() => setRole('WORKER')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={role === 'WORKER' ? colors.primaryDark : colors.textMuted}
              />
              <Text style={[styles.roleText, role === 'WORKER' && styles.roleTextActive]}>
                Worker Pro
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <AppInput
              label="Full Name *"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              icon="person-outline"
            />

            <AppInput
              label="Email Address *"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <AppInput
              label="Phone Number"
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="call-outline"
            />

            <AppInput
              label="Password *"
              placeholder="Min 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />

            <AppButton
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
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
  },
  headerContainer: {
    marginVertical: spacing.lg,
  },
  welcomeText: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
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
  roleLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  roleTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  submitBtn: {
    marginTop: spacing.md,
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
  loginLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
});
