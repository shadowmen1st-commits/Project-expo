import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';

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
      console.error('Failed fetching categories:', err);
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

  const getCategoryIcon = (name: string) => {
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

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Service Categories" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Service Categories" />
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={fetchCategories} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Service Categories" />

      {categories.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyText}>No services are currently available.</Text>
          <Button title="Refresh" onPress={fetchCategories} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(customer)/workers?category=${item._id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={getCategoryIcon(item.name) as any} size={32} color="#EA580C" />
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <View style={styles.arrowRow}>
                <Text style={styles.exploreLink}>Find Pros</Text>
                <Ionicons name="arrow-forward" size={14} color="#EA580C" />
              </View>
            </TouchableOpacity>
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
    alignItems: 'center',
    paddingHorizontal: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500'
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '600'
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center'
  },
  listContent: {
    padding: 12
  },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto'
  },
  exploreLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
    marginRight: 4
  }
});
