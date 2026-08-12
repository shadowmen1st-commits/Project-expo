import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ProfileAvatar } from './ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';

interface WorkerCardProps {
  worker: {
    _id: string;
    userId?: any;
    name?: string;
    fullName?: string;
    hourlyRate?: number;
    rating?: number;
    reviewCount?: number;
    yearsOfExperience?: number;
    primaryCategoryName?: string;
    bio?: string;
    profilePhotoId?: string;
    isVerified?: boolean;
    verificationStatus?: string;
  };
  onPressProfile: () => void;
  onPressBook: () => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onPressProfile, onPressBook }) => {
  const name = worker.name || worker.fullName || worker.userId?.name || 'Service Professional';
  const category = worker.primaryCategoryName || 'General Services';
  const rate = worker.hourlyRate || 250;
  const rating = worker.rating ? worker.rating.toFixed(1) : '4.8';
  const reviews = worker.reviewCount || 12;
  const exp = worker.yearsOfExperience || 2;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <ProfileAvatar user={worker} size="lg" showBadge={true} />
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
          </View>
          <Text style={styles.categoryText}>{category}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={14} color="#EAB308" />
              <Text style={styles.statText}>{rating} ({reviews})</Text>
            </View>
            <Text style={styles.statDivider}>•</Text>
            <View style={styles.statItem}>
              <Ionicons name="briefcase-outline" size={14} color="#64748B" />
              <Text style={styles.statText}>{exp} yrs exp</Text>
            </View>
          </View>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceAmount}>₹{rate}</Text>
          <Text style={styles.priceUnit}>/ hr</Text>
        </View>
      </View>

      {worker.bio ? (
        <Text style={styles.bioText} numberOfLines={2}>{worker.bio}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.profileBtn} onPress={onPressProfile} activeOpacity={0.7}>
          <Text style={styles.profileBtnText}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bookBtn} onPress={onPressBook} activeOpacity={0.7}>
          <Text style={styles.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  categoryText: {
    fontSize: 13,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statText: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 4,
    fontWeight: '500'
  },
  statDivider: {
    marginHorizontal: 6,
    color: '#94A3B8',
    fontSize: 12
  },
  priceCol: {
    alignItems: 'flex-end'
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  priceUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500'
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 12,
    lineHeight: 18
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10
  },
  profileBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  bookBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EA580C',
    alignItems: 'center'
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});

export default WorkerCard;
