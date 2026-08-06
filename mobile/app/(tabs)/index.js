import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import {
  Search,
  MapPin,
  Star,
  CheckCircle2,
  Wrench,
  Zap,
  Sparkles,
  Car,
  Utensils,
  Heart,
  Trees,
  ChevronRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'plumbing', name: 'Plumbing', icon: Wrench, color: '#3B82F6' },
  { id: 'electrical', name: 'Electrical', icon: Zap, color: '#F59E0B' },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles, color: '#10B981' },
  { id: 'driver', name: 'Driver', icon: Car, color: '#6366F1' },
  { id: 'cooking', name: 'Cooking', icon: Utensils, color: '#EC4899' },
  { id: 'senior_care', name: 'Senior Care', icon: Heart, color: '#EF4444' },
  { id: 'gardening', name: 'Gardening', icon: Trees, color: '#059669' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState('Mumbai, Maharashtra');

  useEffect(() => {
    fetchNearbyWorkers();
  }, []);

  const fetchNearbyWorkers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/workers/search');
      if (res.data?.workers && res.data.workers.length > 0) {
        setWorkers(res.data.workers);
      } else {
        // Mock verified workers fallback if backend database is empty in dev
        setWorkers([
          {
            _id: 'w1',
            name: 'Rajesh Kumar',
            skill: 'Master Plumber',
            category: 'Plumbing',
            rating: 4.9,
            reviewCount: 142,
            hourlyRate: 499,
            isVerified: true,
            experienceYears: 6,
          },
          {
            _id: 'w2',
            name: 'Amit Verma',
            skill: 'Certified Electrician',
            category: 'Electrical',
            rating: 4.8,
            reviewCount: 98,
            hourlyRate: 550,
            isVerified: true,
            experienceYears: 5,
          },
          {
            _id: 'w3',
            name: 'Priya Sharma',
            skill: 'Home Cleaning Specialist',
            category: 'Cleaning',
            rating: 4.95,
            reviewCount: 210,
            hourlyRate: 399,
            isVerified: true,
            experienceYears: 4,
          },
          {
            _id: 'w4',
            name: 'Suresh Patil',
            skill: 'Professional Driver',
            category: 'Driver',
            rating: 4.7,
            reviewCount: 84,
            hourlyRate: 450,
            isVerified: true,
            experienceYears: 7,
          },
        ]);
      }
    } catch (err) {
      console.log('Error fetching workers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNearbyWorkers();
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/workers', params: { query: searchQuery } });
    }
  };

  const handleCategoryPress = (categoryName) => {
    router.push({ pathname: '/workers', params: { category: categoryName } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
    >
      {/* 1. Location Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Namaste, {user?.name || 'Customer'}! 👋</Text>
          <TouchableOpacity style={styles.locationRow} activeOpacity={0.7}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.locationText}>{location}</Text>
            <ChevronRight size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'C'}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Search Service Input */}
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search plumbing, electrician, cleaning..."
          placeholderTextColor={Colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleSearchSubmit}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Category Cards */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service Categories</Text>
          <TouchableOpacity onPress={() => router.push('/workers')}>
            <Text style={styles.viewAll}>Explore All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryCard}
                onPress={() => handleCategoryPress(cat.name)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.color + '15' }]}>
                  <IconComp size={24} color={cat.color} />
                </View>
                <Text style={styles.categoryName}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Banner Card */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerContent}>
          <View style={styles.badgePill}>
            <CheckCircle2 size={14} color="#FFFFFF" />
            <Text style={styles.badgePillText}>100% Background Checked</Text>
          </View>
          <Text style={styles.bannerTitle}>Verified Local Experts at Your Doorstep</Text>
          <Text style={styles.bannerSubtitle}>Instant booking with transparent hourly pricing</Text>
        </View>
      </View>

      {/* 4. Nearby Verified Workers List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Verified Workers</Text>
          <TouchableOpacity onPress={() => router.push('/workers')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Finding top rated experts near you...</Text>
          </View>
        ) : (
          workers.map((worker) => (
            <TouchableOpacity
              key={worker._id}
              style={styles.workerCard}
              onPress={() => router.push(`/worker/${worker._id}`)}
              activeOpacity={0.9}
            >
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>
                  {worker.name?.charAt(0) || 'W'}
                </Text>
              </View>

              <View style={styles.workerInfo}>
                <View style={styles.workerNameRow}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  {worker.isVerified !== false && (
                    <View style={styles.verifiedBadge}>
                      <CheckCircle2 size={12} color="#16A34A" />
                      <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.workerSkill}>
                  {worker.skill || worker.category || 'Service Expert'} • {worker.experienceYears || 3}+ yrs exp
                </Text>

                <View style={styles.ratingRow}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {worker.rating || 4.9} ({worker.reviewCount || 45} reviews)
                  </Text>
                </View>
              </View>

              <View style={styles.priceCol}>
                <Text style={styles.priceRate}>₹{worker.hourlyRate || 499}</Text>
                <Text style={styles.priceUnit}>/hr</Text>
                <View style={styles.bookBtnSmall}>
                  <Text style={styles.bookBtnText}>Book</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  searchContainer: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: Colors.surface,
    height: 52,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  searchButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  viewAll: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  categoriesScroll: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  categoryCard: {
    width: 88,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  bannerCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerContent: {
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  workerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
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
  workerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  workerAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  workerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  workerSkill: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  priceCol: {
    alignItems: 'flex-end',
    marginLeft: Spacing.xs,
  },
  priceRate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 11,
    color: Colors.textDim,
    marginBottom: 6,
  },
  bookBtnSmall: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
