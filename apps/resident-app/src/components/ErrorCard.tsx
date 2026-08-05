import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { RoundCard, IconCircle, PillButton, rd } from './ui';

interface Props {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorCard({ message, onRetry, retryLabel = 'Try Again' }: Props) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <RoundCard padding={t.cardPaddingLg} style={{ width: '100%', alignItems: 'center' }}>
        <IconCircle icon="alert-circle" size={56} bg={rd.crimsonSoft} color={rd.crimson} />
        <Text
          style={{
            fontSize: t.fontBase,
            color: t.textPrimary,
            textAlign: 'center',
            lineHeight: t.fontBase * t.lineHeightRelaxed,
            marginTop: 16,
          }}
        >
          {message ?? "Something didn't load. Please try again — your information is safe."}
        </Text>
        {onRetry && (
          <PillButton
            label={retryLabel}
            onPress={onRetry}
            tone="dark"
            size="md"
            style={{ marginTop: 20 }}
          />
        )}
        <Text
          style={{
            fontSize: t.fontSm,
            color: t.textMuted,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          If this keeps happening, please contact the society office.
        </Text>
      </RoundCard>
    </View>
  );
}
