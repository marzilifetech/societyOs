import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useSettingsStore } from '../../src/store/settings.store';

export default function SettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { theme, largeText, dataSaver, biometricEnabled, setTheme, setLargeText, setDataSaver } = useSettingsStore();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('settings.title')}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3 bg-gray-50 dark:bg-gray-950">
        <Group>
          <Row icon="🔔" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications' as any)} />
          <Row icon="🌐" label={t('settings.language')} onPress={() => router.push('/settings/language' as any)} />
        </Group>

        <Group>
          <ToggleRow
            icon="🌙"
            label={t('settings.theme')}
            value={theme === 'dark'}
            onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
            hint={theme === 'system' ? t('settings.system') : theme === 'dark' ? t('settings.dark') : t('settings.light')}
          />
          <ToggleRow icon="🔠" label={t('settings.largeText')} value={largeText} onValueChange={setLargeText} />
          <ToggleRow
            icon="📶"
            label={t('settings.dataSaver')}
            value={dataSaver}
            onValueChange={setDataSaver}
            hint={t('settings.dataSaverHint')}
          />
          <Row
            icon="🔒"
            label={t('settings.biometric')}
            onPress={() => router.push('/settings/notifications' as any)}
            value={biometricEnabled ? t('settings.on') : t('settings.off')}
          />
        </Group>

        <Group>
          <Row icon="❓" label={t('settings.help')} onPress={() => router.push('/settings/help' as any)} />
          <Row icon="ℹ️" label={t('settings.about')} onPress={() => router.push('/settings/about' as any)} />
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

function Row({
  icon,
  label,
  onPress,
  value,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-5 py-4 flex-row items-center border-b border-gray-50 dark:border-gray-800"
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
      {value ? <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">{value}</Text> : null}
      <Text className="text-gray-300 dark:text-gray-600 text-lg">›</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  hint,
}: {
  icon: string;
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
      <Text className="text-xl mr-3">{icon}</Text>
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
