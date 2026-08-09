import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { Search, MapPin, Star, Filter } from 'lucide-react-native';

export default function HomeScreen() {
  const { user } = useAuth();

  const categories = [
    { name: 'Cleaning', icon: '🏠' },
    { name: 'Plumbing', icon: '🚰' },
    { name: 'Electrician', icon: '⚡' },
    { name: 'Painting', icon: '🎨' },
    { name: 'Gardening', icon: '🌿' },
    { name: 'Mechanic', icon: '🔧' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name || 'User'} 👋</Text>
          <View style={styles.locationRow}>
            <MapPin size={14} color={Colors.secondary} />
            <Text style={styles.locationText}>Mumbai, India</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={20} color={Colors.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for services..."
            placeholderTextColor={Colors.textDim}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.promoCard}>
        <View style={styles.promoContent}>
          <Text style={styles.promoTitle}>20% OFF</Text>
          <Text style={styles.promoSubtitle}>On your first cleaning service</Text>
          <TouchableOpacity style={styles.promoButton}>
            <Text style={styles.promoButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.promoCircle} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.name} style={styles.categoryCard}>
              <View style={styles.categoryIconContainer}>
                <Text style={{fontSize: 24}}>{cat.icon}</Text>
              </View>
              <Text style={styles.categoryLabel}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Rated Experts</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {[1, 2, 3].map((i) => (
          <TouchableOpacity key={i} style={styles.workerCard}>
            <View style={styles.workerImage} />
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>Rahul Sharma</Text>
              <Text style={styles.workerSkill}>Expert Plumber • 5+ years</Text>
              <View style={styles.ratingRow}>
                <Star size={14} color="#fbbf24" fill="#fbbf24" />
                <Text style={styles.ratingText}>4.9 (124 reviews)</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹499</Text>
              <Text style={styles.priceUnit}>/hr</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    fontSize: 24,
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
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.surface,
    height: 52,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  filterButton: {
    width: 52,
    height: 52,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  promoContent: {
    zIndex: 2,
  },
  promoTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
  },
  promoSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  promoButton: {
    backgroundColor: Colors.text,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  promoCircle: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.secondary,
    opacity: 0.2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  viewAll: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryList: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  workerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  workerImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
  },
  workerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  workerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  workerSkill: {
    fontSize: 13,
    color: Colors.textSecondary,
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
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  priceUnit: {
    fontSize: 12,
    color: Colors.textDim,
  },
});
