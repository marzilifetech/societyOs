import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Public pages the app links to. App Review requires the privacy policy to be
 * reachable inside the app (Guideline 5.1.1(i)) and a way to get support, so
 * both sit in Settings → Help & support. The same URLs are on the App Store
 * listing.
 */
export const WEB_BASE = 'https://society-admin-dev.marzitech.in';
export const PRIVACY_POLICY_URL = `${WEB_BASE}/privacy-policy`;
export const SUPPORT_URL = `${WEB_BASE}/support`;
export const ACCOUNT_DELETION_URL = `${WEB_BASE}/account-deletion`;
export const SUPPORT_EMAIL = 'support@marzi.in';

/** Opens a web page in the in-app browser, falling back to Safari / Chrome. */
export async function openWebPage(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open the page', url);
    });
  }
}

/**
 * Starts a phone call. iPads and phones without a SIM cannot place calls, and
 * `tel:` then fails without any sign, so show the number to dial instead.
 */
export function callNumber(phone: string, title = 'Call'): void {
  Linking.openURL(`tel:${phone}`).catch(() => {
    Alert.alert(title, `Please call ${phone}.`);
  });
}
