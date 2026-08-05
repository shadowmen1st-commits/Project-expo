import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on app load
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const authDataSerialized = await SecureStore.getItemAsync('userToken');
      if (authDataSerialized) {
        // We have a token, let's try to get user profile
        const response = await api.get('/auth/me'); // Assuming there's a /me endpoint
        setUser(response.data.user);
      }
    } catch (error) {
      console.log('Error loading auth data:', error);
    } finally {
      setLoading(false);
    }
  }

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;

      await SecureStore.setItemAsync('userToken', token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
