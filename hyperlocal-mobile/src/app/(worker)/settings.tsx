import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api';

export default function WorkerSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [instantAlerts, setInstantAlerts] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Worker Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Job Preferences</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Instant Job Alerts</Text>
              <Text style={styles.settingSub}>Sound alert when customer books near you</Text>
            </View>
            <Switch
              value={instantAlerts}
              onValueChange={setInstantAlerts}
              trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
              thumbColor={instantAlerts ? '#EA580C' : '#F1F5F9'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Auto-Accept Nearby Jobs</Text>
              <Text style={styles.settingSub}>Automatically accept jobs within 5km</Text>
            </View>
            <Switch
              value={autoAccept}
              onValueChange={setAutoAccept}
              trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
              thumbColor={autoAccept ? '#EA580C' : '#F1F5F9'}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>System Connection</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Server Endpoint</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{API_BASE_URL}</Text>
          </View>
        </View>

        <Button
          title="Sign Out"
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A'
  },
  settingSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
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
