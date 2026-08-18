import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const WORKER_BACKGROUND_LOCATION_TASK = 'WORKER_BACKGROUND_LOCATION_TASK';
const STORAGE_KEY_ACTIVE_TRACKING = '@jobnest_active_worker_tracking';

export interface ActiveTrackingConfig {
  bookingId: string;
  workerId: string;
  authToken: string;
  bookingNumber?: string;
}

export type LocationUpdateListener = (location: {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: string;
}) => void;

let memoryListeners: LocationUpdateListener[] = [];

// Define the global background task handler
TaskManager.defineTask(WORKER_BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[WorkerLocationService] Background task error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const loc = locations[locations.length - 1];
    const { coords, timestamp } = loc;

    const locationPayload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading || 0,
      speed: coords.speed || 0,
      accuracy: coords.accuracy || 0,
      timestamp: new Date(timestamp).toISOString(),
    };

    // Notify in-memory listeners if in foreground
    memoryListeners.forEach((listener) => {
      try {
        listener(locationPayload);
      } catch (err) {
        // non-blocking
      }
    });

    // Retrieve active tracking config from storage
    try {
      const storedConfigStr = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_TRACKING);
      if (!storedConfigStr) return;

      const config: ActiveTrackingConfig = JSON.parse(storedConfigStr);
      if (!config || !config.bookingId) return;

      // Post to backend location endpoint
      await axios.post(
        `${API_BASE_URL}/bookings/${config.bookingId}/location`,
        {
          ...locationPayload,
          workerId: config.workerId,
          bookingId: config.bookingId,
        },
        {
          headers: {
            Authorization: `Bearer ${config.authToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );
    } catch (postErr: any) {
      console.warn('[WorkerLocationService] Failed to send location ping:', postErr?.message);
    }
  }
});

export const WorkerLocationService = {
  addListener(listener: LocationUpdateListener) {
    memoryListeners.push(listener);
    return () => {
      memoryListeners = memoryListeners.filter((l) => l !== listener);
    };
  },

  /**
   * Check if worker background tracking is actively running
   */
  async isTrackingActive(): Promise<boolean> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(WORKER_BACKGROUND_LOCATION_TASK);
      if (!isRegistered) return false;
      return await Location.hasStartedLocationUpdatesAsync(WORKER_BACKGROUND_LOCATION_TASK);
    } catch {
      return false;
    }
  },

  /**
   * Start tracking worker GPS for an active booking
   */
  async startTracking(config: ActiveTrackingConfig): Promise<boolean> {
    try {
      // 1. Store tracking configuration persistently
      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_TRACKING, JSON.stringify(config));

      // 2. Request background permission if not granted
      if (Platform.OS === 'android') {
        const bgPerm = await Location.getBackgroundPermissionsAsync().catch(() => null);
        if (!bgPerm || bgPerm.status !== Location.PermissionStatus.GRANTED) {
          await Location.requestBackgroundPermissionsAsync().catch(() => null);
        }
      }

      // 3. Check if already started
      const isAlreadyRunning = await this.isTrackingActive();
      if (isAlreadyRunning) {
        return true;
      }

      // 4. Start background updates with Android foreground notification
      await Location.startLocationUpdatesAsync(WORKER_BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4000, // 4 seconds interval
        distanceInterval: 8, // 8 meters distance filter
        deferredUpdatesInterval: 4000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'JobNest - Live Location Active',
          notificationBody: 'Your location is being shared for your active service.',
          notificationColor: '#208AEF',
        },
      });

      // 5. Send immediate initial position ping
      const currentPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);

      if (currentPos) {
        const initialPayload = {
          latitude: currentPos.coords.latitude,
          longitude: currentPos.coords.longitude,
          heading: currentPos.coords.heading || 0,
          speed: currentPos.coords.speed || 0,
          accuracy: currentPos.coords.accuracy || 0,
          timestamp: new Date(currentPos.timestamp).toISOString(),
          workerId: config.workerId,
          bookingId: config.bookingId,
        };

        axios
          .post(`${API_BASE_URL}/bookings/${config.bookingId}/location`, initialPayload, {
            headers: {
              Authorization: `Bearer ${config.authToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          })
          .catch(() => {});
      }

      return true;
    } catch (err: any) {
      console.warn('[WorkerLocationService] Error starting tracking:', err?.message);
      return false;
    }
  },

  /**
   * Stop tracking worker GPS when booking is completed/cancelled/rejected
   */
  async stopTracking(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_TRACKING);
      const isRunning = await this.isTrackingActive();
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(WORKER_BACKGROUND_LOCATION_TASK);
      }
    } catch (err: any) {
      console.warn('[WorkerLocationService] Error stopping tracking:', err?.message);
    }
  },

  /**
   * Restore tracking on app launch if worker has active booking stored
   */
  async syncWorkerTracking(activeBookings: any[], authToken: string, workerId: string) {
    if (!activeBookings || !Array.isArray(activeBookings) || !authToken || !workerId) {
      return;
    }

    // Find if there is any booking with active tracking status
    const activeTrackingStatuses = ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'IN_PROGRESS', 'ARRIVED', 'STARTED'];
    const activeBooking = activeBookings.find(
      (b: any) =>
        activeTrackingStatuses.includes(b.bookingStatus || b.status) &&
        (b.workerId?._id === workerId || b.workerId === workerId || b.worker?._id === workerId || b.worker === workerId)
    );

    if (activeBooking) {
      const bId = activeBooking._id || activeBooking.id;
      await this.startTracking({
        bookingId: String(bId),
        workerId: String(workerId),
        authToken,
        bookingNumber: activeBooking.bookingNumber,
      });
    } else {
      // No active booking requires tracking; ensure stopped to save battery
      await this.stopTracking();
    }
  },
};

export default WorkerLocationService;
