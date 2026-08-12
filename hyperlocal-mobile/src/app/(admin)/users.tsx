import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import ProfileAvatar from '../../components/ProfileAvatar';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/v1/admin/users');
      const data = Array.isArray(res.data) ? res.data : res.data.users || res.data.data || [];
      setUsers(data);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const filteredUsers = users.filter((u) => {
    if (activeTab === 'ALL') return true;
    return u.role === activeTab;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="User Management" />

      <View style={styles.tabsRow}>
        {['ALL', 'CUSTOMER', 'WORKER', 'ADMIN'].map((tab) => (
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
          data={filteredUsers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <ProfileAvatar user={item} size="md" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
              <Badge status={item.role} size="sm" />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  }
});
