import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { ThemedText } from '../../src/components/ui';
import { APP_VERSION_LABEL } from '../../src/lib/app-version';

interface Society {
  id: string;
  name: string;
  city: string;
}

const SUPPORT_PHONE = '+918047188888';

// Soft brand tint for avatars / icon chips (accentPrimary #821A52 @ ~8%).
const BRAND_SOFT = 'rgba(130,26,82,0.08)';

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

export default function SocietySelectScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: societies, isLoading } = useQuery<Society[]>({
    queryKey: ['societies'],
    queryFn: () => api.get<Society[]>('/societies'),
  });

  const filtered = societies?.filter(
    (s: Society) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()),
  );
  const count = filtered?.length ?? 0;

  const handleSelect = (society: Society) => {
    router.push({
      pathname: '/(auth)/phone-entry',
      params: { societyId: society.id, societyName: society.name },
    });
  };

  const handleSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Alert.alert('Support', `Please call ${SUPPORT_PHONE} to get your society added.`);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      {/* Dark maroon header → light status-bar icons */}
      <StatusBar style="light" />

      {/* Branded gradient hero — full-bleed under the status bar, rounded base. */}
      <LinearGradient
        colors={['#9B2765', '#821A52', '#6E0043']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 24,
          paddingBottom: 52,
          paddingHorizontal: t.screenPadding,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name="business" size={26} color="#FFFFFF" />
        </View>
        <ThemedText
          variant="heading"
          accessibilityRole="header"
          color="#FFFFFF"
          style={{ marginBottom: 6 }}
        >
          Find your society
        </ThemedText>
        <ThemedText variant="body" color="rgba(255,255,255,0.82)">
          Search by name or city to get started
        </ThemedText>
      </LinearGradient>

      {/* Floating search pill — overlaps the gradient's rounded base. */}
      <View
        style={{
          paddingHorizontal: t.screenPadding,
          marginTop: -26,
          marginBottom: t.sectionGap,
        }}
      >
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.bgPrimary,
              borderRadius: t.radiusLg,
              paddingHorizontal: 16,
              minHeight: t.touchTargetLg,
            },
            cardShadow,
            { shadowOpacity: 0.1, shadowRadius: 14, elevation: 5 },
          ]}
        >
          <Ionicons name="search" size={20} color={t.accentPrimary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search societies"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Search societies"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{
              flex: 1,
              fontSize: t.fontBase,
              color: t.textPrimary,
              paddingVertical: 0,
              marginLeft: 10,
            }}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={t.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Section label */}
      {!isLoading && count > 0 ? (
        <ThemedText
          variant="label"
          color={t.textMuted}
          style={{ marginBottom: 10, paddingHorizontal: t.screenPadding }}
        >
          {count === 1 ? '1 society' : `${count} societies`}
        </ThemedText>
      ) : null}

      {isLoading ? (
        <View style={{ alignItems: 'center', paddingTop: t.sectionGap * 2 }}>
          <ActivityIndicator color={t.accentPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Memory/perf: keep only rows near the viewport mounted. A society
          // list can be long; windowing avoids holding every row in memory.
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={{
            paddingHorizontal: t.screenPadding,
            paddingBottom: t.sectionGap,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.city}`}
              accessibilityHint="Selects this society and continues to mobile number entry"
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: t.bgPrimary,
                  borderRadius: t.radiusLg,
                  paddingHorizontal: t.cardPadding,
                  paddingVertical: 14,
                  minHeight: t.touchTargetLg,
                },
                cardShadow,
              ]}
            >
              {/* Rounded-square avatar with soft brand tint + initial. */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: t.radiusMd,
                  backgroundColor: BRAND_SOFT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <ThemedText
                  weight="bold"
                  color={t.accentPrimary}
                  style={{ fontSize: t.fontXl, lineHeight: t.fontXl + 2 }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>

              {/* Name + city (city with a location pin) */}
              <View style={{ flex: 1 }}>
                <ThemedText
                  weight="semibold"
                  style={{ fontSize: t.fontLg, marginBottom: 3 }}
                >
                  {item.name}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={t.textMuted}
                    style={{ marginRight: 3 }}
                  />
                  <ThemedText variant="caption" color={t.textSecondary}>
                    {item.city}
                  </ThemedText>
                </View>
              </View>

              {/* Chevron in a soft circle — clear "tap to continue" affordance. */}
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: BRAND_SOFT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={t.accentPrimary} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View
              style={[
                {
                  alignItems: 'center',
                  paddingHorizontal: t.cardPadding,
                  paddingVertical: t.sectionGap * 2,
                  backgroundColor: t.bgPrimary,
                  borderRadius: t.radiusLg,
                },
                cardShadow,
              ]}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: BRAND_SOFT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Ionicons
                  name={search.trim().length > 0 ? 'search' : 'business-outline'}
                  size={26}
                  color={t.accentPrimary}
                />
              </View>
              <ThemedText
                variant="body"
                weight="semibold"
                style={{ textAlign: 'center', marginBottom: 4 }}
              >
                {search.trim().length > 0
                  ? `No societies match “${search}”`
                  : 'No societies available yet'}
              </ThemedText>
              <ThemedText variant="caption" color={t.textSecondary} style={{ textAlign: 'center' }}>
                {search.trim().length > 0
                  ? 'Try a different name or city'
                  : 'Your society will appear here once it’s added. Tap “Call us” below to get it listed.'}
              </ThemedText>
            </View>
          }
        />
      )}

      {/* Bottom CTA: can't find your society */}
      <View
        style={{
          paddingHorizontal: t.screenPadding,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <TouchableOpacity
          onPress={handleSupport}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Call support to add your society"
          accessibilityHint="Opens your phone app to call Marzi support"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 15,
            borderRadius: t.radiusLg,
            backgroundColor: BRAND_SOFT,
          }}
        >
          <Ionicons
            name="call-outline"
            size={18}
            color={t.accentPrimary}
            style={{ marginRight: 8 }}
          />
          <ThemedText variant="body" weight="semibold" color={t.accentPrimary}>
            Can&apos;t find your society? Call us
          </ThemedText>
        </TouchableOpacity>

        {/* App version — subtle, centered. */}
        <ThemedText
          variant="caption"
          color={t.textMuted}
          style={{ textAlign: 'center', marginTop: 12 }}
        >
          {APP_VERSION_LABEL}
        </ThemedText>
      </View>
    </View>
  );
}
