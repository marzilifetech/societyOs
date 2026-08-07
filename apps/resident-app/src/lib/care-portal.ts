import { router } from 'expo-router';
import { api } from './api';

/**
 * Web "Care" portal base. Override with EXPO_PUBLIC_CARE_URL; defaults to the
 * deployed admin-web origin that serves /care. (Referenced via process.env so
 * babel-preset-expo inlines it into the release bundle.)
 */
const CARE_WEB_URL =
  process.env.EXPO_PUBLIC_CARE_URL ?? 'https://society-admin-dev.marzitech.in';

/**
 * Open the Care portal in the full-screen in-app WebView (app/plus.tsx).
 * Mints a one-time handoff token from the current session so the portal lands
 * signed-in (no second OTP). Uses an in-app WebView (not a browser tab) so the
 * experience is chrome-less and camera-based record uploads work reliably —
 * a Custom Tab is destroyed when the camera launches; a hosted WebView isn't.
 * If the mint fails (offline/expired) we still open the portal; it OTP-logs-in.
 */
export async function openCarePortal(): Promise<void> {
  let url = `${CARE_WEB_URL}/care`;
  try {
    const res = await api.post<{ token?: string }>('/auth/care-handoff', {});
    if (res?.token) {
      url = `${CARE_WEB_URL}/care/enter?t=${encodeURIComponent(res.token)}`;
    }
  } catch {
    // Non-fatal — open the portal and let it OTP-login.
  }
  router.push({ pathname: '/plus', params: { url } });
}
