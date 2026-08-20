import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { isValidCoordinate } from '../context/LocationContext';

export interface CustomerAddressData {
  houseNumber: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  addressType: 'HOME' | 'OFFICE' | 'OTHER';
  latitude: number | null;
  longitude: number | null;
  source: 'GPS' | 'MANUAL';
  formattedAddress: string;
}

export interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (address: CustomerAddressData) => void;
  initialAddress?: Partial<CustomerAddressData>;
}

// Preset popular / saved locations for quick manual selection
const PRESET_LOCATIONS: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'HOME' | 'OFFICE' | 'OTHER';
  houseNumber: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}[] = [
  {
    title: 'Home (Connaught Place)',
    icon: 'home',
    type: 'HOME',
    houseNumber: 'Flat 101',
    street: 'Connaught Place',
    landmark: 'Near Metro Gate 2',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    latitude: 28.6139,
    longitude: 77.2090,
  },
  {
    title: 'Office (Cyber City)',
    icon: 'business',
    type: 'OFFICE',
    houseNumber: 'Tower B, 4th Floor',
    street: 'DLF Cyber City, Phase 2',
    landmark: 'Near Cyber Hub',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    latitude: 28.4908,
    longitude: 77.0898,
  },
  {
    title: 'Other (Sector 62)',
    icon: 'location',
    type: 'OTHER',
    houseNumber: 'B-Block 24',
    street: 'Electronic City, Sector 62',
    landmark: 'Near Fortis Hospital',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301',
    latitude: 28.6256,
    longitude: 77.3621,
  },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialAddress,
}) => {
  const [activeTab, setActiveTab] = useState<'GPS' | 'MANUAL'>('GPS');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [servicesDisabled, setServicesDisabled] = useState(false);

  // Address Form State
  const [houseNumber, setHouseNumber] = useState(initialAddress?.houseNumber || 'Flat 101');
  const [street, setStreet] = useState(initialAddress?.street || '');
  const [landmark, setLandmark] = useState(initialAddress?.landmark || '');
  const [city, setCity] = useState(initialAddress?.city || 'New Delhi');
  const [state, setState] = useState(initialAddress?.state || 'Delhi');
  const [pincode, setPincode] = useState(initialAddress?.pincode || '110001');
  const [addressType, setAddressType] = useState<'HOME' | 'OFFICE' | 'OTHER'>(
    initialAddress?.addressType || 'HOME'
  );
  const [latitude, setLatitude] = useState<number | null>(initialAddress?.latitude || 28.6139);
  const [longitude, setLongitude] = useState<number | null>(initialAddress?.longitude || 77.2090);
  const [source, setSource] = useState<'GPS' | 'MANUAL'>(initialAddress?.source || 'GPS');
  const [searchQuery, setSearchQuery] = useState('');
  const [validationError, setValidationError] = useState('');

  // Auto-detect GPS when opening on GPS tab
  const handleDetectCurrentLocation = useCallback(async () => {
    setDetectingGps(true);
    setGpsError(null);
    setPermissionDenied(false);
    setServicesDisabled(false);
    setValidationError('');

    try {
      // 1. Check services
      const hasServices = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!hasServices) {
        setServicesDisabled(true);
        setGpsError('Location services are turned off. Please enable GPS in device settings.');
        return;
      }

      // 2. Permission Check & Request
      let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm || perm.status !== Location.PermissionStatus.GRANTED) {
        perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      }

      if (!perm || perm.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        setGpsError('Location permission is required for automatic location detection.');
        return;
      }

      // 3. Get Position
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<any>((res) => setTimeout(() => res(null), 3000)),
      ]).catch(async () => {
        return await Location.getLastKnownPositionAsync().catch(() => null);
      });

      if (!pos || !isValidCoordinate(pos.coords?.latitude, pos.coords?.longitude)) {
        setGpsError("Couldn't detect your location. You can select your address manually.");
        return;
      }

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);
      setSource('GPS');

      // 4. Reverse Geocode
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocode && geocode.length > 0) {
          const first = geocode[0];
          const detectedCity = first.city || first.subregion || first.region || 'New Delhi';
          const detectedStreet = first.street || first.name || first.district || 'Main Road';
          const detectedState = first.region || 'Delhi';
          const detectedPincode = first.postalCode || '110001';

          setCity(detectedCity);
          setStreet(detectedStreet);
          setState(detectedState);
          if (/^\d{6}$/.test(detectedPincode)) {
            setPincode(detectedPincode);
          }
        }
      } catch (geoErr) {
        console.log('[REVERSE_GEOCODE_FAIL]', geoErr);
      }
    } catch (err: any) {
      setGpsError("Couldn't detect your location. Please try again or select manually.");
    } finally {
      setDetectingGps(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      if (initialAddress?.source === 'MANUAL') {
        setActiveTab('MANUAL');
      } else {
        setActiveTab('GPS');
        handleDetectCurrentLocation();
      }
    }
  }, [visible]);

  const handleSelectPreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    setHouseNumber(preset.houseNumber);
    setStreet(preset.street);
    setLandmark(preset.landmark);
    setCity(preset.city);
    setState(preset.state);
    setPincode(preset.pincode);
    setAddressType(preset.type);
    setLatitude(preset.latitude);
    setLongitude(preset.longitude);
    setSource('MANUAL');
    setValidationError('');
  };

  const handleConfirmLocation = () => {
    if (!city.trim()) {
      setValidationError('Please enter a valid city name.');
      return;
    }
    if (!street.trim()) {
      setValidationError('Please enter a street or area name.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setValidationError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    const formattedParts = [
      houseNumber.trim(),
      street.trim(),
      landmark.trim() ? `Near ${landmark.trim()}` : '',
      city.trim(),
      state.trim(),
      `PIN: ${pincode.trim()}`,
    ].filter(Boolean);

    const addressResult: CustomerAddressData = {
      houseNumber: houseNumber.trim() || 'Flat 101',
      street: street.trim() || 'Main Road',
      landmark: landmark.trim(),
      city: city.trim(),
      state: state.trim() || 'Delhi',
      pincode: pincode.trim(),
      addressType,
      latitude: latitude ?? 28.6139,
      longitude: longitude ?? 77.2090,
      source,
      formattedAddress: formattedParts.join(', '),
    };

    onConfirm(addressResult);
    onClose();
  };

  const filteredPresets = PRESET_LOCATIONS.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.street.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.pincode.includes(q)
    );
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="location-sharp" size={22} color={colors.accent} />
              <Text style={styles.headerTitle}>Select Service Location</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close location picker">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Tabs: Automatic GPS vs Manual Selection */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'GPS' && styles.activeTabButton]}
              onPress={() => {
                setActiveTab('GPS');
                setSource('GPS');
                handleDetectCurrentLocation();
              }}
            >
              <Ionicons
                name="navigate"
                size={16}
                color={activeTab === 'GPS' ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.tabButtonText, activeTab === 'GPS' && styles.activeTabButtonText]}>
                Current GPS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'MANUAL' && styles.activeTabButton]}
              onPress={() => {
                setActiveTab('MANUAL');
                setSource('MANUAL');
              }}
            >
              <Ionicons
                name="search"
                size={16}
                color={activeTab === 'MANUAL' ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.tabButtonText, activeTab === 'MANUAL' && styles.activeTabButtonText]}>
                Select Manually
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Automatic GPS Mode */}
            {activeTab === 'GPS' && (
              <View style={styles.section}>
                {detectingGps ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Detecting your current location via GPS...</Text>
                  </View>
                ) : gpsError ? (
                  <View style={styles.errorCard}>
                    <Ionicons
                      name={permissionDenied ? 'lock-closed' : servicesDisabled ? 'location-outline' : 'alert-circle'}
                      size={24}
                      color={colors.error}
                    />
                    <Text style={styles.errorCardText}>{gpsError}</Text>
                    <View style={styles.errorActionRow}>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleDetectCurrentLocation}
                      >
                        <Text style={styles.retryButtonText}>
                          {permissionDenied ? 'Allow Location' : 'Try Again'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.manualFallbackButton}
                        onPress={() => {
                          setActiveTab('MANUAL');
                          setSource('MANUAL');
                        }}
                      >
                        <Text style={styles.manualFallbackButtonText}>Select Manually</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.detectedAddressCard}>
                    <View style={styles.detectedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={styles.detectedBadgeText}>Location detected automatically</Text>
                    </View>
                    <Text style={styles.detectedMainText}>
                      {street ? `${street}, ${city}` : `${city}, ${state}`}
                    </Text>
                    <Text style={styles.detectedSubText}>PIN: {pincode}</Text>
                    {latitude && longitude && (
                      <Text style={styles.detectedCoordsText}>
                        GPS: {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.reDetectButton}
                      onPress={handleDetectCurrentLocation}
                    >
                      <Ionicons name="refresh" size={14} color={colors.accent} />
                      <Text style={styles.reDetectButtonText}>Re-detect GPS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Manual Location Search & Presets */}
            {activeTab === 'MANUAL' && (
              <View style={styles.section}>
                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search area, street, landmark..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Preset / Recent Locations */}
                <Text style={styles.sectionHeading}>Saved / Popular Locations</Text>
                <View style={styles.presetList}>
                  {filteredPresets.map((preset, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.presetCard,
                        street === preset.street && styles.selectedPresetCard,
                      ]}
                      onPress={() => handleSelectPreset(preset)}
                    >
                      <View style={styles.presetIconContainer}>
                        <Ionicons name={preset.icon} size={18} color={colors.accent} />
                      </View>
                      <View style={styles.presetInfo}>
                        <Text style={styles.presetTitle}>{preset.title}</Text>
                        <Text style={styles.presetAddress} numberOfLines={1}>
                          {preset.houseNumber}, {preset.street}, {preset.city} - {preset.pincode}
                        </Text>
                      </View>
                      {street === preset.street && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Detailed Address Form (Common to both modes) */}
            <View style={styles.formSection}>
              <Text style={styles.sectionHeading}>Confirm Address Details</Text>

              {/* Source Indicator */}
              <View style={styles.sourceIndicator}>
                <Ionicons
                  name={source === 'GPS' ? 'navigate-circle' : 'create-outline'}
                  size={16}
                  color={source === 'GPS' ? colors.success : colors.accent}
                />
                <Text style={styles.sourceIndicatorText}>
                  {source === 'GPS'
                    ? 'Source: Automatically Detected via GPS'
                    : 'Source: Manually Selected Address'}
                </Text>
              </View>

              {/* Address Type Selector */}
              <View style={styles.addressTypeRow}>
                {(['HOME', 'OFFICE', 'OTHER'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      addressType === type && styles.activeTypeChip,
                    ]}
                    onPress={() => setAddressType(type)}
                  >
                    <Ionicons
                      name={type === 'HOME' ? 'home' : type === 'OFFICE' ? 'business' : 'location'}
                      size={14}
                      color={addressType === type ? '#FFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        addressType === type && styles.activeTypeChipText,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Input Fields */}
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Flat / House No *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={houseNumber}
                    onChangeText={setHouseNumber}
                    placeholder="e.g. Flat 101"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 2, marginLeft: spacing.sm }]}>
                  <Text style={styles.inputLabel}>Street / Area *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={street}
                    onChangeText={(val) => {
                      setStreet(val);
                      setSource('MANUAL');
                    }}
                    placeholder="e.g. Connaught Place"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Landmark (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="e.g. Near Metro Gate 2"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.5 }]}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={(val) => {
                      setCity(val);
                      setSource('MANUAL');
                    }}
                    placeholder="e.g. New Delhi"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={styles.inputLabel}>Pincode (6 digits) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={pincode}
                    onChangeText={(val) => {
                      setPincode(val.replace(/\D/g, '').slice(0, 6));
                      setSource('MANUAL');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="110001"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {validationError ? (
                <View style={styles.validationErrorBox}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={styles.validationErrorText}>{validationError}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
              <Ionicons name="checkmark-done" size={18} color="#FFF" />
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  activeTabButton: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  activeTabButtonText: {
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  errorCard: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  errorCardText: {
    color: '#991B1B',
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginVertical: spacing.xs,
  },
  errorActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.xs,
  },
  manualFallbackButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  manualFallbackButtonText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.xs,
  },
  detectedAddressCard: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  detectedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  detectedMainText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  detectedSubText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detectedCoordsText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  reDetectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  reDetectButtonText: {
    color: colors.accent,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  sectionHeading: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  presetList: {
    gap: spacing.xs,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedPresetCard: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  presetIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  presetInfo: {
    flex: 1,
  },
  presetTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  presetAddress: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  formSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  sourceIndicatorText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  activeTypeChip: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  activeTypeChipText: {
    color: '#FFF',
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  validationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.errorLight,
    padding: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  validationErrorText: {
    color: colors.error,
    fontSize: typography.sizes.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  confirmButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#FFF',
  },
});
