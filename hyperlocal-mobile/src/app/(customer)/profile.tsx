import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { MobileHeader } from '../../components/MobileHeader';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { AppButton } from '../../components/AppButton';
import { AppInput } from '../../components/AppInput';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function CustomerProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickPhotoOptions = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option to update your photo:',
      [
        { text: 'Take Photo (Camera)', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handlePickFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Permission to access camera is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadProfilePhoto(result.assets[0]);
    }
  };

  const handlePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Permission to access photo library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadProfilePhoto(result.assets[0]);
    }
  };

  const uploadProfilePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // @ts-ignore: React Native FormData file object
      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type,
      });

      const res = await api.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newPhotoUrl = res.data?.profileImage || res.data?.photoUrl;
      if (newPhotoUrl) {
        updateUser({ profileImage: newPhotoUrl });
        Alert.alert('Success', 'Profile photo updated successfully!');
      }
    } catch (err: any) {
      console.error('Profile photo upload error:', err);
      Alert.alert('Upload Error', err.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/auth/me', { name: name.trim(), phone: phone.trim() });
      if (res.data?.user) {
        updateUser(res.data.user);
      }
      Alert.alert('Success', 'Profile details updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutConfirm = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="My Profile" showBack={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Hero Card */}
        <View style={styles.profileHeroCard}>
          <ProfileAvatar
            user={user}
            size="3xl"
            showBadge
            editable
            onPressEdit={handlePickPhotoOptions}
            loading={uploading}
          />
          <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          
          <View style={styles.roleBadge}>
            <Ionicons name="person-circle-outline" size={14} color={colors.accent} />
            <Text style={styles.roleBadgeText}>CUSTOMER ACCOUNT</Text>
          </View>
        </View>

        {/* Form Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <AppInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            icon="person-outline"
          />

          <AppInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            icon="call-outline"
          />

          <AppButton
            title="Save Changes"
            onPress={handleSaveProfile}
            loading={saving}
            variant="primary"
            style={{ marginTop: spacing.xs }}
          />
        </View>

        {/* Navigation Group Section */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderLabel}>ACCOUNT</Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/(customer)/settings')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </View>
            <Text style={styles.menuText}>App Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/(customer)/bookings')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
            </View>
            <Text style={styles.menuText}>Booking History</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Account Action Section */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderLabel}>ACCOUNT ACTION</Text>
          
          <AppButton
            title="Log Out"
            variant="danger"
            icon="log-out-outline"
            onPress={handleLogoutConfirm}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  profileHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  userName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: spacing.md,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionHeaderLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuText: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
});
