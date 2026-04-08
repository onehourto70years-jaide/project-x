import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FormFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: string;
  touched?: boolean;
}

/**
 * Reusable form field with inline error display.
 * Shows a red border + error message below the input when validation fails.
 */
export default function FormField({ label, error, icon, touched, style, ...inputProps }: FormFieldProps) {
  const showError = touched && !!error;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, showError && styles.inputWrapperError]}>
        {icon ? (
          <Ionicons name={icon as any} size={18} color={showError ? '#ff6b6b' : '#666'} style={styles.icon} />
        ) : null}
        <TextInput
          {...inputProps}
          style={[styles.input, icon ? { paddingLeft: 0 } : null, style]}
          placeholderTextColor={inputProps.placeholderTextColor || '#555'}
          accessibilityLabel={label || inputProps.placeholder}
        />
      </View>
      {showError ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
  },
  inputWrapperError: { borderColor: '#ff6b6b' },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, paddingLeft: 4 },
  errorText: { color: '#ff6b6b', fontSize: 12, fontWeight: '500', marginLeft: 4 },
});
