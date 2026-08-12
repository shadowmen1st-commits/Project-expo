import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import ProfileAvatar from '../../components/ProfileAvatar';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Badge from '../../components/Badge';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../config/api';

export default function WorkerProfileScreen() {
  const { user, updateUser, logout } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experience, setExperience] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/v1/worker/verification');
        const p = res.data?.profile || res.data;
        if (p) {
          setProfile(p);
          setBio(p.bio || '');
          setHourlyRate(String(p.hourlyRate || 250));
          setExperience(String(p.yearsOfExperience || 2));
        }
      } catch (err) {
        console.error('Failed fetching worker profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Permission to access media library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadWorkerPhoto(result.assets[0]);
    }
  };

  const uploadWorkerPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
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

      const res = await api.post('/v1/worker/verification/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newPhotoUrl = res.data?.photoUrl || res.data?.profileImage;
      if (newPhotoUrl) {
        updateUser({ profileImage: newPhotoUrl });
        if (profile) setProfile({ ...profile, profilePhotoId: newPhotoUrl });
        Alert.alert('Success', 'Worker profile photo updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.response?.data?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await api.put('/v1/worker/verification/professional-details', {
        bio,
        hourlyRate: Number(hourlyRate),
        yearsOfExperience: Number(experience)
      });
      Alert.alert('Success', 'Professional details updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Worker Profile" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      </SafeAreaView>
    );
  }

  const verificationStatus = profile?.verificationStatus || 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Worker Profile" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <ProfileAvatar user={user} size="2xl" showBadge />
            <TouchableOpacity style={styles.cameraBadge} onPress={handlePickPhoto} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'Worker Pro'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={{ marginTop: 8 }}>
            <Badge status={verificationStatus} />
          </View>
        </View>

        {/* Edit Professional Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Professional Details</Text>

          <Input
            label="Hourly Rate (₹/hr) *"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="numeric"
            icon={<Ionicons name="cash-outline" size={20} color="#64748B" />}
          />

          <Input
            label="Years of Experience *"
            value={experience}
            onChangeText={setExperience}
            keyboardType="numeric"
            icon={<Ionicons name="briefcase-outline" size={20} color="#64748B" />}
          />

          <Input
            label="Professional Bio"
            placeholder="Describe your skills and experience..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top' }}
          />

          <Button
            title="Save Professional Details"
            onPress={handleSaveDetails}
            loading={saving}
            style={{ marginTop: 12 }}
          />
        </View>

        <Button
          title="Sign Out"
          variant="danger"
          onPress={async () => {
            await logout();
          }}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
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
  }
});
