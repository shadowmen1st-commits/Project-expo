import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';

interface ServiceCardProps {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  onPress: () => void;
  isSelected?: boolean;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  name,
  icon = 'construct-outline',
  count,
  onPress,
  isSelected = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.selectedCard,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconContainer, isSelected && styles.selectedIconContainer]}>
        <Ionicons
          name={icon}
          size={24}
          color={isSelected ? colors.textInverted : colors.primaryDark}
        />
      </View>
      <Text numberOfLines={1} style={[styles.nameText, isSelected && styles.selectedNameText]}>
        {name}
      </Text>
      {count !== undefined && (
        <Text style={styles.countText}>{count} providers</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 104,
    height: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  selectedCard: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  selectedIconContainer: {
    backgroundColor: colors.primary,
  },
  nameText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  selectedNameText: {
    color: colors.primaryDark,
  },
  countText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
