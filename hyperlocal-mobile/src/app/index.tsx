import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, radius } from '../theme';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      routerRef.current.replace('/(customer)/dashboard');
    } else if (user.role === 'COMPANY') {
      routerRef.current.replace('/(company)/dashboard');
    } else if (user.role === 'WORKER') {
      routerRef.current.replace('/(worker)/dashboard');
    } else if (user.role === 'ADMIN') {
      routerRef.current.replace('/(admin)/dashboard');
    } else {
      routerRef.current.replace('/(customer)/dashboard');
    }
  }, [user?.role, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 90, height: 90, borderRadius: 20, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>Shadowman</Text>
        <Text style={styles.tagline}>Services & Field Marketplace</Text>
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
