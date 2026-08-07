import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import i18nInstance from '../../src/lib/i18n';
import { useSettingsStore } from '../../src/store/settings.store';
import { AppHeader, Card } from '../../src/components/ui';

/**
 * Biometric unlock + auto-lock.
 *
 * These previously lived at the bottom of Settings → Notifications, which is
 * also where the Settings list's "Biometric" row pointed. Two unrelated
 * concerns on one screen meant a staff member looking for the screen lock had
 * to scroll past every notification toggle to find it.
 */
const AUTO_LOCK_OPTIONS = [1, 5, 15, 60];

export default function SecuritySettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const { biometricEnabled, setBiometricEnabled, autoLockMinutes, setAutoLockMinutes } =
    useSettingsStore();

  const handleBiometricToggle = async (v: boolean) => {
    if (v) {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!has || !enrolled) {
        Alert.alert(
          'Not available',
          'No fingerprint or face unlock is set up on this phone. Add one in your phone settings first.',
        );
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Screen lock" subtitle="Keep your shift data private" />

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4 pb-10">
        <Card padding="none" className="overflow-hidden">
          <TouchableOpacity
            onPress={() => handleBiometricToggle(!biometricEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: biometricEnabled }}
            accessibilityLabel={t('settings.biometric')}
            className="px-5 py-4 flex-row items-center"
          >
            <View className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/50 items-center justify-center mr-3">
              <Ionicons name="finger-print" size={16} color="#821A52" />
            </View>
            <View className="flex-1 pr-3">
              <Text className="font-heading text-sm text-gray-900 dark:text-gray-100">
                {t('settings.biometric')}
              </Text>
              <Text className="font-body text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Unlock with your fingerprint or face instead of a PIN
              </Text>
            </View>
            <View
              className={`w-11 h-6 rounded-full ${
                biometricEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              } px-0.5 justify-center`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${
                  biometricEnabled ? 'self-end' : 'self-start'
                }`}
                style={{ elevation: 2 }}
              />
            </View>
          </TouchableOpacity>
        </Card>

        <View>
          <Text className="text-xs font-heading text-gray-500 dark:text-gray-400 uppercase mb-2 px-1">
            Lock after
          </Text>
          <Card padding="lg">
            <Text className="font-body text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ask for the PIN or fingerprint when the app has been in the background this long.
            </Text>
            <View className="flex-row gap-2">
              {AUTO_LOCK_OPTIONS.map((m) => {
                const active = autoLockMinutes === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setAutoLockMinutes(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={m === 60 ? '1 hour' : `${m} minutes`}
                    className={`flex-1 py-2.5 rounded-xl items-center border ${
                      active
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-transparent border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Text
                      className={
                        active
                          ? 'text-white font-heading text-sm'
                          : 'text-gray-700 dark:text-gray-200 font-body text-sm'
                      }
                    >
                      {m === 60 ? '1h' : `${m}m`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
