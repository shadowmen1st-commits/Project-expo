import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const normalized = (status || '').toUpperCase();

  let bg = '#F1F5F9';
  let text = '#475569';
  let label = status;

  if (['APPROVED', 'COMPLETED', 'ACTIVE', 'PAID', 'CONFIRMED', 'VERIFIED'].includes(normalized)) {
    bg = '#DCFCE7';
    text = '#15803D';
  } else if (['PENDING', 'PENDING_APPROVAL', 'IN_PROGRESS', 'REQUESTED'].includes(normalized)) {
    bg = '#FEF3C7';
    text = '#B45309';
  } else if (['REJECTED', 'CANCELLED', 'FAILED', 'SUSPENDED'].includes(normalized)) {
    bg = '#FEE2E2';
    text = '#B91C1C';
  } else if (['ASSIGNED', 'ACCEPTED'].includes(normalized)) {
    bg = '#DBEAFE';
    text = '#1D4ED8';
  }

  const isSm = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSm && styles.badgeSm]}>
      <Text style={[styles.text, { color: text }, isSm && styles.textSm]}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  textSm: {
    fontSize: 10
  }
});

export default Badge;
