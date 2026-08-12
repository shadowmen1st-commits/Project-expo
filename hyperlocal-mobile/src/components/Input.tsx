import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Platform } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const webOutlineStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } as any) : {};

export const Input: React.FC<InputProps> = ({ label, error, icon, style, ...rest }) => {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, webOutlineStyle, error ? styles.inputError : null]}>
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        <TextInput
          style={[styles.input, webOutlineStyle, style]}
          placeholderTextColor="#94A3B8"
          {...rest}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48
  },
  inputError: {
    borderColor: '#EF4444'
  },
  iconContainer: {
    marginRight: 8
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500'
  }
});

export default Input;
