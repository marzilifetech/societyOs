import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.msg}>
        {message ?? "Something didn't load. Please try again."}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.hint}>If the problem continues, please inform your supervisor.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 36, marginBottom: 12 },
  msg: { fontSize: 16, color: '#F5F5F7', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  btn: { backgroundColor: '#821A52', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginBottom: 16, minHeight: 48, justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
});
