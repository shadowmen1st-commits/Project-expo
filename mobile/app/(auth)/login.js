import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { Input, Button } from '../../components/UI';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        setError(result.message);
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.formError}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Sign Up</Text>
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
    marginBottom: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  logoBlur: {
    position: 'absolute',
    top: 10,
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    opacity: 0.3,
    transform: [{ scale: 1.1 }],
    zIndex: 1,
  },
  logoText: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 30,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xl,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
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
});
