import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NetworkProvider } from '../context/NetworkContext';
import { AuthProvider } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { LocationGate } from '../components/LocationGate';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';

// Suppress React Native Web deprecation warnings from internal Expo/RN components.
// These are from library internals (not our code) and will be fixed upstream.
LogBox.ignoreLogs([
  // RN Web: shadow* style props → boxShadow (our theme already uses boxShadow on web)
  'shadow* style props are deprecated',
  // RN Web: props.pointerEvents → style.pointerEvents (expo-router / RN internals)
  'props.pointerEvents is deprecated',
]);

export default function RootLayout() {
  React.useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <LocationGate>
          <LocationProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(customer)" />
                <Stack.Screen name="(worker)" />
                <Stack.Screen name="(company)" />
                <Stack.Screen name="(admin)" />
              </Stack>
            </AuthProvider>
          </LocationProvider>
        </LocationGate>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
