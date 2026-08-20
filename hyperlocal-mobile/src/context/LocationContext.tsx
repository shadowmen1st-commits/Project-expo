import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  street: string | null;
  formattedAddress: string | null;
  displayName: string;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  updatedAt: number | null;
  refreshLocation: (forceHighAccuracy?: boolean) => Promise<void>;
  openSettings: () => Promise<void>;
}

const LocationContext = createContext<LocationState | undefined>(undefined);

export function isValidCoordinate(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState<string | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Detecting location...');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef<number>(0);

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

  const fetchRealLocation = useCallback(
    async (forceHighAccuracy = true) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // 1. Check services
        const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
        if (!isServicesEnabled) {
          const errText = 'Location services are disabled. Please enable GPS in device settings.';
          console.error('[LOCATION_ERROR]', errText);
          setError(errText);
          setDisplayName('Location Unavailable');
          return;
        }

        // 2. Request Foreground Permission
        let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (!perm || perm.status !== Location.PermissionStatus.GRANTED) {
          perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
        }

        const currentPermStatus = perm?.status || Location.PermissionStatus.DENIED;
        setPermissionStatus(currentPermStatus);
        console.log(`[LOCATION_PERMISSION] status=${currentPermStatus}`);

        if (currentPermStatus !== Location.PermissionStatus.GRANTED) {
          const errText = 'Location permission is required to detect your current location.';
          console.error('[LOCATION_ERROR]', errText);
          setError(errText);
          setDisplayName('Location Unavailable');
          return;
        }

        // 3. Get Fresh GPS Position
        const pos = await Location.getCurrentPositionAsync({
          accuracy: forceHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
        }).catch(async (posErr) => {
          console.log('[LOCATION_GPS_RETRY]', posErr?.message);
          return await Location.getLastKnownPositionAsync().catch(() => null);
        });

        if (!pos || !isValidCoordinate(pos.coords.latitude, pos.coords.longitude)) {
          const errText = 'Unable to detect your current location. Please try again.';
          console.error('[LOCATION_ERROR]', errText);
          setError(errText);
          setDisplayName('Location Unavailable');
          return;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || null;
        const now = Date.now();

        console.log(`[LOCATION_GPS] latitude=${lat} longitude=${lng} accuracy=${acc ? acc.toFixed(1) : 'unknown'}m`);

        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(acc);
        setUpdatedAt(now);
        lastFetchedRef.current = now;

        // 4. Reverse Geocode Coordinates
        let detectedCity: string | null = null;
        let detectedDistrict: string | null = null;
        let detectedState: string | null = null;
        let detectedCountry: string | null = 'India';
        let detectedPostalCode: string | null = null;
        let detectedStreet: string | null = null;
        let constructedDisplay = 'Current Location';
        let constructedFormatted = '';

        try {
          const geocodeResults = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
          });

          if (geocodeResults && geocodeResults.length > 0) {
            const first = geocodeResults[0];
            detectedCity = first.city || first.subregion || first.district || first.region || null;
            detectedDistrict = first.district || first.subregion || first.name || null;
            detectedState = first.region || null;
            detectedCountry = first.country || 'India';
            detectedPostalCode = first.postalCode || null;
            detectedStreet = first.street || first.name || null;

            console.log(
              `[LOCATION_REVERSE_GEOCODE] city=${first.city} district=${first.district} subregion=${first.subregion} state=${first.region} postalCode=${first.postalCode}`
            );

            // Construct smart readable display name
            const primaryArea = first.district || first.subregion || first.name || first.street;
            const primaryCity = first.city || first.region;

            if (primaryArea && primaryCity && primaryArea.toLowerCase() !== primaryCity.toLowerCase()) {
              constructedDisplay = `${primaryArea}, ${primaryCity}`;
            } else if (primaryCity) {
              constructedDisplay = primaryCity;
            } else if (primaryArea) {
              constructedDisplay = primaryArea;
            }

            const addressParts = [
              first.name,
              first.street,
              first.district || first.subregion,
              first.city,
              first.region,
              first.postalCode,
            ].filter(Boolean);
            constructedFormatted = addressParts.join(', ');
          }
        } catch (geoErr: any) {
          console.log('[LOCATION_REVERSE_GEOCODE_FAIL]', geoErr?.message);
        }

        const finalCity = detectedCity || constructedDisplay || 'Current Location';
        console.log(`[LOCATION_CITY] ${finalCity}`);

        setCity(finalCity);
        setDistrict(detectedDistrict);
        setState(detectedState);
        setCountry(detectedCountry);
        setPostalCode(detectedPostalCode);
        setStreet(detectedStreet);
        setFormattedAddress(constructedFormatted || constructedDisplay);
        setDisplayName(constructedDisplay);
        setError(null);
      } catch (err: any) {
        const errText = err?.message || 'Unable to detect your current location. Please try again.';
        console.error('[LOCATION_ERROR]', errText);
        setError(errText);
        setDisplayName('Location Unavailable');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    []
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchRealLocation(true);
  }, [fetchRealLocation]);

  // Refresh on app resume
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const elapsed = Date.now() - lastFetchedRef.current;
        // Refresh if older than 45 seconds
        if (elapsed > 45000) {
          fetchRealLocation(false);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [fetchRealLocation]);

  const refreshLocation = useCallback(
    async (forceHighAccuracy = true) => {
      await fetchRealLocation(forceHighAccuracy);
    },
    [fetchRealLocation]
  );

  return (
    <LocationContext.Provider
      value={{
        latitude,
        longitude,
        city,
        district,
        state,
        country,
        postalCode,
        street,
        formattedAddress,
        displayName,
        accuracy,
        loading,
        error,
        permissionStatus,
        updatedAt,
        refreshLocation,
        openSettings,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = (): LocationState => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;
