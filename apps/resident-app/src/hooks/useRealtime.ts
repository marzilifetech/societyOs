import { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

// Configure how notifications appear when the app is in the foreground.
// MUST run lazily — calling this at module scope throws "property is not
// writable" under Expo Go SDK 52 New Architecture, which freezes the JS bundle
// before the native expo-notifications module is initialized.
let notificationHandlerSet = false;
function ensureNotificationHandler() {
  if (notificationHandlerSet) return;
  notificationHandlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    /* expo-notifications partially unsupported in Expo Go SDK 52 */
  }
}

async function scheduleLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // fire immediately
    });
  } catch {
    // expo-notifications may not have permissions; fall back to Alert
    Alert.alert(title, body);
  }
}

export function useRealtime() {
  useEffect(() => {
    ensureNotificationHandler();
    connectSocket();
    const socket = getSocket();

    const onVisitorArrived = (data: { visitorName?: string }) => {
      scheduleLocalNotification(
        'Visitor Arrived',
        `${data?.visitorName ?? 'Someone'} is at the gate`,
      );
    };

    const onComplaintUpdated = (data: { status?: string }) => {
      Alert.alert('Complaint Update', `Status changed to ${data?.status ?? 'unknown'}`);
    };

    const onPackageArrived = (data: { courierName?: string }) => {
      Alert.alert('Package Arrived', `${data?.courierName ?? 'A courier'} parcel is at reception`);
    };

    const onEmergencyBroadcast = (data: { title?: string; message?: string; severity?: string }) => {
      if (data?.severity === 'EMERGENCY') {
        Vibration.vibrate([0, 500, 200, 500]);
      }
      Alert.alert('⚠️ Emergency Alert', data?.message ?? data?.title ?? 'Emergency notice from management');
    };

    socket.on('visitor:arrived', onVisitorArrived);
    socket.on('complaint:updated', onComplaintUpdated);
    socket.on('package:arrived', onPackageArrived);
    socket.on('emergency:broadcast', onEmergencyBroadcast);

    return () => {
      socket.off('visitor:arrived', onVisitorArrived);
      socket.off('complaint:updated', onComplaintUpdated);
      socket.off('package:arrived', onPackageArrived);
      socket.off('emergency:broadcast', onEmergencyBroadcast);
      disconnectSocket();
    };
  }, []);
}
