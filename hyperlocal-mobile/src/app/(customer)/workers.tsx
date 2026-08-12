import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { WorkerCard } from '../../components/WorkerCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius } from '../../theme';

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
        api.get('/categories'),
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
      setError('Unable to load worker listings. Please check connection and try again.');
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
    <View style={styles.container}>
      <MobileHeader title="Find Professionals" showBack={false} />

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pro name or service category..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={fetchWorkers}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <View style={styles.filterPillsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ _id: '', name: 'All Pros' }, ...categories]}
            keyExtractor={(item) => item._id || item.id || 'all'}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const itemId = item._id || item.id || '';
              const isActive = selectedCategory === itemId;
              return (
                <TouchableOpacity
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setSelectedCategory(itemId)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Main Workers List */}
      {loading && !refreshing ? (
        <LoadingState message="Searching available verified pros..." />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Listing Failed"
          description={error}
          actionTitle="Retry Search"
          onAction={fetchWorkers}
        />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No Professionals Found"
              description="Try adjusting your search criteria or select a different category filter."
              actionTitle="Reset Filters"
              onAction={() => {
                setSelectedCategory('');
                setSearchQuery('');
              }}
            />
          }
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPressProfile={() => router.push(`/(customer)/worker/${item._id || item.id}`)}
              onPressBook={() => router.push(`/(customer)/booking/${item._id || item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  filterPillsContainer: {
    paddingVertical: spacing.xs,
  },
  filterList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
});
