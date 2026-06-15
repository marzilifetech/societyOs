import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  IconCircle,
  rd,
} from '../../src/components/ui';

// ── Star selector ──────────────────────────────────────────────────────────────

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${s} star${s > 1 ? 's' : ''}, ${STAR_LABELS[s]}`}
            style={{
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={s <= value ? 'star' : 'star-outline'}
              size={44}
              color={s <= value ? '#F59E0B' : rd.cardBorder}
            />
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 ? (
        <Text
          style={{
            textAlign: 'center',
            fontSize: t.fontBase,
            fontWeight: '600',
            color: '#F59E0B',
          }}
        >
          {STAR_LABELS[value]}
        </Text>
      ) : (
        <Text style={{ textAlign: 'center', fontSize: t.fontSm, color: t.textMuted }}>
          Tap a star to rate
        </Text>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RateDishScreen() {
  const t = useTheme();
  const { dishId } = useLocalSearchParams<{ dishId: string }>();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post(`/canteen/dishes/${dishId}/rate`, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dish', dishId] });
      setSubmitted(true);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScreenHeader title="Rate Dish" onBack={null} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.screenPadding }}>
          <IconCircle size={80} bg={rd.amberSoft} style={{ marginBottom: 24 }}>
            <Ionicons name="star" size={44} color="#F59E0B" />
          </IconCircle>
          <Display size="md" align="center" style={{ marginBottom: 10 }}>
            Thanks for Rating!
          </Display>
          <Text
            style={{
              fontSize: t.fontBase,
              color: t.textMuted,
              textAlign: 'center',
              lineHeight: t.fontBase * 1.55,
              marginBottom: 32,
            }}
          >
            Your feedback helps improve the canteen menu.
          </Text>
          <PillButton label="Done" tone="dark" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ── Rating form ───────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Rate Dish" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 24, paddingBottom: 40 }}
      >
        {/* Header */}
        <Display size="md" align="center" style={{ marginBottom: 6 }}>
          How was it?
        </Display>
        <Text
          style={{
            textAlign: 'center',
            fontSize: t.fontBase,
            color: t.textMuted,
            marginBottom: 32,
          }}
        >
          Rate your experience with this dish
        </Text>

        {/* Stars */}
        <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 20 }}>
          <StarSelector value={rating} onChange={setRating} />
        </RoundCard>

        {/* Comment */}
        <Text
          style={{
            fontSize: t.fontBase,
            fontWeight: '700',
            color: t.textPrimary,
            marginBottom: 8,
          }}
        >
          Your Review{' '}
          <Text style={{ fontSize: t.fontSm, fontWeight: '400', color: t.textMuted }}>(optional)</Text>
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Share your experience..."
          placeholderTextColor={t.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={500}
          style={{
            minHeight: 120,
            borderRadius: rd.radiusInput,
            borderWidth: 1,
            borderColor: rd.cardBorder,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: t.fontBase,
            color: t.textPrimary,
            marginBottom: 32,
          }}
        />

        <PillButton
          label="Submit Rating"
          tone="dark"
          icon="checkmark-circle-outline"
          disabled={rating === 0}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </View>
  );
}
