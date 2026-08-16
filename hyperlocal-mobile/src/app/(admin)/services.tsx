import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

interface Category {
  _id: string;
  name: string;
  slug?: string;
  status?: string;
  isActive?: boolean;
  description?: string;
  price?: number;
}

export default function AdminServicesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      // Use admin endpoint to get ALL categories (including inactive)
      const res = await api.get('/admin/categories/all');
      const data = Array.isArray(res.data) ? res.data : res.data.categories || res.data.data || [];
      setCategories(data);
    } catch (err: any) {
      // Fall back to public categories endpoint
      try {
        const res2 = await api.get('/categories');
        const data = Array.isArray(res2.data) ? res2.data : res2.data.categories || res2.data.data || [];
        setCategories(data);
      } catch {
        console.error('Error fetching categories:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAdding(true);
    try {
      await api.post('/admin/categories', {
        name: newCatName.trim(),
        description: `${newCatName.trim()} on demand services`,
        icon: 'construct-outline',
        defaultCommission: 10,
        status: 'ACTIVE',
      });
      setNewCatName('');
      Alert.alert('Success', 'Service category created successfully.');
      fetchCategories();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add category.');
    } finally {
      setAdding(false);
    }
  };

  /**
   * Toggle category active/inactive status via the real backend API.
   * Uses PATCH /admin/categories/:id/status with { status: 'ACTIVE' | 'INACTIVE' }
   */
  const handleToggleCategory = async (item: Category) => {
    const currentlyActive = item.isActive !== false && item.status === 'ACTIVE';
    const newStatus = currentlyActive ? 'INACTIVE' : 'ACTIVE';
    const newIsActive = !currentlyActive;

    // Optimistic update
    setCategories((prev) =>
      prev.map((c) =>
        c._id === item._id ? { ...c, isActive: newIsActive, status: newStatus } : c
      )
    );
    setTogglingId(item._id);

    try {
      await api.patch(`/admin/categories/${item._id}/status`, { status: newStatus });
    } catch (err: any) {
      // Revert on failure
      setCategories((prev) =>
        prev.map((c) =>
          c._id === item._id ? { ...c, isActive: currentlyActive, status: currentlyActive ? 'ACTIVE' : 'INACTIVE' } : c
        )
      );
      Alert.alert(
        'Failed',
        err.response?.data?.message || `Could not ${currentlyActive ? 'disable' : 'enable'} category. Please try again.`
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteCategory = (item: Category) => {
    Alert.alert(
      'Delete Category?',
      `Delete "${item.name}"?\n\nThis will archive the category. Categories with active bookings or workers cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/categories/${item._id}`);
              setCategories((prev) => prev.filter((c) => c._id !== item._id));
              Alert.alert('Done', `"${item.name}" has been archived.`);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Manage Service Categories" />

      {/* Quick Add Form */}
      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add New Category</Text>
        <View style={styles.addRow}>
          <View style={{ flex: 1, marginBottom: 0 }}>
            <Input
              placeholder="e.g. Appliance Repair"
              value={newCatName}
              onChangeText={setNewCatName}
            />
          </View>
          <Button
            title="Add"
            size="sm"
            onPress={handleAddCategory}
            loading={adding}
            style={{ marginLeft: 8 }}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="grid-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No categories found. Add one above.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isActive = item.isActive !== false && item.status === 'ACTIVE';
            const isToggling = togglingId === item._id;

            return (
              <View style={[styles.card, !isActive && styles.cardInactive]}>
                <View style={styles.iconCircle}>
                  <Ionicons name="grid-outline" size={20} color={isActive ? '#EA580C' : '#94A3B8'} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.catName, !isActive && styles.catNameInactive]}>{item.name}</Text>
                  <Text style={styles.catSlug}>{item.slug || 'category'}</Text>
                  {item.price !== undefined ? (
                    <Text style={styles.catPrice}>₹{item.price} base price</Text>
                  ) : null}
                </View>

                {/* Status badge */}
                <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, { color: isActive ? '#166534' : '#92400E' }]}>
                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>

                {/* Toggle switch */}
                {isToggling ? (
                  <ActivityIndicator size="small" color="#EA580C" style={{ marginLeft: 8 }} />
                ) : (
                  <Switch
                    value={isActive}
                    onValueChange={() => handleToggleCategory(item)}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isActive ? '#EA580C' : '#94A3B8'}
                    style={{ marginLeft: 8 }}
                  />
                )}

                {/* Delete button */}
                <TouchableOpacity
                  onPress={() => handleDeleteCategory(item)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDF9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 110 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    opacity: 0.85,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  catNameInactive: { color: '#94A3B8' },
  catSlug: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  catPrice: { fontSize: 11, color: '#EA580C', fontWeight: '600', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 9, fontWeight: '800' },
  deleteBtn: {
    marginLeft: 6,
    padding: 4,
  },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
