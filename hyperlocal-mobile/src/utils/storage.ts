import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Storage utility using SecureStore on native devices with AsyncStorage fallback.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS !== 'web') {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null) return val;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(key, value);
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(key);
      }
      await AsyncStorage.removeItem(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }
};
