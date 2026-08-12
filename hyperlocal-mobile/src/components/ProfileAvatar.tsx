import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme';
import { resolveWorkerImage, getUserInitials, getUserName } from '../utils/imageUtils';

interface ProfileAvatarProps {
  user?: any;
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  showBadge?: boolean;
  editable?: boolean;
  onPressEdit?: () => void;
  loading?: boolean;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user,
  src,
  name: nameProp,
  size = 'md',
  showBadge = false,
  editable = false,
  onPressEdit,
  loading = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const imageUrl = resolveWorkerImage(src || user);
  const name = nameProp || getUserName(user);
  const initials = getUserInitials(name);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const sizeDimensions = {
    xs: 24,
    sm: 32,
    md: 44,
    lg: 56,
    xl: 72,
    '2xl': 96,
    '3xl': 110,
  };

  const fontSizes = {
    xs: 10,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 26,
    '2xl': 36,
    '3xl': 40,
  };

  const dim = sizeDimensions[size] || 44;
  const fontSize = fontSizes[size] || 16;

  const isVerified =
    user?.verificationBadge ||
    user?.isVerified ||
    user?.verificationStatus === 'APPROVED';

  return (
    <View style={{ position: 'relative', width: dim, height: dim }}>
      <View style={[styles.container, { width: dim, height: dim, borderRadius: dim / 2 }]}>
        {imageUrl && !imgError ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: dim, height: dim, borderRadius: dim / 2 }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        )}
        {loading && (
          <View style={[styles.loadingOverlay, { borderRadius: dim / 2 }]}>
            <ActivityIndicator size="small" color={colors.primaryDark} />
          </View>
        )}
      </View>

      {showBadge && isVerified && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
      )}

      {editable && (
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={onPressEdit}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="camera" size={16} color={colors.textInverted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  initials: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.textInverted,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.primaryDark,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
});

export default ProfileAvatar;
