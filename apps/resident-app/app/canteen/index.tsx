import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import {
  ScreenHeader,
  Display,
  RoundCard,
  PillButton,
  SegmentedTabs,
  rd,
} from '../../src/components/ui';

// ── Types ──────────────────────────────────────────────────────────────────────

type Dish = {
  id: string;
  name: string;
  isVeg: boolean;
  price: number;
  calories?: number;
  allergens?: string[];
  rating?: number;
  ratingCount?: number;
  // Figma V2 fields — may not exist yet in API; render gracefully
  description?: string;
  dietType?: 'VEG' | 'NON_VEG' | 'EGG'; // preferred over isVeg bool
  imageUrl?: string;
};

type Menu = {
  id: string;
  date: string;
  mealType: string;
  dishes?: Dish[];
};

// ── Constants ──────────────────────────────────────────────────────────────────

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  SNACKS: 'Snacks',
  DINNER: 'Dinner',
};

const MEAL_TIMES: Record<MealType, string> = {
  BREAKFAST: '07:00 AM - 09:30 AM',
  LUNCH: '01:00 PM - 03:30 PM',
  SNACKS: '05:00 PM - 06:30 PM',
  DINNER: '07:00 PM - 10:30 PM',
};

// ── Diet tag helpers ──────────────────────────────────────────────────────────

type DietKind = 'VEG' | 'NON_VEG' | 'EGG';

function resolveDiet(dish: Dish): DietKind {
  if (dish.dietType) return dish.dietType;
  return dish.isVeg ? 'VEG' : 'NON_VEG';
}

const DIET_CONFIG: Record<DietKind, { label: string; bg: string; fg: string; icon: string }> = {
  VEG: { label: 'Veg', bg: rd.greenSoft, fg: rd.green, icon: '●' },
  EGG: { label: 'Egg', bg: rd.amberSoft, fg: rd.amberInk, icon: '●' },
  NON_VEG: { label: 'Non Veg', bg: rd.crimsonSoft, fg: rd.crimson, icon: '▲' },
};

function DietTag({ dish }: { dish: Dish }) {
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
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 8, color: cfg.fg }}>{cfg.icon}</Text>
      <Text style={{ fontSize: t.fontXs, fontWeight: '700', color: cfg.fg }}>{cfg.label}</Text>
    </View>
  );
}

// ── Allergen / info chip ───────────────────────────────────────────────────────

function AllergenChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: rd.inkSoft,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: t.fontXs, color: t.textSecondary }}>{label}</Text>
    </View>
  );
}

// ── Add button ────────────────────────────────────────────────────────────────

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Add dish"
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: rd.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="add" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

// ── Dish thumbnail ────────────────────────────────────────────────────────────

function DishThumb({ uri }: { uri?: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 64, height: 64, borderRadius: 12 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: rd.inkSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="restaurant-outline" size={28} color="rgba(0,0,0,0.25)" />
    </View>
  );
}

// ── Dish row (V2 detailed) ────────────────────────────────────────────────────

