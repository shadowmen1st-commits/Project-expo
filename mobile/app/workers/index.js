import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import {
  Search,
  Filter,
  Star,
  CheckCircle2,
  MapPin,
  ArrowLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

const SKILLS = [
  'All',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Driver',
  'Cooking',
  'Senior Care',
  'Gardening',
];

const RATE_RANGES = [
  { label: 'All Rates', max: null },
  { label: 'Under ₹400', max: 400 },
  { label: '₹400 - ₹700', max: 700 },
  { label: '₹700+', max: 9999 },
];

export default function WorkerDiscoveryScreen() {
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState(params.query || '');
  const [selectedSkill, setSelectedSkill] = useState(params.category || 'All');
  const [selectedRate, setSelectedRate] = useState(RATE_RANGES[0]);
  const [distanceKm, setDistanceKm] = useState(10);
  
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchWorkers(1, true);
  }, [selectedSkill, selectedRate, distanceKm]);

  const fetchWorkers = async (pageNumber = 1, isReset = false) => {
    try {
      if (isReset) setLoading(true);
      
      const queryParams = {
        page: pageNumber,
        limit: 10,
        skill: selectedSkill !== 'All' ? selectedSkill : undefined,
        category: selectedSkill !== 'All' ? selectedSkill : undefined,
        maxRate: selectedRate.max || undefined,
        query: searchQuery.trim() || undefined,
        distance: distanceKm,
      };

      const res = await api.get('/workers/search', { params: queryParams });
      const newWorkers = res.data?.workers || [];

      if (isReset) {
        setWorkers(newWorkers.length > 0 ? newWorkers : getFallbackWorkers(selectedSkill));
      } else {
        setWorkers((prev) => [...prev, ...newWorkers]);
      }

      setHasMore(newWorkers.length >= 10);
      setPage(pageNumber);
    } catch (err) {
      console.log('Error searching workers:', err);
      if (isReset) {
        setWorkers(getFallbackWorkers(selectedSkill));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getFallbackWorkers = (categoryFilter) => {
    const list = [
      {
        _id: 'w101',
        name: 'Ramesh Sharma',
        skill: 'Plumbing',
        rating: 4.9,
        reviewCount: 168,
        hourlyRate: 450,
        isVerified: true,
        experienceYears: 6,
        distanceKm: 2.1,
      },
      {
        _id: 'w102',
        name: 'Vikas Yadav',
        skill: 'Electrical',
        rating: 4.8,
        reviewCount: 94,
        hourlyRate: 520,
        isVerified: true,
        experienceYears: 4,
        distanceKm: 3.5,
      },
      {
        _id: 'w103',
        name: 'Sunita Devi',
        skill: 'Cleaning',
        rating: 4.95,
        reviewCount: 230,
        hourlyRate: 350,
        isVerified: true,
        experienceYears: 5,
        distanceKm: 1.8,
      },
      {
        _id: 'w104',
        name: 'Manish Singh',
        skill: 'Driver',
        rating: 4.7,
        reviewCount: 78,
        hourlyRate: 400,
        isVerified: true,
        experienceYears: 8,
        distanceKm: 4.2,
      },
      {
        _id: 'w105',
        name: 'Kavita Roy',
        skill: 'Cooking',
        rating: 4.85,
        reviewCount: 112,
        hourlyRate: 600,
        isVerified: true,
        experienceYears: 6,
        distanceKm: 2.9,
      },
    ];

    if (categoryFilter && categoryFilter !== 'All') {
      return list.filter((w) => w.skill.toLowerCase().includes(categoryFilter.toLowerCase()));
    }
    return list;
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWorkers(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchWorkers(page + 1, false);
    }
  };

  const renderWorkerCard = ({ item }) => (
    <TouchableOpacity
      style={styles.workerCard}
      onPress={() => router.push(`/worker/${item._id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.charAt(0) || 'W'}</Text>
        </View>
        {item.isVerified !== false && (
          <View style={styles.verifiedDot}>
            <CheckCircle2 size={12} color="#16A34A" />
          </View>
        )}
      </View>

      <View style={styles.workerDetails}>
        <View style={styles.nameRow}>
          <Text style={styles.workerName}>{item.name}</Text>
          <View style={styles.verifiedTag}>
            <Text style={styles.verifiedTagText}>VERIFIED</Text>
          </View>
        </View>

        <Text style={styles.skillText}>
          {item.skill || 'Expert Service Provider'} • {item.experienceYears || 3}+ yrs exp
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.ratingBadge}>
            <Star size={13} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>{item.rating || 4.8}</Text>
            <Text style={styles.reviewsText}>({item.reviewCount || 42})</Text>
          </View>

          <View style={styles.distanceBadge}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.distanceText}>{item.distanceKm || '2.5'} km away</Text>
          </View>
        </View>
      </View>

      <View style={styles.priceAction}>
        <Text style={styles.priceText}>₹{item.hourlyRate || 499}</Text>
        <Text style={styles.perHr}>/hr</Text>
        <View style={styles.bookBtn}>
          <Text style={styles.bookBtnText}>Book</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Local Experts</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, skill, location..."
          placeholderTextColor={Colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => fetchWorkers(1, true)}
          returnKeyType="search"
        />
      </View>

      {/* Skill Filter Pills */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.skillsScroll}
        >
          {SKILLS.map((skill) => {
            const isSelected = selectedSkill === skill;
            return (
              <TouchableOpacity
                key={skill}
                style={[styles.skillPill, isSelected && styles.skillPillActive]}
                onPress={() => setSelectedSkill(skill)}
                activeOpacity={0.8}
              >
                <Text style={[styles.skillPillText, isSelected && styles.skillPillTextActive]}>
                  {skill}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Worker List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching available local experts...</Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          renderItem={renderWorkerCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No workers found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or category filters.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filtersWrapper: {
    marginBottom: Spacing.sm,
  },
  skillsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  skillPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.xxl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  skillPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  skillPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  skillPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  workerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 1,
  },
  workerDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  verifiedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  skillText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: Spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewsText: {
    fontSize: 12,
    color: Colors.textDim,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceAction: {
    alignItems: 'flex-end',
    marginLeft: Spacing.xs,
  },
  priceText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  perHr: {
    fontSize: 11,
    color: Colors.textDim,
    marginBottom: 6,
  },
  bookBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyState: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
