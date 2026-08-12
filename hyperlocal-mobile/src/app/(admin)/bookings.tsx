import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function AdminBookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/v1/admin/analytics/overview'); // Or platform bookings endpoint
      const list = res.data?.recentBookings || res.data?.bookings || [];
      setBookings(list);
    } catch (err) {
      console.error('Error fetching admin bookings:', err);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="All Platform Bookings" />
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Platform Bookings</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.categoryTitle}>{item.serviceCategoryName || 'Service Booking'}</Text>
                <Badge status={item.status} />
              </View>

              <Text style={styles.detailText}>
                Customer: {item.customerId?.name || item.customerName || 'Customer'}
              </Text>
              <Text style={styles.detailText}>
                Worker: {item.workerId?.name || item.workerName || 'Worker'}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>₹{item.totalAmount || 500}</Text>
                <Text style={styles.dateText}>
                  {new Date(item.bookingDate || Date.now()).toLocaleDateString()}
                </Text>
              </View>
            </View>
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
    borderColor: '#E2E8F0'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  dateText: {
    fontSize: 12,
    color: '#64748B'
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
  }
});
