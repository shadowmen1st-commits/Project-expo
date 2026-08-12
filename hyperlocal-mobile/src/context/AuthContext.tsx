import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../config/api';
import { storage } from '../utils/storage';

export interface UserType {
  _id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'WORKER' | 'ADMIN' | 'COMPANY';
  phone?: string;
  profileImage?: string | null;
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

  const restoreSession = useCallback(async () => {
    try {
      const token = await storage.getItem('accessToken');
      if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
        setUser(null);
        setLoading(false);
        return;
      }
      const response = await api.get('/auth/me');
      if (response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
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
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      if (accessToken) {
        await storage.setItem('accessToken', accessToken);
      }
      if (refreshToken) {
        await storage.setItem('refreshToken', refreshToken);
      }

      setUser(userData);
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (data: any): Promise<UserType> => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        ...data,
        email: data.email?.trim().toLowerCase()
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      if (accessToken) {
        await storage.setItem('accessToken', accessToken);
      }
      if (refreshToken) {
        await storage.setItem('refreshToken', refreshToken);
      }

      setUser(userData);
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout API failure
    } finally {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      setUser(null);
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
        updateUser
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
