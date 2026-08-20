import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileHeader } from '../../components/MobileHeader';
import Badge from '../../components/Badge';
import { AppButton } from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

export default function CompanyProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/company/profile').catch(() => api.get('/v1/company/profile'));
        if (res.data) {
          setProfile(res.data.company || res.data.profile || res.data);
        }
      } catch (err: any) {
        console.log('[COMPANY_PROFILE_FETCH_ERROR]', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const verifStatus = profile?.verificationStatus || user?.verificationStatus || 'PENDING';

  return (
    <SafeAreaView style={styles.safeArea}>
      <MobileHeader title="Company Profile" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="business" size={28} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.companyName}>{profile?.companyName || user?.name}</Text>
                  <Text style={styles.companyEmail}>{user?.email}</Text>
                  <View style={{ marginTop: 6 }}>
                    <Badge status={verifStatus} />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Business Details</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Authorized Contact</Text>
                <Text style={styles.infoVal}>{profile?.authorizedPersonName || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoVal}>{profile?.phone || user?.phone || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Business Type</Text>
                <Text style={styles.infoVal}>{profile?.businessType || 'Services'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>GST Number</Text>
                <Text style={styles.infoVal}>{profile?.gstNumber || 'Not provided'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registered City</Text>
                <Text style={styles.infoVal}>{profile?.city ? `${profile.city}, ${profile.state || ''}` : 'India'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoVal}>{profile?.address || 'N/A'}</Text>
              </View>
            </View>

            <View style={{ marginTop: 24 }}>
              <AppButton
                title="Log Out of Corporate Account"
                variant="outline"
                onPress={logout}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  companyEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
