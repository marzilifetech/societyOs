import { useTheme } from '../../src/hooks/useTheme';
import { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

const PREFS = [
  { key: 'notices', label: 'Notices & Announcements', desc: 'Society circulars and important updates' },
  { key: 'visitors', label: 'Visitor Alerts', desc: 'When a visitor checks in or is denied' },
  { key: 'serviceRequests', label: 'Service Request Updates', desc: 'Status changes on your requests' },
  { key: 'maintenance', label: 'Maintenance Reminders', desc: 'Due date reminders for bills' },
  { key: 'events', label: 'Upcoming Events', desc: 'Reminders for events you registered for' },
  { key: 'sos', label: 'SOS Alerts', desc: 'Emergency alerts in your society' },
];

type NotificationPrefs = Record<string, boolean>;

type AuthMeResponse = {
  notificationPrefs?: NotificationPrefs;
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
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    Object.fromEntries(PREFS.map((p) => [p.key, true])),
  );
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');

  useEffect(() => {
    Notifications.getPermissionsAsync().then((permission) =>
      setPermissionStatus(readPermissionStatus(permission)),
    );
  }, []);

  const { data: me } = useQuery<AuthMeResponse>({
    queryKey: ['auth-me'],
    queryFn: () => api.get<AuthMeResponse>('/auth/me'),
  });

  useEffect(() => {
    if (me?.notificationPrefs) {
      setPrefs((current) => ({ ...current, ...me.notificationPrefs }));
    }
  }, [me]);

  const saveMutation = useMutation<void, Error>({
    mutationFn: () => api.patch<void>('/auth/notification-prefs', { prefs }),
    onSuccess: () => Alert.alert('Saved', 'Notification preferences updated.'),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const requestPermission = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    setPermissionStatus(readPermissionStatus(permission));
  };

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

        <View className="mx-6 bg-gray-50 rounded-2xl overflow-hidden mb-6">
          {PREFS.map((pref, idx) => (
            <View
              key={pref.key}
              className={`flex-row items-center px-5 py-4 ${idx < PREFS.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <View className="flex-1 mr-4">
                <Text className="text-sm font-medium text-gray-900">{pref.label}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{pref.desc}</Text>
              </View>
              <Switch
                value={prefs[pref.key]}
                onValueChange={(val: boolean) => setPrefs((p) => ({ ...p, [pref.key]: val }))}
                trackColor={{ false: '#E5E7EB', true: '#C7C9F5' }}
                thumbColor={prefs[pref.key] ? '#3B3FBF' : '#9CA3AF'}
              />
            </View>
          ))}
        </View>

        <View className="px-6 mb-8">
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl py-4 items-center"
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
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
