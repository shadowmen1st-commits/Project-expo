import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';

// Suppress React Native Web deprecation warnings from internal Expo/RN components.
// These are from library internals (not our code) and will be fixed upstream.
LogBox.ignoreLogs([
  // RN Web: shadow* style props → boxShadow (our theme already uses boxShadow on web)
  'shadow* style props are deprecated',
  // RN Web: props.pointerEvents → style.pointerEvents (expo-router / RN internals)
  'props.pointerEvents is deprecated',
]);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(worker)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
