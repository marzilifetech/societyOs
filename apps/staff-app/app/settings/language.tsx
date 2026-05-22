import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance, { SUPPORTED_LOCALES, setLocale, type AppLocale } from '../../src/lib/i18n';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation(undefined, { i18n: i18nInstance });
  const current = i18n.language as AppLocale;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('settings.language')}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5">
        <View className="bg-white rounded-2xl overflow-hidden">
          {SUPPORTED_LOCALES.map((l, idx) => (
            <TouchableOpacity
              key={l.code}
              onPress={async () => { await setLocale(l.code); }}
              className={`px-5 py-4 flex-row items-center justify-between ${idx < SUPPORTED_LOCALES.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <View>
                <Text className="text-sm font-semibold text-gray-900">{l.native}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{l.name}</Text>
              </View>
              {current === l.code ? (
                <Text className="text-primary-500 text-lg">✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
