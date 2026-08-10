import axios from 'axios';
import Constants from 'expo-constants';
import storage from '../utils/storage';

// Production API URL - hardcoded fallback ensures it works in APK builds
const PRODUCTION_API_URL = 'https://project-expo-md70.onrender.com/api';

const getBaseUrl = () => {
  // 1. Env variable (works in Expo Go / dev mode)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // 2. app.json extra config (works in standalone APK builds)
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraUrl) {
    return extraUrl;
  }
  // 3. Hardcoded production fallback
  return PRODUCTION_API_URL;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000, // 30 seconds - Render free tier needs time to cold-start
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log('Interceptor storage token error:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: better error messages for network issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.response = {
        data: { message: 'Server is starting up, please try again in a moment.' }
      };
    } else if (!error.response) {
      // Network error - no internet or server completely down
      error.response = {
        data: { message: 'Network error. Please check your internet connection.' }
      };
    }
    return Promise.reject(error);
  }
);

export default api;
