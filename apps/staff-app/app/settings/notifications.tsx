import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import i18nInstance from '../../src/lib/i18n';
import { useSettingsStore } from '../../src/store/settings.store';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreference,
} from '../../src/lib/notifications';

const PREFS_KEY = ['notification-preferences'];

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation(undefined, { i18n: i18nInstance });
  const queryClient = useQueryClient();
  const { biometricEnabled, setBiometricEnabled, autoLockMinutes, setAutoLockMinutes } =
    useSettingsStore();

  const { data: prefs, isLoading, isError, refetch } = useQuery({
    queryKey: PREFS_KEY,
    queryFn: fetchNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: (next: NotificationPreference) =>
      updateNotificationPreferences([{ category: next.key, enabled: next.enabled }]),
    // Optimistic toggle — flip locally, roll back on failure.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: PREFS_KEY });
      const prev = queryClient.getQueryData<NotificationPreference[]>(PREFS_KEY);
      queryClient.setQueryData<NotificationPreference[]>(PREFS_KEY, (cur) =>
        (cur ?? []).map((p) => (p.key === next.key ? { ...p, enabled: next.enabled } : p)),
      );
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(PREFS_KEY, ctx.prev);
      Alert.alert(t('common.error'), t('settings.notificationUpdateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });

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
          {isLoading ? (
            <View className="px-5 py-8 items-center">
              <ActivityIndicator color="#821A52" />
            </View>
          ) : isError ? (
            <TouchableOpacity className="px-5 py-8 items-center" onPress={() => refetch()}>
              <Text className="text-sm text-gray-500">{t('common.retry')}</Text>
            </TouchableOpacity>
          ) : (
            (prefs ?? []).map((p, i) => (
              <Toggle
                key={p.key}
                label={p.label}
                description={p.mutable ? p.description : t('settings.alwaysOn')}
                value={p.enabled}
                disabled={!p.mutable || mutation.isPending}
                onChange={(v) => mutation.mutate({ ...p, enabled: v })}
                last={i === (prefs ?? []).length - 1}
              />
            ))
          )}
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

function Toggle({
  label,
  description,
  value,
  onChange,
  last,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.6}
      className={`px-5 py-4 flex-row items-center justify-between ${!last ? 'border-b border-gray-50' : ''}`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        {description ? <Text className="text-xs text-gray-400 mt-0.5">{description}</Text> : null}
      </View>
      <View className={`w-11 h-6 rounded-full ${value ? 'bg-primary-500' : 'bg-gray-300'} ${disabled ? 'opacity-50' : ''} px-0.5 justify-center`}>
        <View className={`w-5 h-5 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`} style={{ elevation: 2 }} />
      </View>
    </TouchableOpacity>
  );
}
