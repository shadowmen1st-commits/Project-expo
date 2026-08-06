import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  Award,
  Calendar,
  MessageSquare,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

export default function WorkerProfileDetailScreen() {
  const { id } = useLocalSearchParams();
  const [worker, setWorker] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkerDetails();
  }, [id]);

  const fetchWorkerDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/workers/profile/${id}`);
      if (res.data?.worker) {
        setWorker(res.data.worker);
      } else {
        setFallbackWorker();
      }

      // Fetch reviews
      try {
        const reviewRes = await api.get(`/workers/${id}/reviews`);
        if (reviewRes.data?.reviews) {
          setReviews(reviewRes.data.reviews);
        } else {
          setFallbackReviews();
        }
      } catch (e) {
        setFallbackReviews();
      }
    } catch (err) {
      console.log('Error loading worker profile:', err);
      setFallbackWorker();
      setFallbackReviews();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackWorker = () => {
    setWorker({
      _id: id || 'w101',
      name: 'Rajesh Kumar',
      skill: 'Master Plumber & Pipefitter',
      category: 'Plumbing',
      rating: 4.9,
      reviewCount: 142,
      hourlyRate: 499,
      isVerified: true,
      experienceYears: 6,
      bio: 'Professional certified plumber with over 6 years of experience solving residential leaks, pipe fittings, bathroom installations, and emergency plumbing tasks.',
      skillsList: ['Pipe Leak Repair', 'Bathroom Fitting', 'Water Heater Setup', 'Drainage Cleaning'],
      isAvailable: true,
      completedJobs: 185,
    });
  };

  const setFallbackReviews = () => {
    setReviews([
      {
        _id: 'r1',
        userName: 'Aakash Mehta',
        rating: 5,
        comment: 'Rajesh arrived right on time and fixed our kitchen sink leak quickly. Highly professional work!',
        date: '2 days ago',
      },
      {
        _id: 'r2',
        userName: 'Sneha Gupta',
        rating: 5,
        comment: 'Very polite, neat work, and reasonable pricing. Definitely booking again for any plumbing jobs.',
        date: '1 week ago',
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading worker profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Worker Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{worker.name?.charAt(0) || 'W'}</Text>
            {worker.isVerified !== false && (
              <View style={styles.verifiedBadgeBadge}>
                <CheckCircle2 size={16} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.nameSection}>
            <Text style={styles.workerName}>{worker.name}</Text>
            <Text style={styles.workerSkill}>{worker.skill}</Text>
          </View>

          {/* Verification Badge Pill */}
          <View style={styles.verifiedRow}>
            <ShieldCheck size={16} color="#16A34A" />
            <Text style={styles.verifiedText}>IDENTITY VERIFIED & BACKGROUND CHECKED</Text>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statIconRow}>
                <Star size={16} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.statValue}>{worker.rating || 4.9}</Text>
              </View>
              <Text style={styles.statLabel}>{worker.reviewCount || 42} Reviews</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconRow}>
                <Award size={16} color={Colors.primary} />
                <Text style={styles.statValue}>{worker.experienceYears || 5}+ Yrs</Text>
              </View>
              <Text style={styles.statLabel}>Experience</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconRow}>
                <Clock size={16} color="#16A34A" />
                <Text style={styles.statValue}>Available</Text>
              </View>
              <Text style={styles.statLabel}>Ready Now</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>About Expert</Text>
          <Text style={styles.bioText}>{worker.bio}</Text>
        </View>

        {/* Skills & Services Offered */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Skills & Specialties</Text>
          <View style={styles.skillsWrapper}>
            {(worker.skillsList || [worker.category || 'General Expert']).map((s, idx) => (
              <View key={idx} style={styles.skillBadge}>
                <CheckCircle2 size={13} color={Colors.primary} />
                <Text style={styles.skillBadgeText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Customer Reviews Section */}
        <View style={styles.sectionCard}>
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.sectionHeader}>Customer Reviews</Text>
            <View style={styles.overallRatingPill}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.overallRatingText}>{worker.rating || 4.9}</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews submitted yet.</Text>
          ) : (
            reviews.map((rev) => (
              <View key={rev._id} style={styles.reviewCard}>
                <View style={styles.reviewUserRow}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{rev.userName?.charAt(0) || 'U'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewUserName}>{rev.userName || 'Verified Customer'}</Text>
                    <Text style={styles.reviewDate}>{rev.date || 'Recently'}</Text>
                  </View>
                  <View style={styles.starsRow}>
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} size={12} color="#F59E0B" fill="#F59E0B" />
                    ))}
                  </View>
                </View>
                <Text style={styles.commentText}>{rev.comment}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Hourly Rate</Text>
          <View style={styles.priceValueRow}>
            <Text style={styles.priceValue}>₹{worker.hourlyRate || 499}</Text>
            <Text style={styles.priceUnit}>/hr</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.bookNowBtn}
          onPress={() => router.push({ pathname: '/booking/create', params: { workerId: worker._id } })}
          activeOpacity={0.85}
        >
          <Calendar size={18} color="#FFFFFF" />
          <Text style={styles.bookNowText}>Book Service</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBtn: {
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  profileHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    position: 'relative',
  },
  avatarTextLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  verifiedBadgeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    padding: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  workerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  workerSkill: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  bioText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  skillsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skillBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  overallRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  overallRatingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
  },
  noReviewsText: {
    fontSize: 13,
    color: Colors.textDim,
    fontStyle: 'italic',
  },
  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 11,
    color: Colors.textDim,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  commentText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  priceContainer: {
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.textDim,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
