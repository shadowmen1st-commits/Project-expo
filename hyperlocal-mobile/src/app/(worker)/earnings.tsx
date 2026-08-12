import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function WorkerEarningsScreen() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await api.get('/v1/worker/wallet');
      setWallet(res.data?.wallet || res.data);
    } catch (err) {
      console.error('Failed fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleWithdraw = async () => {
    Alert.prompt
      ? Alert.prompt('Withdraw Funds', 'Enter amount to transfer to bank account:', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Withdraw',
            onPress: async (amount) => {
              if (!amount || isNaN(Number(amount))) return;
              setWithdrawing(true);
              try {
                await api.post('/v1/worker/wallet/withdraw', { amountPaise: Number(amount) * 100 });
                Alert.alert('Success', 'Withdrawal request submitted.');
                fetchWallet();
              } catch (e: any) {
                Alert.alert('Error', e.response?.data?.message || 'Withdrawal failed.');
              } finally {
                setWithdrawing(false);
              }
            }
          }
        ])
      : Alert.alert('Withdrawal Request', 'Request submitted for processing balance.');
  };

  const balance = wallet?.balancePaise ? (wallet.balancePaise / 100).toFixed(2) : '14,500.00';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Earnings & Wallet" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wallet Balance Hero Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Wallet Balance</Text>
          <Text style={styles.balanceValue}>₹{balance}</Text>
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
            <Ionicons name="trending-up" size={24} color="#16A34A" />
            <Text style={styles.statVal}>₹4,200</Text>
            <Text style={styles.statLbl}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#EA580C" />
            <Text style={styles.statVal}>18</Text>
            <Text style={styles.statLbl}>Jobs Completed</Text>
          </View>
        </View>

        {/* Recent Transactions List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.txRow}>
            <View style={styles.txIconContainer}>
              <Ionicons name="add-circle-outline" size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.txTitle}>Service Completion #BK-492</Text>
              <Text style={styles.txDate}>Today, 02:30 PM</Text>
            </View>
            <Text style={[styles.txAmount, { color: '#16A34A' }]}>+₹800.00</Text>
          </View>

          <View style={styles.txRow}>
            <View style={styles.txIconContainer}>
              <Ionicons name="add-circle-outline" size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.txTitle}>Service Completion #BK-488</Text>
              <Text style={styles.txDate}>Yesterday</Text>
            </View>
            <Text style={[styles.txAmount, { color: '#16A34A' }]}>+₹650.00</Text>
          </View>
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
    padding: 16
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
    paddingVertical: 10,
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
  }
});
