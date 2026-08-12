import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (loginEmail?: string, loginPass?: string) => {
    const targetEmail = (loginEmail || email).trim();
    const targetPass = loginPass || password;

    if (!targetEmail || !targetPass) {
      setErrorMessage('Please enter email and password.');
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
      const msg = err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.brandTitle}>HyperLocal</Text>
            <Text style={styles.welcomeText}>Welcome back 👋</Text>
            <Text style={styles.subtitleText}>Sign in to access your account</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formContainer}>
            <Input
              label="Email Address"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={20} color="#64748B" />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={20} color="#64748B" />}
            />

            <Button
              title="Sign In"
              onPress={() => handleLogin()}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>

          {/* Quick Demo Login Buttons */}
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>Demo Quick Sign-In</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: '#EFF6FF' }]}
                onPress={() => handleQuickLogin('CUSTOMER')}
              >
                <Text style={[styles.demoChipText, { color: '#2563EB' }]}>Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: '#FFF7ED' }]}
                onPress={() => handleQuickLogin('WORKER')}
              >
                <Text style={[styles.demoChipText, { color: '#EA580C' }]}>Worker</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoChip, { backgroundColor: '#F0FDF4' }]}
                onPress={() => handleQuickLogin('ADMIN')}
              >
                <Text style={[styles.demoChipText, { color: '#16A34A' }]}>Admin</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center'
  },
  headerContainer: {
    marginBottom: 24
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: -0.5
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  },
  formContainer: {
    marginBottom: 24
  },
  submitBtn: {
    marginTop: 16
  },
  demoSection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24
  },
  demoSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'center'
  },
  demoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  demoChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  demoChipText: {
    fontSize: 13,
    fontWeight: '700'
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 14,
    color: '#64748B'
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C'
  }
});