function DishRow({ dish, onPress }: { dish: Dish; onPress: () => void }) {
  const t = useTheme();
  const allergenLabels: string[] = (dish.allergens ?? []).map((a) => `Contains ${a}`);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dish.name}${dish.calories ? `, ${dish.calories} kcal` : ''}, ${resolveDiet(dish) === 'VEG' ? 'Vegetarian' : resolveDiet(dish) === 'EGG' ? 'Egg' : 'Non Vegetarian'}`}
    >
      <RoundCard tone="white" padding={14} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* Thumbnail */}
          <DishThumb uri={dish.imageUrl} />

          {/* Content */}
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontSize: t.fontBase, fontWeight: '700', color: t.textPrimary, marginRight: 8 }}
              >
                {dish.name}
              </Text>
              <AddButton onPress={onPress} />
            </View>

            {/* Kcal */}
            {dish.calories ? (
              <Text style={{ fontSize: t.fontSm, color: t.textMuted, marginTop: 2 }}>
                {dish.calories} kcal
              </Text>
            ) : null}

            {/* Description (V2) */}
            {dish.description ? (
              <Text
                numberOfLines={2}
                style={{ fontSize: t.fontSm, color: t.textSecondary, marginTop: 4, lineHeight: t.fontSm * 1.45 }}
              >
                {dish.description}
              </Text>
            ) : null}

            {/* Diet tag + allergen chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <DietTag dish={dish} />
              {allergenLabels.map((label) => (
                <AllergenChip key={label} label={label} />
              ))}
            </View>
          </View>
        </View>
      </RoundCard>
    </TouchableOpacity>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ meal, count }: { meal: MealType; count: number }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 24, marginBottom: 12 }}>
      <Display size="sm" style={{ color: t.accentPrimary }}>
        {MEAL_LABELS[meal]}
      </Display>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Ionicons name="time-outline" size={13} color={t.textMuted} />
        <Text style={{ fontSize: t.fontXs, color: t.textMuted }}>
          {MEAL_TIMES[meal]} • {count} Dish{count !== 1 ? 'es' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CanteenScreen() {
  const t = useTheme();
  const [selectedMeal, setSelectedMeal] = useState<MealType>('BREAKFAST');
  const [refreshing, setRefreshing] = useState(false);
  const sectionRefs = useRef<Record<MealType, number>>({} as any);
  const scrollRef = useRef<ScrollView>(null);

  const { data: menus, isLoading, isError, refetch } = useQuery<Menu[]>({
    queryKey: ['canteen-menu'],
    queryFn: () => api.get<Menu[]>('/canteen/menu'),
  });

  const today = new Date().toLocaleDateString('en-CA');

  // Group dishes by meal type for today
  const dishesPerMeal: Record<MealType, Dish[]> = {
    BREAKFAST: [],
    LUNCH: [],
    SNACKS: [],
    DINNER: [],
  };

  (menus ?? []).forEach((m) => {
    if (m.date?.startsWith(today) && m.mealType in dishesPerMeal) {
      const mt = m.mealType as MealType;
      dishesPerMeal[mt] = [...dishesPerMeal[mt], ...(m.dishes ?? [])];
    }
  });

  const tabOptions = MEAL_TYPES.map((mt) => ({ key: mt, label: MEAL_LABELS[mt] }));

  const handleTabChange = (mt: MealType) => {
    setSelectedMeal(mt);
    const y = sectionRefs.current[mt];
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  };

  const preorderBtn = (
    <TouchableOpacity
      onPress={() => router.push('/canteen/pre-order' as any)}
      accessibilityRole="button"
      accessibilityLabel="Pre-order"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: rd.ink,
        borderRadius: rd.radiusPill,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <Ionicons name="bag-handle-outline" size={16} color="#FFFFFF" />
      <Text style={{ fontSize: t.fontSm, fontWeight: '700', color: '#FFFFFF' }}>Pre-Order</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScreenHeader title="Canteen" trailing={preorderBtn} />

      {/* Sticky meal tabs */}
      <View style={{ paddingHorizontal: t.screenPadding, paddingTop: 4, paddingBottom: 10 }}>
        {/* "Today's Menu" serif display */}
        <Display size="md" style={{ marginBottom: 14 }}>Today's Menu</Display>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -t.screenPadding, paddingHorizontal: t.screenPadding }}>
          <SegmentedTabs
            options={tabOptions}
            value={selectedMeal}
            onChange={handleTabChange}
          />
        </ScrollView>
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Display size="sm" align="center">Failed to load menu</Display>
          <Text style={{ color: t.textMuted, fontSize: t.fontSm, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>
            Check your connection and try again.
          </Text>
          <PillButton label="Retry" tone="dark" fullWidth={false} onPress={() => refetch()} style={{ paddingHorizontal: 32 }} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
              tintColor={t.accentPrimary}
            />
          }
          contentContainerStyle={{ paddingHorizontal: t.screenPadding, paddingBottom: 40 }}
        >
          {MEAL_TYPES.map((mt) => {
            const dishes = dishesPerMeal[mt];
            return (
              <View
                key={mt}
                onLayout={(e) => { sectionRefs.current[mt] = e.nativeEvent.layout.y; }}
              >
                <SectionHeader meal={mt} count={dishes.length} />
                {dishes.length === 0 ? (
                  <RoundCard tone="gray" padding={t.cardPaddingLg} style={{ marginBottom: 4 }}>
                    <Text style={{ color: t.textMuted, fontSize: t.fontSm, textAlign: 'center' }}>
                      No {MEAL_LABELS[mt].toLowerCase()} items today
                    </Text>
                  </RoundCard>
                ) : (
                  dishes.map((dish) => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      onPress={() => router.push(`/canteen/${dish.id}` as any)}
                    />
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
