import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { Search, MapPin, Star } from 'lucide-react-native';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'User'}!</Text>
          <View style={styles.locationRow}>
            <MapPin size={14} color={Colors.primary} />
            <Text style={styles.locationText}>Mumbai, India</Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search size={20} color={Colors.textDim} />
        <Text style={styles.searchPlaceholder}>Search for services...</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {['Cleaning', 'Plumbing', 'Electrician', 'Painting'].map((service) => (
            <TouchableOpacity key={service} style={styles.actionCard}>
              <View style={styles.actionIconPlaceholder} />
              <Text style={styles.actionLabel}>{service}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Workers</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.workerCard}>
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
          </View>
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
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
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
    color: Colors.textMuted,
    fontSize: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  searchBar: {
    margin: Spacing.lg,
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
  searchPlaceholder: {
    color: Colors.textDim,
    fontSize: 16,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.md,
  },
  viewAll: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionCard: {
    width: '22%',
    alignItems: 'center',
  },
  actionIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  workerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  workerImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
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
    color: Colors.textDim,
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 12,
    color: Colors.textDim,
  },
});
