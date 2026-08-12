import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Admin Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Platform Configuration</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Server API Base</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{API_BASE_URL}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Admin Privilege Level</Text>
            <Text style={styles.infoValue}>SUPER_ADMIN</Text>
          </View>
        </View>

        <Button
          title="Sign Out Admin Session"
          variant="danger"
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  scrollContent: {
    padding: 16
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B'
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: 200
  }
});
