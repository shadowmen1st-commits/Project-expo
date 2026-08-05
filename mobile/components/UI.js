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
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDim}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextPrimary: {
    color: Colors.text,
  },
  buttonTextOutline: {
    color: Colors.primary,
  },
  inputContainer: {
    marginBottom: Spacing.md,
    width: '100%',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  input: {
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});
