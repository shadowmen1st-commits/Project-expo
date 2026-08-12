import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme';
import { resolveWorkerImage, getUserInitials } from '../utils/imageUtils';

interface WorkerAvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  isVerified?: boolean;
}

export const WorkerAvatar: React.FC<WorkerAvatarProps> = ({
  uri,
  name = 'Worker',
  size = 'md',
  isVerified = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const getSizePx = () => {
    switch (size) {
      case 'sm':
        return 40;
      case 'lg':
        return 72;
      case 'xl':
        return 96;
      case 'xxl':
        return 120;
      case 'md':
      default:
        return 56;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return typography.sizes.sm;
      case 'lg':
        return typography.sizes.xl;
      case 'xl':
        return typography.sizes.xxl;
      case 'xxl':
        return typography.sizes.display;
      case 'md':
      default:
        return typography.sizes.lg;
    }
  };

  const sizePx = getSizePx();
  const fontSize = getFontSize();
  const imageUrl = uri ? resolveWorkerImage(uri) : null;

  const getInitials = (n?: string) => {
    if (!n) return 'W';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const showImage = Boolean(imageUrl && !hasError);

  return (
    <View style={[styles.container, { width: sizePx, height: sizePx }]}>
      {showImage ? (
        <View style={[styles.imageWrapper, { width: sizePx, height: sizePx, borderRadius: sizePx / 2 }]}>
          <Image
            source={{ uri: imageUrl! }}
            style={{ width: sizePx, height: sizePx, borderRadius: sizePx / 2 }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
          />
          {loading && (
            <View style={[styles.loadingOverlay, { borderRadius: sizePx / 2 }]}>
              <ActivityIndicator size="small" color={colors.primaryDark} />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.fallback, { width: sizePx, height: sizePx, borderRadius: sizePx / 2 }]}>
          <Text style={[styles.initialsText, { fontSize }]}>{getInitials(name)}</Text>
        </View>
      )}

      {isVerified && (
        <View
          style={[
            styles.badge,
            {
              width: Math.max(16, sizePx * 0.28),
              height: Math.max(16, sizePx * 0.28),
              borderRadius: sizePx * 0.14,
            },
          ]}
        >
          <Ionicons name="checkmark-sharp" size={Math.max(10, sizePx * 0.18)} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
