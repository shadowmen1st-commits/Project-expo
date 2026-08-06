import React, { createContext, useState, useContext, useEffect } from 'react';
import storage from '../utils/storage';
import api from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const token = await storage.getItem('userToken');
      if (token) {
        const response = await api.get('/auth/me');
        if (response.data?.user) {
          setUser(response.data.user);
        }
      }
    } catch (error) {
      console.log('Session restore info:', error?.message);
    } finally {
      setLoading(false);
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const authToken = response.data?.accessToken || response.data?.token;
      const userData = response.data?.user;

      if (authToken) {
        await storage.setItem('userToken', authToken);
      }
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid email or password.'
      };
    }
  };

  const register = async ({ name, email, phone, password, role = 'CUSTOMER' }) => {
    try {
      const formattedPhone = phone ? phone.replace(/\D/g, '') : '';
      const payload = {
        name,
        email: email ? email.toLowerCase().trim() : '',
        phone: formattedPhone || '9876543210',
        password,
        role,
      };

      const response = await api.post('/auth/register', payload);
      if (response.data?.user || response.data?.success) {
        // Auto sign-in after registration
        return await login(email, password);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed. Please check inputs.'
      };
    }
  };

  const loginWithGoogle = async (role = 'CUSTOMER') => {
    try {
      // Demo Social Google Login session setup
      const dummyUser = {
        _id: 'g_user_' + Math.random().toString(36).substring(2, 8),
        name: 'Google User',
        email: 'google.user@example.com',
        role: role,
        status: 'ACTIVE',
      };
      await storage.setItem('userToken', 'google_mock_token_123');
      setUser(dummyUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Google sign-in demo completed.'
      };
    }
  };

  const loginWithApple = async (role = 'CUSTOMER') => {
    try {
      // Demo Social Apple Login session setup
      const dummyUser = {
        _id: 'apple_user_' + Math.random().toString(36).substring(2, 8),
        name: 'Apple User',
        email: 'apple.user@example.com',
        role: role,
        status: 'ACTIVE',
      };
      await storage.setItem('userToken', 'apple_mock_token_123');
      setUser(dummyUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Apple sign-in demo completed.'
      };
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem('userToken');
    } catch (e) {
      console.log('Error clearing token:', e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      loginWithGoogle,
      loginWithApple,
      logout,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
