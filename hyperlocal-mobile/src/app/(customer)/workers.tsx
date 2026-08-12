import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import WorkerCard from '../../components/WorkerCard';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

export default function WorkersScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams();

  const [workers, setWorkers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>((categoryParam as string) || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    setError(null);
    try {
      const params: any = {};
      if (selectedCategory) params.categoryId = selectedCategory;
      if (searchQuery.trim()) params.query = searchQuery.trim();

      const [wRes, cRes] = await Promise.allSettled([
        api.get('/workers/search', { params }),
        api.get('/categories')
      ]);

      if (wRes.status === 'fulfilled' && wRes.value.data) {
        const data = Array.isArray(wRes.value.data)
          ? wRes.value.data
          : wRes.value.data.workers || wRes.value.data.data || [];
        setWorkers(data);
      }

      if (cRes.status === 'fulfilled' && cRes.value.data) {
        const cats = Array.isArray(cRes.value.data)
          ? cRes.value.data
          : cRes.value.data.categories || cRes.value.data.data || [];
        setCategories(cats);
      }
    } catch (err: any) {
      console.error('Error fetching workers:', err);
      setError('Unable to load worker listings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWorkers();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Find Professionals" />

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by pro name or service..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={fetchWorkers}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Categories Filter Pills */}
      {categories.length > 0 ? (
        <View style={styles.filterPillsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ _id: '', name: 'All Pros' }, ...categories]}
            keyExtractor={(item) => item._id || 'all'}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item._id;
              return (
                <TouchableOpacity
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setSelectedCategory(item._id)}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      {/* Main Workers List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Searching available pros...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={fetchWorkers} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Professionals Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search criteria or select a different service category.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPressProfile={() => router.push(`/(customer)/worker/${item._id}`)}
              onPressBook={() => router.push(`/(customer)/booking/${item._id}`)}
            />
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0F172A'
  },
  filterPillsContainer: {
    paddingVertical: 8
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pillActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C'
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  pillTextActive: {
    color: '#FFFFFF'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B'
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center'
  },
  listContent: {
    paddingBottom: 24
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
