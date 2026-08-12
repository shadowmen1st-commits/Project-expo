import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { resolveWorkerImage, getUserInitials, getUserName } from '../utils/imageUtils';

interface ProfileAvatarProps {
  user?: any;
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showBadge?: boolean;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user,
  src,
  name: nameProp,
  size = 'md',
  showBadge = false
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
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 96
  };

  const fontSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
    xl: 24,
    '2xl': 36
  };

  const dim = sizeDimensions[size] || 40;
  const fontSize = fontSizes[size] || 14;

  const isVerified =
    user?.verificationBadge ||
    user?.isVerified ||
    user?.verificationStatus === 'APPROVED';

  return (
    <View style={{ position: 'relative', width: dim, height: dim }}>
      <View
        style={[
          styles.container,
          { width: dim, height: dim, borderRadius: dim / 2 }
        ]}
      >
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
      </View>
      {showBadge && isVerified && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FED7AA'
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#16A34A',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold'
  }
});

export default ProfileAvatar;
