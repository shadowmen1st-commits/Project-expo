import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import ProfileAvatar from '../../components/ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const TABS = ['ALL', 'CUSTOMER', 'WORKER', 'COMPANY', 'ADMIN'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:   { bg: '#DCFCE7', text: '#166534' },
  INACTIVE: { bg: '#FEF9C3', text: '#854D0E' },
  SUSPENDED:{ bg: '#FEE2E2', text: '#991B1B' },
  BLOCKED:  { bg: '#FEE2E2', text: '#991B1B' },
  DELETED:  { bg: '#F1F5F9', text: '#64748B' },
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  CUSTOMER:  { bg: '#EFF6FF', text: '#1D4ED8' },
  WORKER:    { bg: '#FFF7ED', text: '#C2410C' },
  ADMIN:     { bg: '#FAF5FF', text: '#7E22CE' },
  SUPER_ADMIN: { bg: '#FAF5FF', text: '#7E22CE' },
  COMPANY:   { bg: '#F0FDF4', text: '#166534' },
};

export default function AdminUsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async (role?: string) => {
    try {
      const params: Record<string, string> = {};
      if (role && role !== 'ALL') params.role = role;
      const res = await api.get('/admin/users', { params });
      const data = res.data?.users || res.data?.data || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Admin users fetch error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Failed to load users. Please refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(activeTab);
  }, [fetchUsers, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers(activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLoading(true);
    fetchUsers(tab);
  };

  const handleDisable = (item: any) => {
    if (item._id === (currentUser as any)?._id || item._id === (currentUser as any)?.id) {
      Alert.alert('Error', 'You cannot disable your own account.');
      return;
    }
    Alert.alert(
      'Disable User',
      `Disable ${item.name}?\n\nThis will revoke all sessions. The user will be unable to log in until re-enabled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(item._id);
            try {
              await api.post(`/admin/users/${item._id}/disable`);
              setUsers((prev) =>
                prev.map((u) => (u._id === item._id ? { ...u, status: 'INACTIVE' } : u))
              );
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to disable user.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleEnable = async (item: any) => {
    setActionLoading(item._id);
    try {
      await api.post(`/admin/users/${item._id}/enable`);
      setUsers((prev) =>
        prev.map((u) => (u._id === item._id ? { ...u, status: 'ACTIVE' } : u))
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to enable user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (item: any) => {
    if (item._id === (currentUser as any)?._id || item._id === (currentUser as any)?.id) {
      Alert.alert('Error', 'You cannot delete your own account.');
      return;
    }
    if (item.role === 'SUPER_ADMIN') {
      Alert.alert('Error', 'Super administrator accounts cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete User?',
      `"${item.name}" (${item.email})\n\nThis action cannot be undone. All sessions will be revoked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(item._id);
            try {
              await api.delete(`/admin/users/${item._id}`);
              setUsers((prev) => prev.filter((u) => u._id !== item._id));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete user.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const isDisabled = (item: any) => item.status !== 'ACTIVE';
  const isCurrentUser = (item: any) =>
    item._id === (currentUser as any)?._id || item._id === (currentUser as any)?.id;

  const renderUser = ({ item }: { item: any }) => {
    const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.INACTIVE;
    const roleColor = ROLE_COLORS[item.role] || ROLE_COLORS.CUSTOMER;
    const loading = actionLoading === item._id;

    return (
      <View style={styles.card}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <ProfileAvatar user={item} size="md" />
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
              {isCurrentUser(item) && (
                <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>
              )}
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            {item.phone ? <Text style={styles.userPhone}>{item.phone}</Text> : null}
          </View>
          <View style={styles.badgeColumn}>
            <View style={[styles.badge, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.badgeText, { color: roleColor.text }]}>{item.role}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor.bg, marginTop: 4 }]}>
              <Text style={[styles.badgeText, { color: statusColor.text }]}>{item.status}</Text>
            </View>
          </View>
        </View>

        {/* Created date */}
        {item.createdAt ? (
          <Text style={styles.createdDate}>
            Joined: {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}

        {/* Action buttons */}
        {!isCurrentUser(item) && item.role !== 'SUPER_ADMIN' && (
          <View style={styles.actionsRow}>
            {loading ? (
              <ActivityIndicator size="small" color="#EA580C" />
            ) : (
              <>
                {isDisabled(item) ? (
                  <TouchableOpacity style={[styles.actionBtn, styles.enableBtn]} onPress={() => handleEnable(item)}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />
                    <Text style={[styles.actionBtnText, { color: '#166534' }]}>Enable</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.actionBtn, styles.disableBtn]} onPress={() => handleDisable(item)}>
                    <Ionicons name="ban-outline" size={14} color="#D97706" />
                    <Text style={[styles.actionBtnText, { color: '#D97706' }]}>Disable</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="User Management" />

      {/* Role tabs */}
      <View style={styles.tabsScroll}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          renderItem={renderUser}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyText}>No {activeTab === 'ALL' ? '' : activeTab.toLowerCase()} users found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDF9' },
  tabsScroll: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: { backgroundColor: '#EA580C' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#94A3B8' },
  listContent: { padding: 16, paddingBottom: 120 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  userEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  userPhone: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  badgeColumn: { alignItems: 'flex-end' },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  youBadge: { backgroundColor: '#EA580C', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  youBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  createdDate: { fontSize: 11, color: '#94A3B8', marginTop: 8, marginLeft: 2 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  enableBtn: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  disableBtn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  deleteBtn: { borderColor: '#FECACA', backgroundColor: '#FFF1F2' },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
