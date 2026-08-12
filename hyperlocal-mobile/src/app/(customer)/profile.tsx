import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import ProfileAvatar from '../../components/ProfileAvatar';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../config/api';

export default function CustomerProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Permission to access photo library is required to upload profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedAsset = result.assets[0];
      await uploadProfilePhoto(selectedAsset);
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
        type
      });

      const res = await api.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
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
    setSaving(true);
    try {
      const res = await api.put('/auth/me', { name, phone });
      if (res.data?.user) {
        updateUser(res.data.user);
      }
      Alert.alert('Success', 'Profile details updated.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Profile" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <ProfileAvatar user={user} size="2xl" showBadge />
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userRole}>CUSTOMER ACCOUNT</Text>
        </View>

        {/* Edit Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            icon={<Ionicons name="person-outline" size={20} color="#64748B" />}
          />

          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon={<Ionicons name="call-outline" size={20} color="#64748B" />}
          />

          <Button
            title="Save Changes"
            onPress={handleSaveProfile}
            loading={saving}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Settings & Actions */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/(customer)/settings')}
          >
            <Ionicons name="settings-outline" size={20} color="#0F172A" />
            <Text style={styles.menuText}>App Settings</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/(customer)/bookings')}
          >
            <Ionicons name="calendar-outline" size={20} color="#0F172A" />
            <Text style={styles.menuText}>Booking History</Text>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Button
          title="Log Out"
          variant="danger"
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  avatarWrapper: {
    position: 'relative'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#EA580C',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2
  },
  userRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 12
  },
  logoutBtn: {
    marginTop: 8
  }
});
