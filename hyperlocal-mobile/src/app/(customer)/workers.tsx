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
    setShortlistedWorkers((prev) => {
      if (prev.some((w) => (w._id || w.id) === (worker._id || worker.id))) return prev;
      return [...prev, worker];
    });
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="Find Professionals" showBack={false} />

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
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Swipe / List Mode Toggle Segment */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'swipe' && styles.segmentBtnActive]}
            onPress={() => setViewMode('swipe')}
            activeOpacity={0.8}
          >
            <Ionicons name="cards-outline" size={18} color={viewMode === 'swipe' ? colors.accent : colors.textMuted} />
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

      {/* Shortlist Alert Counter Banner */}
      {shortlistedWorkers.length > 0 && (
        <View style={styles.shortlistBanner}>
          <View style={styles.shortlistBannerLeft}>
            <Ionicons name="heart" size={16} color={colors.accent} />
            <Text style={styles.shortlistBannerText}>
              {shortlistedWorkers.length} Shortlisted Professional{shortlistedWorkers.length > 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const firstWorker = shortlistedWorkers[shortlistedWorkers.length - 1];
              router.push(`/(customer)/booking/${firstWorker._id || firstWorker.id}`);
            }}
          >
            <Text style={styles.bookNowActionText}>Book Now →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content View: Tinder Swipe Deck vs FlatList */}
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
      ) : workers.length === 0 ? (
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
      ) : viewMode === 'swipe' ? (
        <WorkerSwipeStack
          workers={workers}
          onShortlist={handleShortlistWorker}
          onSelectWorker={(w) => router.push(`/(customer)/worker/${w._id || w.id}`)}
          onResetDeck={fetchWorkers}
        />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
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
    marginLeft: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  segmentBtnActive: {
    backgroundColor: colors.accentLight,
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
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  shortlistBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  shortlistBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortlistBannerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  bookNowActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
});
