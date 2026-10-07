import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { BootScreen } from '../src/components/BootScreen';

/**
 * Entry route: sends the resident to sign-in, pending approval or Home.
 *
 * It renders the BootScreen underneath the redirect. `<Redirect>` itself draws
 * nothing, so this screen used to show the navigator's blank grey background
 * for the frames between the splash and the destination — one of the extra
 * "loads" seen at launch. With the boot screen here, the splash goes straight
 * to the first real screen.
 */
function entryRoute(token: string | null, status: string | undefined) {
  if (!token) return '/(auth)/society-select' as const;
  return status === 'ACTIVE' ? ('/(tabs)' as const) : ('/(auth)/pending-approval' as const);
}

export default function Index() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);
  const status = useAuthStore((s) => s.user?.status);

  if (!isHydrated) return <BootScreen />;

  return (
    <>
      <BootScreen />
      <Redirect href={entryRoute(token, status)} />
    </>
  );
}
