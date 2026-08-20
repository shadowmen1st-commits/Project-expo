import React, { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, getTabBarStyle } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomerLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      routerRef.current.replace('/(auth)/login');
    } else if (user.role === 'ADMIN') {
      routerRef.current.replace('/(admin)/dashboard');
    } else if (user.role === 'WORKER') {
      routerRef.current.replace('/(worker)/dashboard');
    }
  }, [user?.role, loading]);

  if (loading || !user) {
    return <LoadingState message="Verifying session..." />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: getTabBarStyle(insets),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.weights.bold,
        },
      }}
    >
      {/* 1. Home / Dashboard */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 2. Categories / Services */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 3. Customer Bookings */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 4. Customer Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* Hidden routes without bottom tabs */}
      <Tabs.Screen name="workers" options={{ href: null }} />
      <Tabs.Screen name="worker/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/[workerId]" options={{ href: null }} />
      <Tabs.Screen name="booking/details/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/tracking/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/payment/[id]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
