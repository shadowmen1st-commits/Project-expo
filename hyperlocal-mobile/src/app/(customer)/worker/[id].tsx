import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../../components/Header';
import ProfileAvatar from '../../../components/ProfileAvatar';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../config/api';

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorker = async () => {
      try {
        const res = await api.get(`/workers/${id}`);
        if (res.data?.worker) {
          setWorker(res.data.worker);
        } else if (res.data) {
          setWorker(res.data);
        }
      } catch (err: any) {
        // Fallback: try searching if single endpoint differs
        try {
          const searchRes = await api.get('/workers/search');
          const list = Array.isArray(searchRes.data)
            ? searchRes.data
            : searchRes.data.workers || [];
          const found = list.find((w: any) => w._id === id);
          if (found) {
            setWorker(found);
          } else {
            setError('Worker profile not found.');
          }
        } catch {
          setError('Unable to load worker profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchWorker();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Professional Profile" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !worker) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Professional Profile" showBack />
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error || 'Worker not found'}</Text>
          <Button title="Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const name = worker.name || worker.fullName || worker.userId?.name || 'Professional';
  const category = worker.primaryCategoryName || 'General Services';
  const rate = worker.hourlyRate || 250;
  const rating = worker.rating ? worker.rating.toFixed(1) : '4.8';
  const exp = worker.yearsOfExperience || 2;
  const status = worker.verificationStatus || 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Professional Profile" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <ProfileAvatar user={worker} size="2xl" showBadge />
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.categoryText}>{category}</Text>
          <View style={styles.badgeRow}>
            <Badge status={status} size="sm" />
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={20} color="#EAB308" />
              <Text style={styles.statVal}>{rating}</Text>
              <Text style={styles.statLbl}>Rating</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="briefcase" size={20} color="#EA580C" />
              <Text style={styles.statVal}>{exp} Yrs</Text>
              <Text style={styles.statLbl}>Experience</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="cash" size={20} color="#16A34A" />
              <Text style={styles.statVal}>₹{rate}</Text>
              <Text style={styles.statLbl}>Per Hour</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>About Professional</Text>
          <Text style={styles.bioText}>
            {worker.bio ||
              `${name} is a verified, skilled ${category} professional providing reliable service.`}
          </Text>
        </View>

        {/* Service Rate Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pricing Details</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Base Rate</Text>
            <Text style={styles.priceVal}>₹{rate} / hour</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Support & Verification</Text>
            <Text style={styles.priceVal}>Included</Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Booking Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceColumn}>
          <Text style={styles.bottomPriceLabel}>Starting from</Text>
          <Text style={styles.bottomPriceValue}>₹{rate} <Text style={{ fontSize: 12, color: '#64748B' }}>/ hr</Text></Text>
        </View>
        <Button
          title="Book Professional"
          onPress={() => router.push(`/(customer)/booking/${worker._id}`)}
          style={styles.bookBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginTop: 12,
    textAlign: 'center'
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12
  },
  categoryText: {
    fontSize: 14,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 2
  },
  badgeRow: {
    marginTop: 8
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    width: '100%',
    justifyContent: 'space-around'
  },
  statBox: {
    alignItems: 'center'
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
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
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8
  },
  bioText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  priceLabel: {
    fontSize: 14,
    color: '#64748B'
  },
  priceVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  priceColumn: {
    flex: 1
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: '#64748B'
  },
  bottomPriceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A'
  },
  bookBtn: {
    minWidth: 160
  }
});
