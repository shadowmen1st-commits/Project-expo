import { useState, useCallback, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
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

/**
 * Validates that coordinates are legitimate real-world geographic coordinates.
 */
export function isValidCoordinate(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
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
      const { forceHighAccuracy = true, promptIfDenied = true } = options || {};
      setLoading(true);
      setError(null);

      try {
        // 1. Check if location services are enabled on device
        console.log('[LOCATION_SERVICES_CHECK]');
        const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
        console.log('[LOCATION_SERVICES]', { isServicesEnabled });

        if (!isServicesEnabled) {
          const msg = 'Location services are disabled on your device. Please turn ON GPS in device settings.';
          setError(msg);
          if (promptIfDenied) {
            Alert.alert('Location Services Disabled', msg, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openSettings },
            ]);
          }
          return null;
        }

        // 2. Request Foreground Permission
        console.log('[LOCATION_PERMISSION_REQUEST]');
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== Location.PermissionStatus.GRANTED) {
          perm = await Location.requestForegroundPermissionsAsync();
        }

        console.log('[LOCATION_PERMISSION_RESULT]', perm.status);
        setPermissionStatus(perm.status);
        setCanAskAgain(perm.canAskAgain);

        if (perm.status !== Location.PermissionStatus.GRANTED) {
          const msg = 'Location permission is required to detect your location and track services.';
          setError(msg);

          if (promptIfDenied) {
            if (!perm.canAskAgain) {
              Alert.alert(
                'Location Permission Required',
                `${msg}\n\nPlease tap "Open Settings" to grant location access.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: openSettings },
                ]
              );
            } else {
              Alert.alert('Location Access Denied', msg, [{ text: 'OK' }]);
            }
          }
          return null;
        }

        // 3. Obtain fresh real GPS position
        const pos = await Location.getCurrentPositionAsync({
          accuracy: forceHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
        }).catch(async (posErr) => {
          console.log('[GPS_CURRENT_POSITION_FALLBACK]', posErr?.message);
          // Only fallback to last known location temporarily if fresh GPS fails
          return await Location.getLastKnownPositionAsync().catch(() => null);
        });

        if (pos && isValidCoordinate(pos.coords.latitude, pos.coords.longitude)) {
          const coords: LocationCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          };
          console.log('[GPS_UPDATE]', {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            timestamp: coords.timestamp,
          });
          setLocation(coords);
          setError(null);
          return coords;
        }

        // No valid GPS signal acquired
        setError('Waiting for GPS signal...');
        return null;
      } catch (err: any) {
        const msg = err?.message || 'Unable to retrieve your physical location.';
        console.log('[GPS_ERROR]', msg);
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
