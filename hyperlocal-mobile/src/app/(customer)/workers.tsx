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
import { WorkerSwipeStack } from '../../components/WorkerSwipeStack';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius } from '../../theme';
import { getCanonicalWorkerId } from '../../utils/workerUtils';

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

  // View Mode: 'swipe' (Tinder Card Mode) vs 'list' (FlatList Mode)
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [shortlistedWorkers, setShortlistedWorkers] = useState<any[]>([]);

  useEffect(() => {
    if (categoryParam !== undefined) {
      setSelectedCategory((categoryParam as string) || '');
    }
  }, [categoryParam]);

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

  const handleShortlistWorker = (worker: any) => {
    const canonicalId = getCanonicalWorkerId(worker);
    setShortlistedWorkers((prev) => {
      if (prev.some((w) => getCanonicalWorkerId(w) === canonicalId)) return prev;
      return [...prev, worker];
    });
  };

  const handleSelectWorker = (worker: any) => {
    const canonicalId = getCanonicalWorkerId(worker);
    if (canonicalId) router.push(`/(customer)/worker/${canonicalId}`);
  };

  const handleBookWorker = (worker: any) => {
    const canonicalId = getCanonicalWorkerId(worker);
    if (canonicalId) router.push(`/(customer)/booking/${canonicalId}`);
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="Find Professionals" showBack />

      {/* Top Controls: Search Bar & View Mode Segment */}
      <View style={styles.topControlRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pro name or skill..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={fetchWorkers}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Swipe / List Mode Toggle Segment */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'swipe' && styles.segmentBtnActive]}
            onPress={() => setViewMode('swipe')}
            activeOpacity={0.8}
          >
            <Ionicons name="layers-outline" size={18} color={viewMode === 'swipe' ? colors.accent : colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'list' && styles.segmentBtnActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Category Filter Pills */}
      <View style={styles.categoryFilterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ _id: '', name: 'All Pros' }, ...categories]}
          keyExtractor={(item) => item._id || 'all'}
          contentContainerStyle={styles.categoryPillsContainer}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item._id;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => {
                  setSelectedCategory(item._id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Content View: Tinder Swipe Deck vs FlatList */}
      {loading ? (
        <LoadingState message="Finding verified specialists..." />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Listing Error"
          description={error}
          actionTitle="Retry Search"
          onAction={fetchWorkers}
        />
      ) : workers.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No Professionals Found"
          description="Try clearing search filters or choosing another category."
          actionTitle="View All"
          onAction={() => {
            setSelectedCategory('');
            setSearchQuery('');
          }}
        />
      ) : viewMode === 'swipe' ? (
        <WorkerSwipeStack
          workers={workers}
          onShortlist={handleShortlistWorker}
          onSelectWorker={handleSelectWorker}
          onBookWorker={handleBookWorker}
        />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item, index) => getCanonicalWorkerId(item) || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPressProfile={() => handleSelectWorker(item)}
              onPressBook={() => handleBookWorker(item)}
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
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
  },
  categoryFilterRow: {
    marginVertical: spacing.sm,
  },
  categoryPillsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryPillActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  categoryPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
});
