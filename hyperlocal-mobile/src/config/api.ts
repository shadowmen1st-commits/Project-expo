import axios from 'axios';
import { storage } from '../utils/storage';

const normalizeApiUrl = (url?: string) => {
  if (!url) return 'https://project-expo-md7o.onrender.com/api';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.includes('/api')) {
    cleaned += '/api';
  }
  return cleaned;
};

export const API_BASE_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const isPublicRoute = ['/auth/login', '/auth/register', '/auth/refresh', '/categories', '/services', '/workers/search', '/workers/profile'].some(
      (path) => config.url?.includes(path)
    );

    const token = await storage.getItem('accessToken');
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      config.headers.Authorization = `Bearer ${token.trim()}`;
      if (__DEV__ && !isPublicRoute) {
        console.log(`AUTH: Request to ${config.url} authorized: YES`);
      }
    } else {
      delete config.headers.Authorization;
      // Only log "authorized: NO" for protected routes — not for login/register which never need a token
      if (__DEV__ && !isPublicRoute) {
        console.log(`AUTH: Request to ${config.url} authorized: NO (No access token)`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) return Promise.reject(error);

    const isAuthRoute = ['/auth/login', '/auth/register', '/auth/refresh'].some((path) =>
      originalRequest.url?.includes(path)
    );

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      if (__DEV__) {
        console.log('AUTH: 401 encountered, refresh started');
      }

      try {
        const refreshToken = await storage.getItem('refreshToken');
        if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined' || !refreshToken.trim()) {
          if (__DEV__) {
            console.log('AUTH: Refresh failed - No refresh token available in storage.');
          }
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          processQueue(new Error('No refresh token available'), null);
          return Promise.reject(error);
        }

        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: refreshToken.trim() },
          { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
        );

        const newToken = res.data?.accessToken;
        const newRefreshToken = res.data?.refreshToken;

        if (newToken) {
          await storage.setItem('accessToken', newToken);
          if (__DEV__) console.log('AUTH: access token stored: YES');

          if (newRefreshToken) {
            await storage.setItem('refreshToken', newRefreshToken);
            if (__DEV__) console.log('AUTH: refresh token stored: YES');
          }

          if (__DEV__) {
            console.log('AUTH: refresh succeeded');
          }

          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          if (__DEV__) console.log('AUTH: refresh failed - Response missing access token');
          processQueue(new Error('Refresh failed'), null);
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        if (__DEV__) console.log('AUTH: refresh failed');
        processQueue(refreshErr, null);
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
