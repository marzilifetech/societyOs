import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';

let registered = false;
let responseSub: Notifications.Subscription | null = null;

export async function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (registered) return null;
  // Skip silently on iOS Simulator — push tokens are not issued there.
  if (!Constants.isDevice) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    if (final !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let token: string | null = null;
    try {
      const t = await Notifications.getDevicePushTokenAsync();
      token = t.data as unknown as string;
    } catch {
      try {
        const t = await Notifications.getExpoPushTokenAsync();
        token = t.data;
      } catch {
        token = null;
      }
    }
    if (!token) return null;

    try {
      // Canonical push-token endpoint (resident-app uses this too).
      await api.post('/auth/device-token', { token, platform: Platform.OS });
    } catch (err: any) {
      if (__DEV__) console.warn('[notifications] register device failed', err?.message);
    }
    registered = true;
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[notifications] error', err);
    return null;
  }
}

export function attachNotificationTapHandler() {
  if (responseSub) return responseSub;
  responseSub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp.notification.request.content.data ?? {};
    const type = (data as any).type;
    const id = (data as any).id;
    try {
      switch (type) {
        case 'task':
          if (id) router.push(`/tasks/${id}` as any);
          else router.push('/(tabs)/tasks' as any);
          break;
        case 'review':
          router.push('/reviews' as any);
          break;
        case 'leave':
          router.push('/leave/balance' as any);
          break;
        case 'help':
          if (id) router.push(`/help-requests/${id}` as any);
          else router.push('/help-requests' as any);
          break;
        case 'notice':
          router.push('/community/notices' as any);
          break;
      }
    } catch {}
  });
  return responseSub;
}

export function detachNotificationTapHandler() {
  if (responseSub) {
    responseSub.remove();
    responseSub = null;
  }
}
