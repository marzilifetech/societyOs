/**
 * Backwards-compatible re-export of the FCM-based `PushService` from
 * `common/notification`. Older import paths used `common/push/push.service`;
 * keep this file so those paths keep working and history stays clear.
 *
 * Production sends use Firebase (`User.fcmToken`). Expo push tokens / `expo-server-sdk`
 * are not wired here; add a separate `ExpoPushService` beside this file if you need both.
 */
export { PushService } from '../notification/push.service';
