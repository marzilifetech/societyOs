import { Redirect } from 'expo-router';

/**
 * Any unknown route — a stale notification, an old deep link, a removed
 * screen — goes back through the root index, which sends the user to sign-in,
 * pending approval or Home as appropriate. Without this file expo-router shows
 * its developer "Unmatched Route" screen.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
