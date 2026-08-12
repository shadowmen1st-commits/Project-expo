import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../config/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Notifications Config */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingSub}>Receive real-time booking updates</Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
              thumbColor={pushNotifications ? '#EA580C' : '#F1F5F9'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Email Summaries</Text>
              <Text style={styles.settingSub}>Receive receipts & promotional offers</Text>
            </View>
            <Switch
              value={emailAlerts}
              onValueChange={setEmailAlerts}
              trackColor={{ false: '#CBD5E1', true: '#FED7AA' }}
              thumbColor={emailAlerts ? '#EA580C' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Server & Environment Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Environment & Connection</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>API Endpoint</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{API_BASE_URL}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0 (Expo Go)</Text>
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
