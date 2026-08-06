import React from 'react';
import { TouchableOpacity, Text, TextInput, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../constants/Theme';

export const Button = ({ title, onPress, loading, variant = 'primary', style }) => {
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={[
        styles.button,
        isOutline ? styles.buttonOutline : styles.buttonPrimary,
        style
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? Colors.primary : Colors.text} />
      ) : (
        <Text style={[
          styles.buttonText,
          isOutline ? styles.buttonTextOutline : styles.buttonTextPrimary
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export const Input = ({ label, value, onChangeText, placeholder, secureTextEntry, error, autoCapitalize = 'none' }) => {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDim}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextOutline: {
    color: Colors.primary,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
    width: '100%',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 20,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
