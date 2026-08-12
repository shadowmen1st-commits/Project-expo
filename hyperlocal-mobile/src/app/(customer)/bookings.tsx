import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function CustomerBookingsScreen() {
  const router = useRouter();

  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/bookings/customer/my-bookings');
      const data = Array.isArray(res.data) ? res.data : res.data.bookings || res.data.data || [];
      setBookings(data);
    } catch (err) {
      console.error('Error fetching customer bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') return ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CONFIRMED'].includes(b.status);
    if (activeTab === 'COMPLETED') return b.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(b.status);
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Bookings" />

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Bookings Found</Text>
              <Text style={styles.emptySub}>You haven't made any bookings in this filter tab yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(customer)/booking/details/${item._id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.categoryTitle}>
                  {item.serviceCategoryName || 'Service Booking'}
                </Text>
                <Badge status={item.status} />
              </View>

              <View style={styles.detailsRow}>
                <Ionicons name="person-outline" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  {item.workerId?.name || item.workerName || 'Assigned Worker'}
                </Text>
              </View>

              <View style={styles.detailsRow}>
                <Ionicons name="time-outline" size={16} color="#64748B" />
                <Text style={styles.detailText}>
                  {new Date(item.bookingDate || Date.now()).toLocaleDateString()} at {item.startTime || '10:00 AM'} ({item.durationHours || 2} hrs)
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>₹{item.totalAmount || item.estimatedPrice || 500}</Text>
                <Text style={styles.viewDetailsLink}>View Details →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9'
  },
  tabBtnActive: {
    backgroundColor: '#EA580C'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContent: {
    padding: 16
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  viewDetailsLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6
  }
});
