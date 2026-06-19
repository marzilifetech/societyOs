import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader, Display, PillButton, IconCircle, rd } from './ui';

type Props = {
  title: string;
  message?: string;
};

export function ComingSoonScreen({
  title,
  message = "This feature isn't available in your community yet. We're working on bringing it to you soon.",
}: Props) {
  const t = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title={title} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <IconCircle icon="time-outline" size={72} bg={rd.inkSoft} color={t.textMuted} style={{ marginBottom: 20 }} />
        <Display size="md" align="center">Coming Soon</Display>
        <Text
          style={{
            textAlign: 'center',
            color: t.textMuted,
            fontSize: t.fontBase,
            marginTop: 12,
            lineHeight: t.fontBase * 1.5,
          }}
        >
          {message}
        </Text>
        <View style={{ marginTop: 28, width: '100%' }}>
          <PillButton label="Back to Home" tone="dark" onPress={() => router.replace('/(tabs)' as any)} />
        </View>
      </View>
    </View>
  );
}
