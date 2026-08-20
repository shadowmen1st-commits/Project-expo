import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { MobileHeader } from '../../components/MobileHeader';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import { colors, spacing, typography, radius, shadows } from '../../theme';

export default function CompanyRegisterScreen() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [authorizedPersonName, setAuthorizedPersonName] = useState('');
  const [authorizedPersonPhone, setAuthorizedPersonPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = (): boolean => {
    if (!companyName.trim() || companyName.trim().length < 2) {
      setErrorMessage('Please enter a valid Company Name (minimum 2 characters).');
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid official Email Address.');
      return false;
    }
    if (!phone.trim() || !/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      setErrorMessage('Please enter a valid Company Phone Number (7-15 digits).');
      return false;
    }
    if (!address.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setErrorMessage('Please complete all business address fields (address, city, state, pincode).');
      return false;
    }
    if (!/^[0-9]{4,10}$/.test(pincode.trim())) {
      setErrorMessage('Please enter a valid Pincode / Postal code.');
      return false;
    }
    if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErrorMessage('Password must be at least 8 characters long and contain both letters and numbers.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return false;
    }
    if (gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.trim().toUpperCase())) {
      setErrorMessage('Invalid GSTIN format (Expected 15-character alphanumeric GSTIN).');
      return false;
    }
    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
      setErrorMessage('Invalid PAN format (Expected 10-character alphanumeric PAN).');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (loading) return;
    if (!validateForm()) return;

    setErrorMessage('');
    setLoading(true);

    const safePayload = {
      companyName: companyName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      businessType: businessType.trim() || 'Services',
      description: description.trim() || `Company on Jobnest platform`,
      gstNumber: gstNumber.trim().toUpperCase() || undefined,
      panNumber: panNumber.trim().toUpperCase() || undefined,
      website: website.trim() || undefined,
      authorizedPersonName: authorizedPersonName.trim() || companyName.trim(),
      authorizedPersonPhone: authorizedPersonPhone.trim() || phone.trim(),
      password,
      confirmPassword,
    };

    console.log('[COMPANY_REGISTER_START]', { email: safePayload.email, companyName: safePayload.companyName });
    console.log('[COMPANY_REGISTER_REQUEST]', {
      url: `${api.defaults.baseURL}/company/register`,
      email: safePayload.email,
      phone: safePayload.phone,
      city: safePayload.city,
      hasGst: Boolean(safePayload.gstNumber),
      hasPan: Boolean(safePayload.panNumber),
    });

    try {
      const response = await api.post('/company/register', safePayload);

      console.log('[COMPANY_REGISTER_RESPONSE]', {
        status: response.status,
        success: response.data?.success,
        companyId: response.data?.company?.id,
        userId: response.data?.user?.id || response.data?.user?._id,
      });
      console.log('[COMPANY_REGISTER_SUCCESS]', { email: safePayload.email });

      Alert.alert(
        'Registration Successful 🎉',
        'Your company account has been registered successfully on Jobnest! Please sign in with your credentials.',
        [
          {
            text: 'Sign In Now',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (err: any) {
      console.error('[COMPANY_REGISTER_FAILURE]', {
        status: err.response?.status,
        message: err.response?.data?.message || err.message,
        errorCode: err.response?.data?.errorCode,
      });

      const msg =
        err.response?.data?.message || err.userMessage || err.message || 'Company registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MobileHeader title="Company Registration" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="business" size={28} color={colors.primaryDark} />
            </View>
            <Text style={styles.welcomeText}>Register Your Business</Text>
            <Text style={styles.subtitleText}>
              Onboard and manage staff, team assignments, and bookings on Jobnest
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Section 1: Business Details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Company Information</Text>

            <AppInput
              label="Company / Business Name *"
              placeholder="e.g. Acme Facility Services"
              value={companyName}
              onChangeText={setCompanyName}
              icon="business-outline"
            />

            <AppInput
              label="Official Email Address *"
              placeholder="admin@acmeservices.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <AppInput
              label="Business Contact Phone *"
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="call-outline"
            />

            <AppInput
              label="Business Type"
              placeholder="e.g. Facility Management, Event Agency"
              value={businessType}
              onChangeText={setBusinessType}
              icon="briefcase-outline"
            />

            <AppInput
              label="Company Website"
              placeholder="https://acmeservices.com"
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
              icon="globe-outline"
            />

            <AppInput
              label="Company Description"
              placeholder="Brief description of your services & operations..."
              value={description}
              onChangeText={setDescription}
              multiline
              icon="document-text-outline"
            />
          </View>

          {/* Section 2: Address */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Registered Address</Text>

            <AppInput
              label="Street Address *"
              placeholder="Office/Floor/Building address"
              value={address}
              onChangeText={setAddress}
              icon="location-outline"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <AppInput
                  label="City *"
                  placeholder="New Delhi"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="State *"
                  placeholder="Delhi"
                  value={state}
                  onChangeText={setState}
                />
              </View>
            </View>

            <AppInput
              label="Pincode *"
              placeholder="110001"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="numeric"
            />
          </View>

          {/* Section 3: Legal & Tax */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tax & Verification</Text>

            <AppInput
              label="GST Number (Optional)"
              placeholder="22AAAAA0000A1Z5"
              value={gstNumber}
              onChangeText={setGstNumber}
              autoCapitalize="characters"
              icon="receipt-outline"
            />

            <AppInput
              label="PAN Number (Optional)"
              placeholder="ABCDE1234F"
              value={panNumber}
              onChangeText={setPanNumber}
              autoCapitalize="characters"
              icon="card-outline"
            />

            <AppInput
              label="Authorized Person Name"
              placeholder="Managing Director / Owner Name"
              value={authorizedPersonName}
              onChangeText={setAuthorizedPersonName}
              icon="person-outline"
            />

            <AppInput
              label="Authorized Person Phone"
              placeholder="+91 9876543210"
              value={authorizedPersonPhone}
              onChangeText={setAuthorizedPersonPhone}
              keyboardType="phone-pad"
              icon="call-outline"
            />
          </View>

          {/* Section 4: Security */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account Security</Text>

            <AppInput
              label="Password *"
              placeholder="Min 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />

            <AppInput
              label="Confirm Password *"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />
          </View>

          <AppButton
            title="Register Company"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            variant="primary"
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have a company account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  welcomeText: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
});
