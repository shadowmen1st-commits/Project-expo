import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MobileHeader } from '../../components/MobileHeader';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function ServicesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/categories');
      const data = Array.isArray(res.data) ? res.data : res.data.categories || res.data.data || [];
      setCategories(data);
    } catch (err: any) {
      setError('Unable to load services. Please check network connection.');
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

  const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
    const n = name?.toLowerCase() || '';
    if (n.includes('clean')) return 'sparkles-outline';
    if (n.includes('electric')) return 'flash-outline';
    if (n.includes('plumb')) return 'water-outline';
    if (n.includes('paint')) return 'color-palette-outline';
    if (n.includes('care') || n.includes('nurse') || n.includes('health')) return 'medical-outline';
    if (n.includes('driver')) return 'car-outline';
    if (n.includes('carpenter') || n.includes('repair')) return 'hammer-outline';
    return 'construct-outline';
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="Service Categories" showBack={false} />

      {loading && !refreshing ? (
        <LoadingState message="Loading available service categories..." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Connection Error"
          description={error}
          actionTitle="Retry"
          onAction={fetchCategories}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="No Categories Available"
          description="Check back later for newly added service categories."
          actionTitle="Refresh"
          onAction={fetchCategories}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item._id || item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primaryDark]} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(customer)/workers?category=${item._id || item.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={getCategoryIcon(item.name)} size={28} color={colors.primaryDark} />
              </View>

              <Text style={styles.cardTitle}>{item.name}</Text>
              
              {item.description ? (
                <Text style={styles.cardSub} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.arrowRow}>
                <Text style={styles.exploreLink}>Find Pros</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.accent} />
              </View>
            </TouchableOpacity>
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  card: {
    flex: 1,
    margin: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    ...shadows.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    gap: 4,
  },
  exploreLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
});
