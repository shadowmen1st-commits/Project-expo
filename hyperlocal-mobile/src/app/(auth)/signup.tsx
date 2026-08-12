import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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
        role
      });

      if (user.role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else {
        router.replace('/(customer)/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
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
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.welcomeText}>Create Account 🚀</Text>
            <Text style={styles.subtitleText}>Join HyperLocal to get started</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Role Picker */}
          <Text style={styles.roleLabel}>Account Type</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleOption, role === 'CUSTOMER' && styles.roleOptionActive]}
              onPress={() => setRole('CUSTOMER')}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={role === 'CUSTOMER' ? '#EA580C' : '#64748B'}
              />
              <Text style={[styles.roleText, role === 'CUSTOMER' && styles.roleTextActive]}>
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === 'WORKER' && styles.roleOptionActive]}
              onPress={() => setRole('WORKER')}
            >
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={role === 'WORKER' ? '#EA580C' : '#64748B'}
              />
              <Text style={[styles.roleText, role === 'WORKER' && styles.roleTextActive]}>
                Worker
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Input
              label="Full Name *"
              placeholder="Harsh Singh"
              value={name}
              onChangeText={setName}
              icon={<Ionicons name="person-outline" size={20} color="#64748B" />}
            />

            <Input
              label="Email Address *"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={20} color="#64748B" />}
            />

            <Input
              label="Phone Number"
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Ionicons name="call-outline" size={20} color="#64748B" />}
            />

            <Input
              label="Password *"
              placeholder="Min 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={<Ionicons name="lock-closed-outline" size={20} color="#64748B" />}
            />

            <Button
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
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
    paddingTop: 20,
    paddingBottom: 24
  },
  headerContainer: {
    marginBottom: 24
  },
  backBtn: {
    marginBottom: 12
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A'
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
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 8
  },
  roleOptionActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED'
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B'
  },
  roleTextActive: {
    color: '#EA580C',
    fontWeight: '700'
  },
  formContainer: {
    marginBottom: 24
  },
  submitBtn: {
    marginTop: 16
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
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C'
  }
});
