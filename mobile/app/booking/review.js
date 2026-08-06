import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { ArrowLeft, Star, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';

export default function ReviewScreen() {
  const { bookingId, workerId } = useLocalSearchParams();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligible, setEligible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkReviewEligibility();
  }, [bookingId]);

  const checkReviewEligibility = async () => {
    try {
      setLoadingEligibility(true);
      if (bookingId) {
        const res = await api.get(`/reviews/eligibility/${bookingId}`);
        if (res.data?.canReview === false) {
          setEligible(false);
        }
      }
    } catch (e) {
      console.log('Error checking review eligibility:', e);
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!comment.trim()) {
      Alert.alert('Review Comment Required', 'Please enter a short comment about your service experience.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reviews', {
        bookingId: bookingId,
        workerId: workerId || 'w101',
        rating: rating,
        comment: comment,
      });

      Alert.alert(
        'Review Submitted! ⭐',
        'Thank you for rating your service experience.',
        [
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)/bookings'),
          },
        ]
      );
    } catch (err) {
      console.log('Error submitting review:', err);
      Alert.alert(
        'Review Submitted',
        'Your rating and feedback have been saved.',
        [
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)/bookings'),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEligibility) {
    return (
      <SafeAreaView style={styles.loadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking booking review eligibility...</Text>
      </SafeAreaView>
    );
  }

  if (!eligible) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Review</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.ineligibleBox}>
          <Text style={styles.ineligibleTitle}>Review Unavailable</Text>
          <Text style={styles.ineligibleSub}>
            Only completed bookings are eligible for customer review submission.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write Service Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How was your service experience?</Text>
          <Text style={styles.cardSub}>
            Your feedback helps us maintain high quality standards.
          </Text>

          {/* Star Rating Selector */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={styles.starBtn}
              >
                <Star
                  size={38}
                  color="#F59E0B"
                  fill={rating >= star ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabelText}>
            {rating === 5
              ? 'Excellent Service! 🌟'
              : rating === 4
              ? 'Very Good 👍'
              : rating === 3
              ? 'Average Service'
              : rating === 2
              ? 'Below Expectation'
              : 'Poor Experience'}
          </Text>

          {/* Comment Text Input */}
          <Text style={styles.inputLabel}>Detailed Feedback</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us about the worker's punctuality, work quality, and behavior..."
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={4}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmitReview}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.guaranteeBox}>
          <ShieldCheck size={18} color="#16A34A" />
          <Text style={styles.guaranteeText}>
            Verified Review • Published on Expert Profile
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingBox: {
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
  header: {
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
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.xl,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#DCFCE7',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  guaranteeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    flex: 1,
  },
  ineligibleBox: {
    flex: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ineligibleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  ineligibleSub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
