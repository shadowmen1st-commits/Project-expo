import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '../utils/storage';

export const normalizeApiUrl = (url?: string) => {
  if (!url || !url.trim()) {
    if (__DEV__) {
      console.warn('[API_CONFIG_DEFAULT] EXPO_PUBLIC_API_URL not set. Defaulting to local Wi-Fi LAN backend.');
      return 'http://192.168.1.10:5000/api';
    }
    console.warn('[PUBLIC_BACKEND_REQUIRED] EXPO_PUBLIC_API_URL is missing in production build!');
    return 'http://192.168.1.10:5000/api';
  }
  let cleaned = url.trim().replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/api\/api$/, '/api');
  if (!cleaned.endsWith('/api')) {
    cleaned += '/api';
  }
  return cleaned;
};

export const normalizeSocketUrl = (url?: string, apiBaseUrl?: string) => {
  if (url && url.trim()) {
    return url.trim().replace(/\/+$/, '');
  }
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/api\/?$/, '');
  }
  return 'http://192.168.1.10:5000';
};

export const API_BASE_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
export const SOCKET_BASE_URL = normalizeSocketUrl(process.env.EXPO_PUBLIC_SOCKET_URL, API_BASE_URL);

console.log('[API_CONFIG]', {
  baseURL: API_BASE_URL,
  socketURL: SOCKET_BASE_URL,
  platform: Platform.OS,
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
    }

    if (__DEV__ && !isPublicRoute) {
      console.log('[API_REQUEST]', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL || API_BASE_URL,
      });
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

export const checkServerHealth = async (): Promise<{ ok: boolean; status?: number; data?: any; error?: string }> => {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/health`, { timeout: 8000 });
    return { ok: res.status === 200, status: res.status, data: res.data };
  } catch (err: any) {
    try {
      const fallbackRes = await axios.get(`${API_BASE_URL}/health`, { timeout: 8000 });
      return { ok: fallbackRes.status === 200, status: fallbackRes.status, data: fallbackRes.data };
    } catch (fallbackErr: any) {
      return {
        ok: false,
        error: fallbackErr.message || err.message || 'Server unreachable',
      };
    }
  }
};

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('[API_RESPONSE]', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
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

    if (!error.response) {
      const code = error.code || '';
      let userFriendlyMsg = 'Unable to connect to server. Please check your internet connection or verify the server is reachable.';

      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        userFriendlyMsg = 'Connection timed out. Please check your network speed.';
      } else if (code === 'ENOTFOUND') {
        userFriendlyMsg = 'Server domain not found. Please verify backend URL.';
      } else if (code === 'ECONNREFUSED') {
        userFriendlyMsg = 'Connection refused. Ensure the backend server is running.';
      } else if (code.includes('SSL') || code.includes('CERT')) {
        userFriendlyMsg = 'SSL/TLS certificate error. Please verify the HTTPS certificate.';
      }

      console.error('[API_NETWORK_ERROR]', {
        url: originalRequest.url,
        baseURL: originalRequest.baseURL || API_BASE_URL,
        method: originalRequest.method,
        message: error.message,
        code: error.code,
        status: error.response?.status,
        category: code || 'NO_RESPONSE',
      });
      error.userMessage = userFriendlyMsg;
    } else {
      const status = error.response.status;
      const serverMsg = error.response.data?.message;
      if (status === 401) {
        error.userMessage = serverMsg || 'Invalid email or password.';
      } else if (status === 403) {
        error.userMessage = serverMsg || 'Access denied. Please check your permissions.';
      } else if (status === 404) {
        error.userMessage = serverMsg || 'API endpoint not found.';
      } else if (status >= 500) {
        error.userMessage = serverMsg || 'Backend server error. Please try again in a few moments.';
      } else {
        error.userMessage = serverMsg || error.message || 'Request failed. Please try again.';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
