import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function WorkerEarningsScreen() {
  const [wallet, setWallet] = useState<any>(null);
  const [completedBookings, setCompletedBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWalletData = useCallback(async () => {
    try {
      const [walletRes, bookingRes] = await Promise.allSettled([
        api.get('/wallet/details').catch(() => api.get('/v1/wallet/details')),
        api.get('/bookings/worker?status=COMPLETED').catch(() => null)
      ]);

      if (walletRes.status === 'fulfilled' && walletRes.value?.data) {
        setWallet(walletRes.value.data);
      }

      if (bookingRes.status === 'fulfilled' && bookingRes.value?.data) {
        const raw = bookingRes.value.data;
        const list = Array.isArray(raw) ? raw : raw.bookings || raw.jobs || raw.data || [];
        setCompletedBookings(list);
      }
    } catch (err) {
      console.error('Failed fetching wallet details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [fetchWalletData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  const handleWithdraw = async () => {
    const availablePaise = wallet?.balances?.available || 0;
    const availableRupees = (availablePaise / 100).toFixed(2);

    if (availablePaise <= 0) {
      Alert.alert('Insufficient Balance', 'You currently do not have any available balance to withdraw. Complete bookings to earn balance.');
      return;
    }

    Alert.alert(
      'Request Payout',
      `Available balance: ₹${availableRupees}\n\nConfirm payout withdrawal request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request All',
          onPress: async () => {
            setWithdrawing(true);
            try {
              await api.post('/wallet/withdraw', { amount: availablePaise });
              Alert.alert('Payout Requested', 'Your payout request has been submitted for administrative processing.');
              fetchWalletData();
            } catch (e: any) {
              const msg = e.response?.data?.message || 'Payout request failed.';
              Alert.alert('Error', msg);
            } finally {
              setWithdrawing(false);
            }
          }
        }
      ]
    );
  };

  const availableBal = wallet?.balances?.available != null
    ? (wallet.balances.available / 100).toFixed(2)
    : '0.00';

  const totalEarned = wallet?.balances?.totalEarned != null
    ? (wallet.balances.totalEarned / 100).toFixed(2)
    : completedBookings.reduce((sum, b) => sum + (b.workerEarning || b.totalAmount || 0), 0).toFixed(2);

  const pendingBal = wallet?.balances?.pending != null
    ? (wallet.balances.pending / 100).toFixed(2)
    : '0.00';

  const historyList = wallet?.history || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Earnings & Wallet" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
      >
        {/* Wallet Balance Hero Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available for Payout</Text>
          <Text style={styles.balanceValue}>₹{availableBal}</Text>
          <Button
            title="Request Payout"
            onPress={handleWithdraw}
            loading={withdrawing}
            style={styles.withdrawBtn}
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color="#16A34A" />
            <Text style={styles.statVal}>₹{totalEarned}</Text>
            <Text style={styles.statLbl}>Total Lifetime</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#EA580C" />
            <Text style={styles.statVal}>{completedBookings.length}</Text>
            <Text style={styles.statLbl}>Jobs Completed</Text>
          </View>
        </View>

        {/* Recent Transactions List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {loading && !refreshing ? (
            <ActivityIndicator size="small" color="#EA580C" style={{ marginVertical: 20 }} />
          ) : historyList.length > 0 ? (
            historyList.map((tx: any, idx: number) => {
              const isCredit = tx.direction === 'CREDIT' || !tx.direction;
              const amountRupees = ((tx.amount || 0) / 100).toFixed(2);
              const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'Recent';

              return (
                <View key={tx.id || idx} style={styles.txRow}>
                  <View style={[styles.txIconContainer, { backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Ionicons
                      name={isCredit ? 'arrow-down' : 'arrow-up'}
                      size={18}
                      color={isCredit ? '#16A34A' : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.txTitle}>{tx.description || tx.reference || 'Booking Earning'}</Text>
                    <Text style={styles.txDate}>{dateStr}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: isCredit ? '#16A34A' : '#EF4444' }]}>
                    {isCredit ? '+' : '-'}₹{amountRupees}
                  </Text>
                </View>
              );
            })
          ) : completedBookings.length > 0 ? (
            completedBookings.map((b: any) => {
              const earningVal = b.workerEarning || b.totalAmount || 0;
              const dateStr = b.completedAt
                ? new Date(b.completedAt).toLocaleDateString()
                : (b.bookingDate || 'Completed');

              return (
                <View key={b.id || b._id} style={styles.txRow}>
                  <View style={styles.txIconContainer}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.txTitle}>Booking #{b.bookingNumber || String(b.id || b._id).substring(0, 8)}</Text>
                    <Text style={styles.txDate}>{dateStr} • {b.category?.name || 'Service'}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: '#16A34A' }]}>
                    +₹{earningVal.toFixed(2)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyHistory}>
              <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
              <Text style={styles.emptyHistoryText}>No transactions yet.</Text>
              <Text style={styles.emptyHistorySub}>Earnings from completed jobs will appear in your ledger history.</Text>
            </View>
          )}
        </View>
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
    padding: 16,
    paddingBottom: 110
  },
  balanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8
  },
  withdrawBtn: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#EA580C'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6
  },
  statLbl: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A'
  },
  txDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700'
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8
  },
  emptyHistorySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20
  }
});
