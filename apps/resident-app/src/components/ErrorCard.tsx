import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorCard({ message, onRetry, retryLabel = 'Try Again' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>
        {message ?? "Something didn't load. Please try again — your information is safe."}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.hint}>If this keeps happening, please contact the society office.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 40, marginBottom: 16 },
  message: { fontSize: 16, color: '#F5F5F7', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  button: { backgroundColor: '#821A52', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 4, marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
});
