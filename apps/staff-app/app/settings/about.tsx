import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.expoConfig?.runtimeVersion ?? 'dev';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('settings.about')}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3">
        <View className="bg-white rounded-2xl p-6 items-center">
          <Text className="text-5xl mb-2">🏢</Text>
          <Text className="text-lg font-bold text-gray-900">SocietyOS Staff</Text>
          <Text className="text-sm text-gray-500 mt-1">Version {version} ({String(build)})</Text>
        </View>
        <View className="bg-white rounded-2xl overflow-hidden">
          <Link label="Terms of Service" url="https://societyos.app/terms" />
          <Link label="Privacy Policy" url="https://societyos.app/privacy" />
          <Link label="Open Source Licences" url="https://societyos.app/licences" last />
        </View>
        <Text className="text-xs text-gray-400 text-center mt-4">
          © {new Date().getFullYear()} SocietyOS. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Link({ label, url, last }: { label: string; url: string; last?: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url).catch(() => {})}
      className={`px-5 py-4 flex-row items-center justify-between ${!last ? 'border-b border-gray-50' : ''}`}
    >
      <Text className="text-sm font-medium text-gray-900">{label}</Text>
      <Text className="text-gray-300 text-lg">›</Text>
    </TouchableOpacity>
  );
}
