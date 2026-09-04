import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/ui';
import {
  checkPermission,
  ensurePermission,
  openAppSettings,
  type PermissionKind,
  type PermissionOutcome,
} from '../../src/lib/permissions';

/**
 * One screen where a staff member can see every permission the app uses, why
 * it is needed, and fix any that are off.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * Permissions were previously only ever surfaced at the moment they failed —
 * a camera alert here, a silent null there — so a staff member whose location
 * was blocked had no way to discover that was the reason check-in kept
 * refusing, and no route to fix it beyond hunting through OS settings.
 *
 * It also matters operationally: a guard with the camera blocked cannot log a
 * gate entry, and nobody finds out until someone is standing at the gate.
 * Being able to check all four before a shift is the point.
 */

const ITEMS: { kind: PermissionKind; icon: keyof typeof Ionicons.glyphMap; title: string; why: string }[] = [
  {
    kind: 'notifications',
    icon: 'notifications-outline',
    title: 'Notifications',
    why: 'New tasks, gate entries and emergencies reach you here first.',
  },
  {
    kind: 'location',
    icon: 'location-outline',
    title: 'Location',
    why: 'Confirms you are on premises at check-in, and is attached to an SOS.',
  },
  {
    kind: 'camera',
    icon: 'camera-outline',
    title: 'Camera',
    why: 'Visitor photos, before/after task proof, and scanning gate passes.',
  },
  {
    kind: 'photos',
    icon: 'images-outline',
    title: 'Photos',
    why: 'Attaching an existing photo or document to a task or upload.',
  },
];

const TONE: Record<PermissionOutcome, { label: string; cls: string; dot: string }> = {
  granted: { label: 'Allowed', cls: 'text-green-700 dark:text-green-400', dot: '#16A34A' },
  denied: { label: 'Not allowed', cls: 'text-amber-700 dark:text-amber-400', dot: '#D97706' },
  blocked: { label: 'Blocked', cls: 'text-red-700 dark:text-red-400', dot: '#DC2626' },
  unavailable: { label: 'Unavailable', cls: 'text-gray-500 dark:text-gray-400', dot: '#9CA3AF' },
};

export default function PermissionsScreen() {
  const [state, setState] = useState<Record<string, PermissionOutcome>>({});
  const [busy, setBusy] = useState<PermissionKind | null>(null);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      ITEMS.map(async (i) => [i.kind, (await checkPermission(i.kind)).outcome] as const),
    );
    setState(Object.fromEntries(entries));
  }, []);

  // Re-read on focus: the fix for a blocked permission happens in the OS
  // settings app, so the only way this screen learns about it is on return.
  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleFix = async (kind: PermissionKind) => {
    setBusy(kind);
    try {
      await ensurePermission(kind, { withRationale: false });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const anyBlocked = Object.values(state).some((s) => s === 'blocked');

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Permissions" showBack />
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-3">
        <Text className="text-sm text-gray-500 dark:text-gray-400 px-1">
          The app asks for these only when it needs them. Anything not allowed will stop the
          matching part of your work from going through.
        </Text>

        <View className="rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
          {ITEMS.map((item, idx) => {
            const outcome = state[item.kind];
            const tone = outcome ? TONE[outcome] : null;
            return (
              <View
                key={item.kind}
                className={`px-4 py-3.5 ${idx < ITEMS.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons name={item.icon} size={20} color="#6B7280" />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.why}</Text>
                  </View>
                  {tone ? (
                    <View className="flex-row items-center gap-1.5">
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.dot }} />
                      <Text className={`text-xs font-semibold ${tone.cls}`}>{tone.label}</Text>
                    </View>
                  ) : null}
                </View>

                {outcome && outcome !== 'granted' && outcome !== 'unavailable' ? (
                  <TouchableOpacity
                    onPress={() => handleFix(item.kind)}
                    disabled={busy === item.kind}
                    accessibilityRole="button"
                    className="mt-2.5 self-start rounded-xl bg-primary-500 px-3.5 py-2"
                  >
                    <Text className="text-white text-xs font-bold">
                      {busy === item.kind
                        ? 'Opening…'
                        : outcome === 'blocked'
                          ? 'Open phone settings'
                          : `Allow ${item.title.toLowerCase()}`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {anyBlocked ? (
          <TouchableOpacity
            onPress={openAppSettings}
            accessibilityRole="button"
            className="rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5 flex-row items-center gap-3"
          >
            <Ionicons name="settings-outline" size={20} color="#6B7280" />
            <Text className="text-base text-gray-900 dark:text-gray-100">
              Open this app in phone settings
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
