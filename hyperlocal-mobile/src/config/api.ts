import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '../utils/storage';

export const normalizeApiUrl = (url?: string) => {
  let cleaned = (url || '').trim();

  // If no URL is provided, fallback cleanly
  if (!cleaned) {
    if (__DEV__) {
      console.warn('[API_CONFIG] EXPO_PUBLIC_API_URL not set in dev, using default public HTTPS tunnel.');
      cleaned = 'https://affiliation-oaks-walnut-bonds.trycloudflare.com/api';
    } else {
      console.error('[API_CONFIG_CRITICAL] EXPO_PUBLIC_API_URL is missing in production build!');
      cleaned = 'https://affiliation-oaks-walnut-bonds.trycloudflare.com/api';
    }
  }

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');

  // Prevent duplicate prefixes like /api/api or /api/v1/api/v1
  cleaned = cleaned.replace(/\/api\/api$/, '/api');
  cleaned = cleaned.replace(/\/v1\/v1$/, '/v1');
  cleaned = cleaned.replace(/\/api\/v1\/api\/v1$/, '/api/v1');

  if (!cleaned.endsWith('/api') && !cleaned.endsWith('/api/v1')) {
    cleaned += '/api';
  }

  // Release environment safety validation
  if (!__DEV__) {
    const isLocal = ['localhost', '127.0.0.1', '192.168.', '10.0.', '172.16.', '172.31.'].some(ip => cleaned.includes(ip));
    const isHttp = cleaned.startsWith('http://');
    if (isLocal || isHttp) {
      console.error('[API_CONFIG_SECURITY_VIOLATION] Production APK must not point to local/insecure URL:', cleaned);
    }
  }

  return cleaned;
};

export const normalizeSocketUrl = (url?: string, apiBaseUrl?: string) => {
  let cleaned = (url || '').trim();
  if (!cleaned && apiBaseUrl) {
    cleaned = apiBaseUrl.replace(/\/api(\/v1)?\/?$/, '');
  }
  if (!cleaned) {
    cleaned = 'https://affiliation-oaks-walnut-bonds.trycloudflare.com';
  }
  return cleaned.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
export const SOCKET_BASE_URL = normalizeSocketUrl(process.env.EXPO_PUBLIC_SOCKET_URL, API_BASE_URL);

console.log('[API_CONFIG]', {
  environment: __DEV__ ? 'development' : 'production',
  apiUrl: API_BASE_URL,
  socketUrl: SOCKET_BASE_URL,
  platform: Platform.OS,
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach bearer token & log safely
api.interceptors.request.use(
  async (config) => {
    const isPublicRoute = ['/auth/login', '/auth/register', '/auth/refresh', '/categories', '/services', '/workers/search', '/health'].some(
      (path) => config.url?.includes(path)
    );

    const token = await storage.getItem('accessToken');
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      config.headers.Authorization = `Bearer ${token.trim()}`;
      if (__DEV__ && !isPublicRoute) {
        console.log(`[API_AUTH] Authorized request to ${config.url}`);
      }
    } else {
      delete config.headers.Authorization;
    }

    if (__DEV__) {
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

/**
 * Public health check diagnostic helper
 */
export const checkServerHealth = async (): Promise<{ ok: boolean; status?: number; data?: any; error?: string }> => {
  try {
    const res = await axios.get(`${API_BASE_URL}/v1/health`, { timeout: 8000 });
    console.log('[SERVER_HEALTH]', { reachable: true, status: res.status });
    return { ok: res.status === 200, status: res.status, data: res.data };
  } catch (err: any) {
    try {
      const fallbackRes = await axios.get(`${API_BASE_URL}/health`, { timeout: 8000 });
      console.log('[SERVER_HEALTH]', { reachable: true, status: fallbackRes.status });
      return { ok: fallbackRes.status === 200, status: fallbackRes.status, data: fallbackRes.data };
    } catch (fallbackErr: any) {
      const safeErrorMsg = fallbackErr.message || err.message || 'Server unreachable';
      console.log('[SERVER_HEALTH]', { reachable: false, error: safeErrorMsg });
      return {
        ok: false,
        error: safeErrorMsg,
      };
    }
  }
};

// Response Interceptor: Safe status differentiation & error handling
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

    // Auto-refresh on 401
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

      try {
        const refreshToken = await storage.getItem('refreshToken');
        if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined' || !refreshToken.trim()) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          processQueue(new Error('No refresh token available'), null);
          return Promise.reject(error);
        }

        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: refreshToken.trim() },
          { headers: { 'Content-Type': 'application/json' }, withCredentials: true, timeout: 10000 }
        );

        const newToken = res.data?.accessToken;
        const newRefreshToken = res.data?.refreshToken;

        if (newToken) {
          await storage.setItem('accessToken', newToken);
          if (newRefreshToken) {
            await storage.setItem('refreshToken', newRefreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          processQueue(new Error('Refresh response missing token'), null);
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Determine user-facing friendly message
    if (!error.response) {
      const code = error.code || '';
      let userFriendlyMsg = 'Unable to connect to Jobnest server. Check your internet connection.';

      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        userFriendlyMsg = 'Jobnest server request timed out.';
      } else if (code === 'ENOTFOUND') {
        userFriendlyMsg = 'Server domain not found. Check your internet connection.';
      } else if (code === 'ECONNREFUSED') {
        userFriendlyMsg = 'Unable to connect to Jobnest server. Server connection refused.';
      } else if (code.includes('SSL') || code.includes('CERT')) {
        userFriendlyMsg = 'Secure SSL/TLS connection failed. Please verify your connection.';
      }

      console.error('[API_NETWORK_ERROR]', {
        message: error.message,
        code: error.code,
        baseURL: originalRequest.baseURL || API_BASE_URL,
        url: originalRequest.url,
      });

      error.userMessage = userFriendlyMsg;
    } else {
      const status = error.response.status;
      const serverMsg = error.response.data?.message;

      if (status === 401) {
        error.userMessage = serverMsg || 'Invalid email or password.';
      } else if (status === 403) {
        error.userMessage = serverMsg || 'Access denied.';
      } else if (status === 404) {
        error.userMessage = serverMsg || 'API endpoint not found.';
      } else if (status === 408) {
        error.userMessage = serverMsg || 'Request timeout.';
      } else if (status === 429) {
        error.userMessage = serverMsg || 'Too many requests. Please try again.';
      } else if (status >= 500) {
        error.userMessage = serverMsg || 'Server error. Please try again.';
      } else {
        error.userMessage = serverMsg || error.message || 'Request failed. Please try again.';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
