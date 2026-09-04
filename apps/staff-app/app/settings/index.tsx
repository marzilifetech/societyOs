import type { ComponentProps } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@societyos/theme';
import i18nInstance from '../../src/lib/i18n';
import { useSettingsStore } from '../../src/store/settings.store';
import { AppHeader } from '../../src/components/ui';

type RowIcon = ComponentProps<typeof Ionicons>['name'];

export default function SettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { theme, largeText, dataSaver, biometricEnabled, setTheme, setLargeText, setDataSaver } = useSettingsStore();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title={t('settings.title')} />
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3 bg-gray-50 dark:bg-gray-950">
        <Group>
          <Row icon="notifications-outline" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications' as any)} />
          <Row icon="shield-checkmark-outline" label="Permissions" onPress={() => router.push('/settings/permissions' as any)} />
          <Row icon="globe-outline" label={t('settings.language')} onPress={() => router.push('/settings/language' as any)} />
        </Group>

        <Group>
          <SegmentedRow
            icon="moon-outline"
            label={t('settings.theme')}
            value={theme}
            options={[
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
              { value: 'system', label: t('settings.system') },
            ]}
            onChange={setTheme}
          />
          <ToggleRow icon="text-outline" label={t('settings.largeText')} value={largeText} onValueChange={setLargeText} />
          <ToggleRow
            icon="cellular-outline"
            label={t('settings.dataSaver')}
            value={dataSaver}
            onValueChange={setDataSaver}
            hint={t('settings.dataSaverHint')}
          />
          <Row
            icon="lock-closed-outline"
            label="Screen lock"
            onPress={() => router.push('/settings/security' as any)}
            value={biometricEnabled ? t('settings.on') : t('settings.off')}
          />
        </Group>

        <Group>
          <Row icon="help-circle-outline" label={t('settings.help')} onPress={() => router.push('/settings/help' as any)} />
          <Row icon="information-circle-outline" label={t('settings.about')} onPress={() => router.push('/settings/about' as any)} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-transparent dark:border-gray-800">
      {children}
    </View>
  );
}

function RowIconCircle({ icon }: { icon: RowIcon }) {
  return (
    <View className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mr-3">
      <Ionicons name={icon} size={16} color={colors.primary[500]} />
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  value,
}: {
  icon: RowIcon;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-5 py-4 flex-row items-center border-b border-gray-50 dark:border-gray-800"
    >
      <RowIconCircle icon={icon} />
      <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
      {value ? <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

/**
 * Row hosting a small segmented control. Used for settings with more than two
 * states, where a switch would silently collapse the third option.
 */
function SegmentedRow<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: RowIcon;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
      <View className="flex-row items-center mb-3">
        <RowIconCircle icon={icon} />
        <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
      </View>
      <View className="flex-row gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={o.label}
              className={`flex-1 py-2 rounded-xl items-center border ${
                active
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-transparent border-gray-200 dark:border-gray-700'
              }`}
            >
              <Text
                className={
                  active
                    ? 'text-white text-xs font-semibold'
                    : 'text-gray-700 dark:text-gray-200 text-xs'
                }
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  hint,
}: {
  icon: RowIcon;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      className="px-5 py-4 flex-row items-center border-b border-gray-50 dark:border-gray-800"
    >
      <RowIconCircle icon={icon} />
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
        {hint ? <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</Text> : null}
      </View>
      <View className={`w-11 h-6 rounded-full ${value ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'} px-0.5 justify-center`}>
        <View
          className={`w-5 h-5 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`}
          style={{ elevation: 2 }}
        />
      </View>
    </TouchableOpacity>
  );
}
