import React, { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { colors, getTabBarStyle } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompanyLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      routerRef.current.replace('/(auth)/login');
    } else if (user.role !== 'COMPANY') {
      if (user.role === 'ADMIN') routerRef.current.replace('/(admin)/dashboard');
      else if (user.role === 'WORKER') routerRef.current.replace('/(worker)/dashboard');
      else routerRef.current.replace('/(customer)/dashboard');
    }
  }, [user?.role, loading]);

  if (loading || !user || user.role !== 'COMPANY') {
    return <LoadingState message="Verifying company access..." />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: getTabBarStyle(insets),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Portal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Postings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Company',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
