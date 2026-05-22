import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';

export default function Index() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) return null;

  if (!token) {
    return <Redirect href="/(auth)/society-select" />;
  }

  return <Redirect href={user?.status === 'ACTIVE' ? '/(tabs)' : '/(auth)/pending-approval'} />;
}
