import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useSettingsStore, type NotificationPrefs } from '../../src/store/settings.store';

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const {
    notifications,
    setNotificationPref,
    biometricEnabled,
    setBiometricEnabled,
    autoLockMinutes,
    setAutoLockMinutes,
  } = useSettingsStore();

  const handleBiometricToggle = async (v: boolean) => {
    if (v) {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) {
        Alert.alert('Not available', 'No biometric is enrolled on this device.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
      });
      if (!result.success) return;
    }
    await setBiometricEnabled(v);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="bg-primary-500 px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold ml-2">{t('settings.notifications')}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3">
        <View className="bg-white rounded-2xl overflow-hidden">
          <Toggle label={t('settings.tasks')} value={notifications.tasks} onChange={(v) => setNotificationPref('tasks', v)} />
          <Toggle label={t('settings.reviews')} value={notifications.reviews} onChange={(v) => setNotificationPref('reviews', v)} />
          <Toggle label={t('settings.leave')} value={notifications.leave} onChange={(v) => setNotificationPref('leave', v)} />
          <Toggle label={t('settings.announcements')} value={notifications.announcements} onChange={(v) => setNotificationPref('announcements', v)} />
          <Toggle label={t('settings.helpRequests')} value={notifications.helpRequests} onChange={(v) => setNotificationPref('helpRequests', v)} last />
        </View>

        <Text className="text-xs font-semibold text-gray-500 uppercase mt-3 px-2">Security</Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <Toggle label={t('settings.biometric')} value={biometricEnabled} onChange={handleBiometricToggle} />
          <View className="px-5 py-4">
            <Text className="text-sm font-medium text-gray-900 mb-2">Auto-lock</Text>
            <View className="flex-row gap-2">
              {[1, 5, 15, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setAutoLockMinutes(m)}
                  className={`px-3 py-1.5 rounded-full border ${autoLockMinutes === m ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200'}`}
                >
                  <Text className={autoLockMinutes === m ? 'text-white text-xs font-semibold' : 'text-gray-700 text-xs'}>
                    {m === 60 ? '1h' : `${m}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Toggle({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      className={`px-5 py-4 flex-row items-center justify-between ${!last ? 'border-b border-gray-50' : ''}`}
    >
      <Text className="text-sm font-medium text-gray-900">{label}</Text>
      <View className={`w-11 h-6 rounded-full ${value ? 'bg-primary-500' : 'bg-gray-300'} px-0.5 justify-center`}>
        <View className={`w-5 h-5 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`} style={{ elevation: 2 }} />
      </View>
    </TouchableOpacity>
  );
}
