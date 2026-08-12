import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>HyperLocal</Text>
          <Text style={styles.tagline}>Services & Caregiver Marketplace</Text>
        </View>
        <ActivityIndicator size="large" color="#EA580C" style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    alignItems: 'center'
  },
  logoContainer: {
    alignItems: 'center'
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: -0.5
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500'
  },
  spinner: {
    marginTop: 32
  }
});
