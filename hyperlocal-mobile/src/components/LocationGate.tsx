import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';

interface LocationGateProps {
  children: React.ReactNode;
}

type GateState = 'CHECKING' | 'GPS_DISABLED' | 'PERMISSION_DENIED' | 'GRANTED';

export const LocationGate: React.FC<LocationGateProps> = ({ children }) => {
  const [gateState, setGateState] = useState<GateState>('CHECKING');
  const [isRechecking, setIsRechecking] = useState(false);
  const checkingRef = useRef(false);

  const checkStatus = useCallback(async (isSilent = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    if (!isSilent) {
      setIsRechecking(true);
    }

    try {
      // 1. Check if hardware GPS / location services are turned on
      const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!isServicesEnabled) {
        setGateState('GPS_DISABLED');
        return;
      }

      // 2. Check foreground location permission
      let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm || perm.status === Location.PermissionStatus.UNDETERMINED) {
        perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      }

      if (!perm || perm.status !== Location.PermissionStatus.GRANTED) {
        setGateState('PERMISSION_DENIED');
        return;
      }

      // GPS is on & Permission is granted!
      setGateState('GRANTED');
    } catch {
      // If error checking, check services again
      setGateState('GPS_DISABLED');
    } finally {
      checkingRef.current = false;
      setIsRechecking(false);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen to AppState (when returning to app after enabling GPS in Android Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkStatus(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkStatus]);

  // Open Android GPS / Location Hardware Settings
  const openLocationSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        try {
          await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
          return;
        } catch {
          // Fallback to general settings
          await Linking.openSettings();
          return;
        }
      }
      await Linking.openSettings();
    } catch {
      await Linking.openURL('app-settings:');
    }
  }, []);

  // Open App-specific Permission Settings
  const openAppSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      await Linking.openURL('app-settings:');
    }
  }, []);

  // While performing the initial check
  if (gateState === 'CHECKING') {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="location" size={36} color={colors.accent} />
          </View>
          <Text style={styles.brandTitle}>Jobnest</Text>
          <Text style={styles.brandSubtitle}>Verifying GPS & Location Services...</Text>
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    );
  }

  // If GPS is OFF on the device
  if (gateState === 'GPS_DISABLED') {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.gateContent}>
          {/* Visual Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Ionicons name="location-outline" size={56} color={colors.accent} />
          </View>

          {/* Texts */}
          <Text style={styles.gateTitle}>Location Required</Text>
          <Text style={styles.gateSubtitle}>
            Please turn on Location/GPS to continue using the app.
          </Text>
          <Text style={styles.gateDescription}>
            JobNest relies on GPS to find verified nearby service professionals, calculate exact travel distances, and enable real-time booking tracking.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openLocationSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Turn On Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => checkStatus(false)}
              disabled={isRechecking}
              activeOpacity={0.7}
            >
              {isRechecking ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Check Again</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // If GPS is ON, but App Permission is Denied
  if (gateState === 'PERMISSION_DENIED') {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.gateContent}>
          {/* Visual Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Ionicons name="shield-outline" size={56} color="#EF4444" />
          </View>

          {/* Texts */}
          <Text style={styles.gateTitle}>Permission Required</Text>
          <Text style={styles.gateSubtitle}>
            Location permission is needed for service dispatch and live tracking.
          </Text>
          <Text style={styles.gateDescription}>
            Please grant location access in your device app settings so JobNest can connect you with local professionals.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primaryDark }]}
              onPress={openAppSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="cog-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Open App Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => checkStatus(false)}
              disabled={isRechecking}
              activeOpacity={0.7}
            >
              {isRechecking ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Check Again</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // GPS is Enabled and Permission Granted: Render Child Application
  return <>{children}</>;
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  brandTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  gateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
    ...shadows.sm,
  },
  gateTitle: {
    fontSize: 26,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  gateSubtitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  gateDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});

export default LocationGate;
