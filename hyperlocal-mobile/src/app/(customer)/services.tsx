import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import axios from 'axios';
import { colors, spacing, typography, radius, shadows } from '../../theme';

// Safe baseline category dataset in case server has cold-start latency
const DEFAULT_FALLBACK_CATEGORIES = [
  {
    _id: '6a79fa94165ec97eedbe065f',
    name: 'Home Cleaning',
    slug: 'home-cleaning',
    description: 'Deep residential cleaning, dusting, sanitization & floor scrubbing.',
    icon: 'sparkles',
    isActive: true,
  },
  {
    _id: '6a7a91e094884cf983721a8b',
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Pipe repair, leak fixing, fixture installation & emergency service.',
    icon: 'wrench',
    isActive: true,
  },
  {
    _id: '6a7a91e194884cf983721a8e',
    name: 'Electrical',
    slug: 'electrical',
    description: 'Wiring, circuit repairs, fan/appliance installation & safety audits.',
    icon: 'zap',
    isActive: true,
  },
  {
    _id: '6a7a91e194884cf983721a97',
    name: 'Car Cleaning',
    slug: 'car-cleaning',
    description: 'On-site vehicle detailing, foam wash and interior sanitization.',
    icon: 'car',
    isActive: true,
  },
  {
    _id: '6a7a91e194884cf983721a94',
    name: 'Moving & Shifting',
    slug: 'moving',
    description: 'Packing, heavy lifting, loading & local relocation assistance.',
    icon: 'truck',
    isActive: true,
  },
  {
    _id: '6a7a91e194884cf983721a9a',
    name: 'Beauty & Wellness',
    slug: 'beauty-services',
    description: 'At-home salon, hair styling, grooming and relaxation therapies.',
    icon: 'scissors',
    isActive: true,
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Filter mode: 'ready' (only categories with active/ready workers) vs 'all'
  const [activeFilter, setActiveFilter] = useState<'ready' | 'all'>('ready');

  const fetchData = useCallback(async () => {
    setError(null);
    let loadedCategories: any[] = [];
    let loadedWorkers: any[] = [];

    // 1. Fetch Categories with multi-tier URL fallback
    try {
      let catRes = await api.get('/categories').catch(() => null);
      if (!catRes?.data) {
        catRes = await api.get('/api/categories').catch(() => null);
      }
      if (!catRes?.data) {
        catRes = await axios.get('https://project-expo-md7o.onrender.com/api/categories', { timeout: 12000 }).catch(() => null);
      }

      if (catRes?.data) {
        const raw = catRes.data;
        loadedCategories = Array.isArray(raw) ? raw : raw.categories || raw.data || [];
      }
    } catch (catErr) {
      console.warn('[SERVICES] Category fetch warning:', catErr);
    }

    if (!loadedCategories || loadedCategories.length === 0) {
      loadedCategories = DEFAULT_FALLBACK_CATEGORIES;
    }
    setCategories(loadedCategories);

    // 2. Fetch Active / Ready Workers
    try {
      let workerRes = await api.get('/workers/search').catch(() => null);
      if (!workerRes?.data) {
        workerRes = await api.get('/api/workers/search').catch(() => null);
      }
      if (!workerRes?.data) {
        workerRes = await axios.get('https://project-expo-md7o.onrender.com/api/workers/search', { timeout: 12000 }).catch(() => null);
      }

      if (workerRes?.data) {
        const raw = workerRes.data;
        loadedWorkers = Array.isArray(raw) ? raw : raw.workers || raw.data || [];
      }
    } catch (workerErr) {
      console.warn('[SERVICES] Worker fetch warning:', workerErr);
    }
    setWorkers(loadedWorkers);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
    const n = name?.toLowerCase() || '';
    if (n.includes('clean') || n.includes('sparkle')) return 'sparkles';
    if (n.includes('electric') || n.includes('wire') || n.includes('zap')) return 'flash';
    if (n.includes('plumb') || n.includes('water') || n.includes('pipe')) return 'water';
    if (n.includes('paint') || n.includes('color')) return 'color-palette';
    if (n.includes('care') || n.includes('nurse') || n.includes('health')) return 'medical';
    if (n.includes('car') || n.includes('auto') || n.includes('vehicle')) return 'car';
    if (n.includes('driver')) return 'speedometer';
    if (n.includes('moving') || n.includes('truck') || n.includes('shift')) return 'cube';
    if (n.includes('beauty') || n.includes('salon') || n.includes('hair')) return 'cut';
    if (n.includes('carpenter') || n.includes('repair') || n.includes('hammer')) return 'hammer';
    return 'construct';
  };

  // Compute stats for each category (active ready workers count, etc.)
  const categoriesWithStats = useMemo(() => {
    return categories.map((cat) => {
      const catId = String(cat._id || cat.id || '');
      const catName = String(cat.name || '').toLowerCase();
      const catSlug = String(cat.slug || '').toLowerCase();

      // Find workers ready / available in this category
      const readyWorkers = workers.filter((w) => {
        // Check category id list
        const catIds = (w.serviceCategoryIds || []).map((id: any) => String(id));
        if (catIds.includes(catId)) return true;

        // Check primary category
        if (w.primaryServiceCategoryId && String(w.primaryServiceCategoryId) === catId) return true;

        // Check skills matching category
        const skills = (w.skills || []).map((s: any) => String(s).toLowerCase());
        if (skills.some((s: string) => catName.includes(s) || s.includes(catName) || catSlug.includes(s))) {
          return true;
        }

        return false;
      });

      const readyCount = readyWorkers.length;
      const minHourlyRate = readyWorkers.length > 0
        ? Math.min(...readyWorkers.map((w) => Number(w.hourlyRate) || 350))
        : Number(cat.price) || 350;

      return {
        ...cat,
        readyWorkersCount: readyCount,
        hasReadyWorkers: readyCount > 0,
        minHourlyRate,
        sampleWorkerNames: readyWorkers.slice(0, 2).map((w) => w.name || 'Pro').join(', '),
      };
    });
  }, [categories, workers]);

  // Filter based on active filter tab and search query
  const displayedCategories = useMemo(() => {
    return categoriesWithStats.filter((cat) => {
      // 1. Ready workers filter
      if (activeFilter === 'ready' && !cat.hasReadyWorkers) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = String(cat.name || '').toLowerCase().includes(q);
        const matchesDesc = String(cat.description || '').toLowerCase().includes(q);
        const matchesSkills = String(cat.sampleWorkerNames || '').toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesSkills;
      }

      return true;
    });
  }, [categoriesWithStats, activeFilter, searchQuery]);

  const readyCategoriesCount = useMemo(() => {
    return categoriesWithStats.filter((c) => c.hasReadyWorkers).length;
  }, [categoriesWithStats]);

  return (
    <View style={styles.container}>
      <MobileHeader title="Service Categories" showBack={false} />

      {/* Search & Filter Header */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ready services or pros..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'ready' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('ready')}
            activeOpacity={0.7}
          >
            <View style={styles.onlineDot} />
            <Text style={[styles.tabText, activeFilter === 'ready' && styles.tabTextActive]}>
              Ready to Work ({readyCategoriesCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeFilter === 'all' && styles.tabButtonActive]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === 'all' && styles.tabTextActive]}>
              All Services ({categories.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {loading && !refreshing ? (
        <LoadingState message="Finding active categories with ready workers..." />
      ) : displayedCategories.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={activeFilter === 'ready' ? 'No Ready Workers Found' : 'No Categories Found'}
          description={
            activeFilter === 'ready'
              ? 'No workers are currently online for the selected search. View all categories or refresh.'
              : 'Try searching with a different keyword.'
          }
          actionTitle={activeFilter === 'ready' ? 'View All Categories' : 'Refresh'}
          onAction={() => {
            if (activeFilter === 'ready') setActiveFilter('all');
            else {
              setSearchQuery('');
              fetchData();
            }
          }}
        />
      ) : (
        <FlatList
          data={displayedCategories}
          keyExtractor={(item) => String(item._id || item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark, '#EA580C']} />
          }
          renderItem={({ item }) => {
            const hasWorkers = item.hasReadyWorkers;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/(customer)/workers?category=${item._id || item.id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.iconCircle, hasWorkers ? styles.iconCircleActive : null]}>
                    <Ionicons
                      name={getCategoryIcon(item.name)}
                      size={26}
                      color={hasWorkers ? '#EA580C' : colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.cardCenter}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {hasWorkers ? (
                      <View style={styles.liveBadge}>
                        <View style={styles.pulsingDot} />
                        <Text style={styles.liveBadgeText}>
                          {item.readyWorkersCount} Ready Pro{item.readyWorkersCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.offlineBadge}>
                        <Text style={styles.offlineBadgeText}>Available to Book</Text>
                      </View>
                    )}
                  </View>

                  {item.description ? (
                    <Text style={styles.cardSub} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.bottomRow}>
                    <Text style={styles.priceTag}>
                      From ₹{item.minHourlyRate || 350}/hr
                    </Text>
                    <View style={styles.arrowBox}>
                      <Text style={styles.exploreLink}>Book Now</Text>
                      <Ionicons name="arrow-forward" size={14} color="#EA580C" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
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
  filterSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    ...shadows.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    ...shadows.sm,
  },
  cardLeft: {
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  cardCenter: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flexShrink: 1,
    marginRight: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  offlineBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  offlineBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
  },
  cardSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceTag: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  arrowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  exploreLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#EA580C',
  },
});
