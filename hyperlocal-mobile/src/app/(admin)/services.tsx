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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function AdminServicesScreen() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      const data = Array.isArray(res.data) ? res.data : res.data.categories || res.data.data || [];
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
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
      await api.post('/categories', { name: newCatName.trim() });
      setNewCatName('');
      Alert.alert('Success', 'Category added.');
      fetchCategories();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add category.');
    } finally {
      setAdding(false);
    }
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="grid-outline" size={20} color="#EA580C" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.catName}>{item.name}</Text>
                <Text style={styles.catSlug}>{item.slug || 'active-category'}</Text>
              </View>
              <Switch value={item.isActive !== false} onValueChange={() => {}} />
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
  addCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  addTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
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
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center'
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  catSlug: {
    fontSize: 12,
    color: '#64748B'
  }
});
