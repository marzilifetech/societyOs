import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { useLockStore } from '../src/store/lock.store';
import { BootScreen } from '../src/components/BootScreen';
import { entryRoute } from '../src/lib/navigation';

/**
 * Entry route. The root layout's boot gate guarantees the session has been
 * read by the time this renders, so the decision is made exactly once:
 *
 *   signed out          → society picker
 *   signed in, no PIN   → create one (every session has its own)
 *   signed in, PIN set  → Home, under the lock overlay (see lock.store.ts)
 *
 * It used to send every signed-in launch to Home and let a separate effect
 * replace it with the PIN screen afterwards, so Home mounted, fired its
 * queries and the notification-permission dialog, and was tappable on a slow
 * Keystore before the lock caught up.
 *
 * The BootScreen under the redirect keeps the frames between the splash and
 * the destination the splash colour instead of the navigator's blank grey.
 */
export default function Index() {
  const token = useAuthStore((s) => s.token);
  const hasPin = useLockStore((s) => s.hasPin);

  return (
    <>
      <BootScreen />
      <Redirect href={entryRoute(token, hasPin)} />
    </>
  );
}
