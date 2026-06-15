import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { useAccessibilityStore } from '../../store/accessibility.store';
import { useTheme } from '../../hooks/useTheme';

export function SeniorModeToggle() {
  const { seniorMode, toggleSeniorMode } = useAccessibilityStore();
  const t = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleSeniorMode}
      accessibilityRole="switch"
      accessibilityLabel="Larger Fonts"
      accessibilityHint="Increases text size, button size, and contrast for easier reading"
      accessibilityState={{ checked: seniorMode }}
      style={{
        backgroundColor: seniorMode ? 'rgba(130,26,82,0.15)' : t.bgCard,
        borderRadius: t.radiusLg,
        borderWidth: 1,
        borderColor: seniorMode ? 'rgba(130,26,82,0.4)' : t.borderDefault,
        padding: t.cardPadding,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 20 }}>👁️</Text>
            <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
              Larger Fonts
            </Text>
            {seniorMode && (
              <View style={{
                backgroundColor: t.accentPrimary,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 }}>ON</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: t.fontSm, color: t.textSecondary, lineHeight: t.fontSm * t.lineHeightRelaxed }}>
            {seniorMode
              ? 'Large text, bigger buttons, higher contrast active'
              : 'Increase text size and button targets for easier use'}
          </Text>
        </View>
        <Switch
          value={seniorMode}
          onValueChange={toggleSeniorMode}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: t.accentPrimary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="rgba(255,255,255,0.15)"
        />
      </View>
    </TouchableOpacity>
  );
}
