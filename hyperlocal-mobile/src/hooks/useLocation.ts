import { useState, useCallback, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface UseLocationResult {
  location: LocationCoords | null;
  loading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  canAskAgain: boolean;
  requestLocation: (options?: { forceHighAccuracy?: boolean; promptIfDenied?: boolean }) => Promise<LocationCoords | null>;
  openSettings: () => Promise<void>;
}

export function useLocation(autoRequest = false): UseLocationResult {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openURL('app-settings:');
    }
  }, []);

  const requestLocation = useCallback(
    async (options?: { forceHighAccuracy?: boolean; promptIfDenied?: boolean }): Promise<LocationCoords | null> => {
      const { forceHighAccuracy = false, promptIfDenied = true } = options || {};
      setLoading(true);
      setError(null);

      try {
        // 1. Check if location services are enabled on device
        const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
        if (!isServicesEnabled) {
          const msg = 'Location services are disabled on your device. Please enable GPS in device settings.';
          setError(msg);
          if (promptIfDenied) {
            Alert.alert('Location Services Disabled', msg, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Enable Location', onPress: openSettings },
            ]);
          }
          return null;
        }

        // 2. Request Foreground Permission
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== Location.PermissionStatus.GRANTED) {
          perm = await Location.requestForegroundPermissionsAsync();
        }

        setPermissionStatus(perm.status);
        setCanAskAgain(perm.canAskAgain);

        if (perm.status !== Location.PermissionStatus.GRANTED) {
          const msg = 'Location permission is required to show nearby professionals and track your assigned worker.';
          setError(msg);

          if (promptIfDenied) {
            if (!perm.canAskAgain) {
              Alert.alert(
                'Location Permission Required',
                `${msg}\n\nPlease tap "Enable Location" to open settings and grant access.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Enable Location', onPress: openSettings },
                ]
              );
            } else {
              Alert.alert('Location Access Denied', msg, [{ text: 'OK' }]);
            }
          }
          return null;
        }

        // 3. Obtain current position with timeout safeguard
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: forceHighAccuracy ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
        });

        // 10s fallback timeout to prevent hanging on emulators
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
        const pos = await Promise.race([positionPromise, timeoutPromise]);

        if (pos) {
          const coords: LocationCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };
          setLocation(coords);
          setError(null);
          return coords;
        }

        // Fallback: Last known position
        const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastKnown) {
          const coords: LocationCoords = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
            heading: lastKnown.coords.heading,
            speed: lastKnown.coords.speed,
          };
          setLocation(coords);
          setError(null);
          return coords;
        }

        // Emulator default or graceful fallback
        const fallbackCoords: LocationCoords = {
          latitude: 12.9716,
          longitude: 77.5946,
        };
        setLocation(fallbackCoords);
        return fallbackCoords;
      } catch (err: any) {
        const msg = err?.message || 'Unable to retrieve your current location.';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [openSettings]
  );

  useEffect(() => {
    if (autoRequest) {
      requestLocation({ promptIfDenied: false });
    }
  }, [autoRequest, requestLocation]);

  return {
    location,
    loading,
    error,
    permissionStatus,
    canAskAgain,
    requestLocation,
    openSettings,
  };
}

export default useLocation;
