import { useTheme } from '../../src/hooks/useTheme';
import { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { openNotificationSettings } from '../../src/lib/push';

type Preference = {
  key: string;
  label: string;
  description: string;
  importance: string;
  mutable: boolean;
  enabled: boolean;
};

function readPermissionStatus(permission: unknown) {
  if (permission && typeof permission === 'object') {
    const status = (permission as { status?: unknown }).status;
    if (typeof status === 'string') return status;

    const granted = (permission as { granted?: unknown }).granted;
    if (typeof granted === 'boolean') return granted ? 'granted' : 'undetermined';
  }

  return 'undetermined';
}

export default function NotificationSettingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  // Local enabled-overrides keyed by category so toggles feel instant while
  // the source of truth remains the server response.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Notifications.getPermissionsAsync().then((permission) =>
      setPermissionStatus(readPermissionStatus(permission)),
    );
  }, []);

  const { data: prefs, isLoading } = useQuery<Preference[]>({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get<Preference[]>('/notifications/preferences'),
  });

  const isEnabled = (p: Preference) =>
    p.key in overrides ? overrides[p.key] : p.enabled;

  const saveMutation = useMutation<void, Error>({
    mutationFn: () => {
      const list = prefs ?? [];
      return api.patch<void>('/notifications/preferences', {
        prefs: list
          .filter((p) => p.mutable)
          .map((p) => ({ category: p.key, enabled: isEnabled(p) })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-preferences'] });
      setOverrides({});
      Alert.alert('Saved', 'Notification preferences updated.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const requestPermission = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    const status = readPermissionStatus(permission);
    setPermissionStatus(status);
    // If still not granted, the only remaining path is the OS settings screen.
    if (status !== 'granted') {
      openNotificationSettings();
    }
  };

  const list = prefs ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4 pb-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary-500 text-base mb-4">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 mb-1">Notifications</Text>
          <Text className="text-gray-500 mb-6">Choose what you'd like to be notified about</Text>
        </View>

        {permissionStatus !== 'granted' && (
          <View className="mx-6 mb-6 bg-amber-50 rounded-2xl p-4">
            <Text className="text-amber-800 font-medium text-sm mb-1">Notifications Disabled</Text>
            <Text className="text-amber-700 text-xs mb-3 leading-5">
              Enable notifications to receive important updates from your society.
            </Text>
            <TouchableOpacity
              className="bg-amber-500 rounded-xl py-2.5 px-4 self-start"
              onPress={requestPermission}
            >
              <Text className="text-white font-semibold text-sm">Enable Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#3B3FBF" />
          </View>
        ) : (
          <View className="mx-6 bg-gray-50 rounded-2xl overflow-hidden mb-6">
            {list.map((pref, idx) => (
              <View
                key={pref.key}
                className={`flex-row items-center px-5 py-4 ${idx < list.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-medium text-gray-900">{pref.label}</Text>
                  {pref.description ? (
                    <Text className="text-xs text-gray-400 mt-0.5">{pref.description}</Text>
                  ) : null}
                </View>
                {pref.mutable ? (
                  <Switch
                    value={isEnabled(pref)}
                    onValueChange={(val: boolean) =>
                      setOverrides((o) => ({ ...o, [pref.key]: val }))
                    }
                    trackColor={{ false: '#E5E7EB', true: '#C7C9F5' }}
                    thumbColor={isEnabled(pref) ? '#3B3FBF' : '#9CA3AF'}
                  />
                ) : (
                  <Text className="text-xs font-semibold text-primary-500">Always on</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View className="px-6 mb-8">
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl py-4 items-center"
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Save Preferences</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
