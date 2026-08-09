import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { Input, Button } from '../../components/UI';
import { router } from 'expo-router';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await register({ name, email, phone, password, role });
      if (result.success) {
         router.replace('/(tabs)');
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>H</Text>
              </View>
              <View style={styles.logoBlur} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community of experts</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.formError}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              autoCapitalize="words"
            />

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="1234567890"
              keyboardType="phone-pad"
            />

            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Register As</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'CUSTOMER' && styles.roleOptionActive]}
                  onPress={() => setRole('CUSTOMER')}
                >
                  <Text style={[styles.roleOptionText, role === 'CUSTOMER' && styles.roleOptionTextActive]}>
                    Customer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'WORKER' && styles.roleOptionActive]}
                  onPress={() => setRole('WORKER')}
                >
                  <Text style={[styles.roleOptionText, role === 'WORKER' && styles.roleOptionTextActive]}>
                    Provider
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'COMPANY' && styles.roleOptionActive]}
                  onPress={() => setRole('COMPANY')}
                >
                  <Text style={[styles.roleOptionText, role === 'COMPANY' && styles.roleOptionTextActive]}>
                    Company
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <Button
              title="Sign Up"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoBlur: {
    position: 'absolute',
    top: 6,
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    opacity: 0.2,
    transform: [{ scale: 1.1 }],
    zIndex: 1,
  },
  logoText: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  formError: {
    color: Colors.error,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  registerButton: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  footerLink: {
    color: Colors.secondary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  roleContainer: {
    marginBottom: Spacing.md,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.surfaceLight,
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  roleOptionTextActive: {
    color: Colors.secondary,
  },
});
