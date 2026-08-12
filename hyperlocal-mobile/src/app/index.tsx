import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else if (user.role === 'WORKER') {
        router.replace('/(worker)/dashboard');
      } else if (user.role === 'ADMIN') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(customer)/dashboard');
      }
    }
  }, [user, loading, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Ionicons name="home-sharp" size={32} color={colors.primaryDark} />
        </View>
        <Text style={styles.logoText}>HyperLocal</Text>
        <Text style={styles.tagline}>Services & Caregiver Marketplace</Text>
        <ActivityIndicator size="large" color={colors.primaryDark} style={styles.spinner} />
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
  },
  content: {
    alignItems: 'center',
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: 32,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: typography.weights.medium,
  },
  spinner: {
    marginTop: spacing.xxl,
  },
});
