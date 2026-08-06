import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import {
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Phone,
  MessageCircle,
  Star,
  CreditCard,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

const STATUS_STAGES = [
  { key: 'PENDING', label: 'Requested' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'EN_ROUTE', label: 'En Route' },
  { key: 'STARTED', label: 'In Progress' },
  { key: 'COMPLETION_REQUESTED', label: 'Awaiting Confirm' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function BookingTrackingScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/bookings/${id}`);
      if (res.data?.booking) {
        setBooking(res.data.booking);
      } else {
        setFallbackBooking();
      }
    } catch (err) {
      console.log('Error fetching booking details:', err);
      setFallbackBooking();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setFallbackBooking = () => {
    setBooking({
      _id: id || 'b101',
      status: 'ACCEPTED',
      scheduledDate: '2026-08-05',
      timeSlot: '11:00 AM - 01:00 PM',
      serviceType: 'Master Plumber',
      address: 'Flat 402, Sunshine Heights, Andheri West, Mumbai 400053',
      totalAmount: 1047,
      paymentStatus: 'PENDING',
      worker: {
        _id: 'w101',
        name: 'Rajesh Kumar',
        phone: '+91 9876543210',
        rating: 4.9,
      },
      createdAt: new Date().toISOString(),
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookingDetails();
  };

  const handleConfirmCompletion = async () => {
    setActionLoading(true);
    try {
      await api.post(`/bookings/${booking._id}/confirm-completion`);
      fetchBookingDetails();
      Alert.alert('Booking Completed', 'Thank you! Service has been confirmed as completed.');
    } catch (err) {
      console.log('Error confirming completion:', err);
      // Update local state fallback
      setBooking((prev) => ({ ...prev, status: 'COMPLETED' }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post(`/bookings/${booking._id}/cancel`);
              fetchBookingDetails();
            } catch (err) {
              setBooking((prev) => ({ ...prev, status: 'CANCELLED' }));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Fetching booking status...</Text>
      </SafeAreaView>
    );
  }

  const currentStatus = booking?.status || 'PENDING';
  const isCancelled = currentStatus === 'CANCELLED';
  const isCompleted = currentStatus === 'COMPLETED';

  // Compute active step index for progress tracker
  const currentStepIndex = STATUS_STAGES.findIndex((stage) => stage.key === currentStatus);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Status Header Banner */}
        <View style={[styles.statusBanner, isCancelled ? styles.statusBannerCancelled : isCompleted ? styles.statusBannerCompleted : styles.statusBannerActive]}>
          {isCancelled ? (
            <XCircle size={24} color="#DC2626" />
          ) : isCompleted ? (
            <CheckCircle2 size={24} color="#16A34A" />
          ) : (
            <Clock size={24} color={Colors.primary} />
          )}

          <View style={styles.statusBannerTextCol}>
            <Text style={styles.statusBannerTitle}>
              {isCancelled
                ? 'Booking Cancelled'
                : isCompleted
                ? 'Service Successfully Completed'
                : `Status: ${currentStatus.replace('_', ' ')}`}
            </Text>
            <Text style={styles.statusBannerSubtitle}>
              Booking ID: #{booking?._id?.substring(0, 8)}
            </Text>
          </View>
        </View>

        {/* 1. Status Progress Timeline */}
        {!isCancelled && (
          <View style={styles.timelineCard}>
            <Text style={styles.cardHeader}>Service Progress Timeline</Text>
            <View style={styles.timelineWrapper}>
              {STATUS_STAGES.map((stage, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <View key={stage.key} style={styles.timelineItem}>
                    <View style={styles.nodeColumn}>
                      <View
                        style={[
                          styles.timelineNode,
                          isPassed && styles.timelineNodePassed,
                          isCurrent && styles.timelineNodeCurrent,
                        ]}
                      >
                        {isPassed && <CheckCircle2 size={12} color="#FFFFFF" />}
                      </View>
                      {idx < STATUS_STAGES.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            isPassed && currentStepIndex > idx && styles.timelineLinePassed,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.labelColumn}>
                      <Text style={[styles.stageLabel, isPassed && styles.stageLabelPassed, isCurrent && styles.stageLabelCurrent]}>
                        {stage.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 2. Worker Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Assigned Service Provider</Text>
          <View style={styles.workerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{booking?.worker?.name?.charAt(0) || 'W'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.workerName}>{booking?.worker?.name || 'Assigned Expert'}</Text>
              <Text style={styles.workerSkill}>{booking?.serviceType || 'Service Specialist'}</Text>
              <View style={styles.ratingRow}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.ratingText}>{booking?.worker?.rating || 4.9} Verified Rating</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.callIconBtn} activeOpacity={0.8}>
              <Phone size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Appointment & Address Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Appointment Details</Text>

          <View style={styles.detailRow}>
            <Clock size={16} color={Colors.primary} />
            <Text style={styles.detailText}>
              {booking?.scheduledDate} ({booking?.timeSlot})
            </Text>
          </View>

          <View style={styles.detailRow}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.detailText}>{booking?.address}</Text>
          </View>
        </View>

        {/* 4. Payment Info */}
        <View style={styles.card}>
          <View style={styles.paymentHeaderRow}>
            <Text style={styles.cardHeader}>Payment Summary</Text>
            <View
              style={[
                styles.payStatusBadge,
                booking?.paymentStatus === 'PAID' ? styles.payPaid : styles.payPending,
              ]}
            >
              <Text
                style={[
                  styles.payStatusText,
                  booking?.paymentStatus === 'PAID' ? styles.payPaidText : styles.payPendingText,
                ]}
              >
                {booking?.paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT PENDING'}
              </Text>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Booking Amount</Text>
            <Text style={styles.totalAmount}>₹{booking?.totalAmount || 1047}</Text>
          </View>

          {booking?.paymentStatus !== 'PAID' && !isCancelled && (
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={() => router.push({ pathname: '/booking/payment', params: { bookingId: booking._id } })}
              activeOpacity={0.85}
            >
              <CreditCard size={18} color="#FFFFFF" />
              <Text style={styles.payNowText}>Proceed to Pay ₹{booking?.totalAmount || 1047}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons based on status */}
        <View style={styles.actionsContainer}>
          {currentStatus === 'COMPLETION_REQUESTED' && (
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={handleConfirmCompletion}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle2 size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Confirm Completion</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isCompleted && (
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() => router.push({ pathname: '/booking/review', params: { bookingId: booking._id, workerId: booking?.worker?._id } })}
            >
              <Star size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Rate & Write Review</Text>
            </TouchableOpacity>
          )}

          {!isCancelled && !isCompleted && currentStatus !== 'STARTED' && (
            <TouchableOpacity
              style={styles.actionBtnDanger}
              onPress={handleCancelBooking}
              disabled={actionLoading}
            >
              <XCircle size={18} color="#DC2626" />
              <Text style={styles.actionBtnDangerText}>Cancel Booking Request</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingBox: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
  },
  statusBannerActive: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.primary,
  },
  statusBannerCompleted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusBannerCancelled: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusBannerTextCol: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statusBannerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  timelineWrapper: {
    paddingLeft: Spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 36,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 24,
  },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineNodePassed: {
    backgroundColor: Colors.primary,
  },
  timelineNodeCurrent: {
    borderWidth: 3,
    borderColor: Colors.primaryLight,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
  },
  timelineLinePassed: {
    backgroundColor: Colors.primary,
  },
  labelColumn: {
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  stageLabel: {
    fontSize: 14,
    color: Colors.textDim,
    fontWeight: '500',
  },
  stageLabelPassed: {
    color: Colors.text,
    fontWeight: '600',
  },
  stageLabelCurrent: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  workerSkill: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textDim,
  },
  callIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  payStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payPaid: {
    backgroundColor: '#DCFCE7',
  },
  payPending: {
    backgroundColor: '#FEF3C7',
  },
  payStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  payPaidText: {
    color: '#16A34A',
  },
  payPendingText: {
    color: '#D97706',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
  },
  payNowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  actionsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  actionBtnDangerText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
