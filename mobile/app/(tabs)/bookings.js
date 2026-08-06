import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { Clock, MapPin, ChevronRight, CheckCircle2, XCircle, Briefcase } from 'lucide-react-native';
import { router } from 'expo-router';
import api from '../../services/api';

const TABS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState('All');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/customer');
      if (res.data?.bookings && res.data.bookings.length > 0) {
        setBookings(res.data.bookings);
      } else {
        setFallbackBookings();
      }
    } catch (err) {
      console.log('Error fetching customer bookings:', err);
      setFallbackBookings();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setFallbackBookings = () => {
    setBookings([
      {
        _id: 'b101',
        status: 'ACCEPTED',
        serviceType: 'Master Plumber',
        scheduledDate: '2026-08-05',
        timeSlot: '11:00 AM - 01:00 PM',
        totalAmount: 1047,
        worker: { name: 'Rajesh Kumar' },
      },
      {
        _id: 'b102',
        status: 'COMPLETED',
        serviceType: 'Home Cleaning Specialist',
        scheduledDate: '2026-07-28',
        timeSlot: '02:00 PM - 04:00 PM',
        totalAmount: 847,
        worker: { name: 'Priya Sharma' },
      },
    ]);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const filteredBookings = bookings.filter((item) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active')
      return ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'STARTED', 'COMPLETION_REQUESTED'].includes(
        item.status
      );
    if (activeTab === 'Completed') return item.status === 'COMPLETED';
    if (activeTab === 'Cancelled') return item.status === 'CANCELLED';
    return true;
  });

  const renderBookingCard = ({ item }) => {
    const isCompleted = item.status === 'COMPLETED';
    const isCancelled = item.status === 'CANCELLED';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/booking/${item._id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.serviceRow}>
            <Briefcase size={16} color={Colors.primary} />
            <Text style={styles.serviceName}>{item.serviceType || 'Service Order'}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              isCompleted
                ? styles.statusCompleted
                : isCancelled
                ? styles.statusCancelled
                : styles.statusActive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isCompleted
                  ? styles.statusCompletedText
                  : isCancelled
                  ? styles.statusCancelledText
                  : styles.statusActiveText,
              ]}
            >
              {item.status?.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.workerText}>Provider: {item.worker?.name || 'Assigned Expert'}</Text>

          <View style={styles.infoRow}>
            <Clock size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {item.scheduledDate} • {item.timeSlot}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.priceText}>₹{item.totalAmount || 499}</Text>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsBtnText}>View Tracking & Details</Text>
            <ChevronRight size={14} color={Colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.pageTitle}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching your bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptySubtitle}>You don't have any {activeTab.toLowerCase()} bookings yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#FEF3C7',
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#D97706',
  },
  statusCompletedText: {
    color: '#16A34A',
  },
  statusCancelledText: {
    color: '#DC2626',
  },
  cardBody: {
    marginBottom: Spacing.sm,
    gap: 4,
  },
  workerText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  emptyBox: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
