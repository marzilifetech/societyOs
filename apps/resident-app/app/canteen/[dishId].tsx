import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Review = {
  id: string;
  rating: number;
  comment?: string;
  residentName: string;
  createdAt: string;
};

type DishDetail = {
  id: string;
  name: string;
  description?: string;
  isVeg: boolean;
  price: number;
  calories?: number;
  allergens?: string[];
  avgRating?: number;
  ratingCount?: number;
  reviews?: Review[];
  // Figma V2 fields — may not exist yet in API
  dietType?: 'VEG' | 'NON_VEG' | 'EGG';
  imageUrl?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

type DietKind = 'VEG' | 'NON_VEG' | 'EGG';

function resolveDiet(dish: DishDetail): DietKind {
  if (dish.dietType) return dish.dietType;
  return dish.isVeg ? 'VEG' : 'NON_VEG';
}

const DIET_CONFIG: Record<DietKind, { label: string; bg: string; fg: string; icon: string }> = {
  VEG: { label: 'Veg', bg: rd.greenSoft, fg: rd.green, icon: '●' },
  EGG: { label: 'Egg', bg: rd.amberSoft, fg: rd.amberInk, icon: '●' },
  NON_VEG: { label: 'Non Veg', bg: rd.crimsonSoft, fg: rd.crimson, icon: '▲' },
};

function DietTag({ dish }: { dish: DishDetail }) {
  const t = useTheme();
  const kind = resolveDiet(dish);
  const cfg = DIET_CONFIG[kind];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: cfg.bg,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text style={{ fontSize: 8, color: cfg.fg }}>{cfg.icon}</Text>
      <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: cfg.fg }}>{cfg.label}</Text>
    </View>
  );
}

function AllergenChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: rd.inkSoft,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>{label}</Text>
    </View>
  );
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={s <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DishDetailScreen() {
  const t = useTheme();
  const { dishId } = useLocalSearchParams<{ dishId: string }>();

  const { data: dish, isLoading, isError, refetch } = useQuery<DishDetail>({
    queryKey: ['dish', dishId],
    queryFn: () => api.get<DishDetail>(`/canteen/dishes/${dishId}`),
    enabled: !!dishId,
  });

  const canRate = true;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title={dish?.name ?? 'Dish Detail'} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <IconCircle icon="alert-circle-outline" size={64} bg={rd.crimsonSoft} color={rd.crimson} style={{ marginBottom: 16 }} />
          <Display size="sm" align="center">Failed to load</Display>
          <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>
            Could not fetch dish details.
          </Text>
          <PillButton label="Retry" tone="dark" fullWidth={false} onPress={() => refetch()} style={{ paddingHorizontal: 32 }} />
        </View>
      ) : dish ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingTop: 16, paddingBottom: 32 }}
          >
            {/* Hero image or placeholder */}
            {dish.imageUrl ? (
              <Image
                source={{ uri: dish.imageUrl }}
                style={{ width: '100%', height: 220, borderRadius: rd.radiusCard, marginBottom: 20 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: rd.radiusCard,
                  backgroundColor: rd.inkSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Ionicons name="restaurant-outline" size={52} color="rgba(0,0,0,0.18)" />
              </View>
            )}

            {/* Dish name + diet tag */}
            <Display size="md" style={{ marginBottom: 6 }}>{dish.name}</Display>

            {/* Kcal + diet tag row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {dish.calories ? (
                <Text style={{ fontSize: t.fontSm, color: t.textMuted }}>{dish.calories} kcal</Text>
              ) : null}
              <DietTag dish={dish} />
            </View>

            {/* Description */}
            {dish.description ? (
              <Text
                style={{
                  fontSize: t.fontBase,
                  color: t.textSecondary,
                  lineHeight: t.fontBase * 1.55,
                  marginBottom: 16,
                }}
              >
                {dish.description}
              </Text>
            ) : null}

            {/* Allergen chips */}
            {dish.allergens?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {dish.allergens.map((a) => (
                  <AllergenChip key={a} label={`Contains ${a}`} />
                ))}
              </View>
            ) : null}

            {/* Price */}
            <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: t.fontBase, color: t.textSecondary }}>Price</Text>
                <Text style={{ fontSize: t.fontLg, fontWeight: '700', color: t.textPrimary }}>
                  ₹{dish.price}
                </Text>
              </View>
            </RoundCard>

            {/* Rating */}
            {dish.avgRating != null ? (
              <RoundCard tone="white" padding={t.cardPaddingLg} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginBottom: 12 }}>
                  Rating
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      backgroundColor: rd.amberSoft,
                      borderRadius: rd.radiusCard,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: t.font3xl, fontWeight: '700', color: rd.amberInk }}>
                      {dish.avgRating.toFixed(1)}
                    </Text>
                  </View>
                  <View>
                    <StarRow rating={dish.avgRating} size={18} />
                    <Text style={{ fontSize: t.fontXs, color: t.textMuted, marginTop: 4 }}>
                      {dish.ratingCount ?? 0} ratings
                    </Text>
                  </View>
                </View>
              </RoundCard>
            ) : null}

            {/* Reviews */}
            {dish.reviews?.length ? (
              <View style={{ marginBottom: 8 }}>
                <Display size="sm" style={{ marginBottom: 12 }}>Recent Reviews</Display>
                {dish.reviews.map((r) => (
                  <RoundCard key={r.id} tone="white" padding={t.cardPadding} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary }}>
                        {r.residentName}
                      </Text>
                      <StarRow rating={r.rating} size={14} />
                    </View>
                    {r.comment ? (
                      <Text style={{ fontSize: t.fontSm, color: t.textSecondary, lineHeight: t.fontSm * 1.5 }}>
                        {r.comment}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <Ionicons name="calendar-outline" size={11} color={t.textMuted} />
                      <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </RoundCard>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Footer CTA */}
          <SafeAreaView
            edges={['bottom']}
            style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: rd.cardBorder }}
          >
            <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
              <PillButton
                label="Pre-Order This Dish"
                tone="dark"
                icon="bag-handle-outline"
                onPress={() => router.push({ pathname: '/canteen/pre-order', params: { dishId: dish.id } } as any)}
              />
              {canRate ? (
                <PillButton
                  label="Rate This Dish"
                  tone="ghost"
                  icon="star-outline"
                  textColor={t.accentPrimary}
                  onPress={() => router.push({ pathname: '/canteen/rate', params: { dishId } } as any)}
                />
              ) : null}
            </View>
          </SafeAreaView>
        </>
      ) : null}
    </View>
  );
}
