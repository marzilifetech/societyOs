import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { useTheme } from '../../src/hooks/useTheme';
import { ThemedText } from '../../src/components/ui';

interface Society {
  id: string;
  name: string;
  city: string;
}

const SUPPORT_PHONE = '+918047188888';

export default function SocietySelectScreen() {
  const t = useTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      <View style={{ flex: 1, paddingHorizontal: t.screenPadding, paddingTop: t.sectionGap * 1.5 }}>
        {/* Header */}
        <View style={{ marginBottom: t.sectionGap }}>
          <ThemedText variant="heading" accessibilityRole="header" style={{ marginBottom: 4 }}>
            Find your society
          </ThemedText>
          <ThemedText variant="body" color={t.textSecondary}>
            Search by name or city
          </ThemedText>
        </View>

        {/* Search input */}
        <View
          style={{
            backgroundColor: t.bgCard,
            borderRadius: t.radiusMd,
            borderWidth: 1,
            borderColor: t.borderDefault,
            paddingHorizontal: t.cardPadding,
            minHeight: t.touchTarget,
            justifyContent: 'center',
            marginBottom: t.sectionGap,
          }}
        >
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
              fontSize: t.fontBase,
              color: t.textPrimary,
              padding: 0,
            }}
          />
        </View>

        {/* Section label */}
        {!isLoading && count > 0 ? (
          <ThemedText
            variant="label"
            color={t.textMuted}
            style={{ marginBottom: 10, marginTop: 4 }}
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
            contentContainerStyle={{ paddingBottom: t.sectionGap * 2 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.city}`}
                accessibilityHint="Selects this society and continues to mobile number entry"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: t.bgCard,
                  borderRadius: t.radiusMd,
                  borderWidth: 1,
                  borderColor: t.borderSubtle,
                  paddingHorizontal: t.cardPadding,
                  paddingVertical: 14,
                  minHeight: t.touchTargetLg,
                }}
              >
                {/* Paper-design avatar — a flat square with a slight corner,
                    NOT a full circle. Clearly reads as a "label tile" for the
                    society. */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radiusMd, // 4px — barely rounded
                    backgroundColor: t.accentPrimary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <ThemedText
                    weight="bold"
                    color="#FFFFFF"
                    style={{ fontSize: t.fontLg, lineHeight: t.fontLg + 2 }}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>

                {/* Name + city stacked, name dominant */}
                <View style={{ flex: 1 }}>
                  <ThemedText
                    weight="semibold"
                    style={{ fontSize: t.fontLg, marginBottom: 2 }}
                  >
                    {item.name}
                  </ThemedText>
                  <ThemedText variant="caption" color={t.textSecondary}>
                    {item.city}
                  </ThemedText>
                </View>

                {/* Chevron — small, muted, clearly a "tap to continue" hint */}
                <ThemedText color={t.textMuted} style={{ fontSize: 22, marginLeft: 8 }}>
                  ›
                </ThemedText>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: 'center',
                  paddingHorizontal: t.cardPadding,
                  paddingVertical: t.sectionGap * 2,
                  backgroundColor: t.bgCard,
                  borderRadius: t.radiusMd,
                  borderWidth: 1,
                  borderColor: t.borderSubtle,
                }}
              >
                <ThemedText
                  variant="body"
                  weight="semibold"
                  style={{ textAlign: 'center', marginBottom: 4 }}
                >
                  No societies match &quot;{search}&quot;
                </ThemedText>
                <ThemedText variant="caption" color={t.textSecondary} style={{ textAlign: 'center' }}>
                  Try a different name or city
                </ThemedText>
              </View>
            }
          />
        )}

        {/* Bottom CTA: can't find your society */}
        <TouchableOpacity
          onPress={handleSupport}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Call support to add your society"
          accessibilityHint="Opens your phone app to call Marzi support"
          style={{
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: t.radiusMd,
            borderWidth: 1,
            borderColor: t.borderSubtle,
            backgroundColor: t.bgPrimary,
            marginTop: 8,
          }}
        >
          <ThemedText variant="body" weight="semibold" color={t.accentPrimary}>
            Can&apos;t find your society? Tap to call us
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
