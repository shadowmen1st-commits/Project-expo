import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import api from '../config/api';
import { storage } from '../utils/storage';

export interface UserType {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'WORKER' | 'ADMIN' | 'COMPANY';
  phone?: string;
  profileImage?: string | null;
  verificationStatus?: string;
  kycStatus?: string;
  isKycVerified?: boolean;
  verificationBadge?: boolean;
  isVerified?: boolean;
}

interface AuthContextType {
  user: UserType | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<UserType>;
  registerUser: (data: any) => Promise<UserType>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateUser: (data: Partial<UserType>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const restoreSession = useCallback(async () => {
    try {
      const token = await storage.getItem('accessToken');
      if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (__DEV__) console.log('AUTH: Restoring session via /auth/me');
      const response = await api.get('/auth/me');
      if (response.data?.user) {
        setUser(response.data.user);
        if (__DEV__) console.log('AUTH: Session restored successfully for', response.data.user.email);
      } else {
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        setUser(null);
      }
    } catch (err) {
      if (__DEV__) console.log('AUTH: restoreSession failed, clearing session storage');
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string): Promise<UserType> => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[LOGIN_START]', { email: normalizedEmail, timestamp: new Date().toISOString() });
    console.log('[LOGIN_API_URL]', `${api.defaults.baseURL}/auth/login`);
    console.log('[LOGIN_REQUEST]', { email: normalizedEmail, hasPassword: Boolean(password) });

    try {
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

      console.log('[LOGIN_RESPONSE]', {
        status: response.status,
        success: response.data?.success,
        role: response.data?.user?.role,
        userId: response.data?.user?.id || response.data?.user?._id,
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      if (accessToken) {
        await storage.setItem('accessToken', accessToken);
        if (__DEV__) console.log('AUTH: login access token stored: YES');
      }
      if (refreshToken) {
        await storage.setItem('refreshToken', refreshToken);
        if (__DEV__) console.log('AUTH: login refresh token stored: YES');
      }

      console.log('[LOGIN_SUCCESS]', {
        email: userData?.email,
        role: userData?.role,
        id: userData?.id || userData?._id,
      });

      setUser(userData);
      return userData;
    } catch (err: any) {
      if (err.response) {
        console.error('[LOGIN_FAILURE]', {
          status: err.response.status,
          message: err.response.data?.message || err.message,
          errorCode: err.response.data?.errorCode,
        });
      } else {
        console.error('[LOGIN_NETWORK_ERROR]', {
          message: err.message,
          code: err.code,
          baseURL: api.defaults.baseURL,
        });
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (data: any): Promise<UserType> => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        ...data,
        email: data.email?.trim().toLowerCase(),
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      if (accessToken) {
        await storage.setItem('accessToken', accessToken);
      }
      if (refreshToken) {
        await storage.setItem('refreshToken', refreshToken);
      }

      if (userData) {
        setUser(userData);
      }
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await storage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch (e) {
      // Ignore logout API network failure
    } finally {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('accessToken');
          window.localStorage.removeItem('refreshToken');
          window.localStorage.clear();
        } catch {
          // ignore web storage errors
        }
      }
      setUser(null);
      if (__DEV__) console.log('AUTH: Logout complete, storage tokens cleared');
      try {
        router.replace('/(auth)/login');
      } catch {
        // ignore router errors if unmounted
      }
    }
  };

  const updateUser = (data: Partial<UserType>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        registerUser,
        logout,
        restoreSession,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
