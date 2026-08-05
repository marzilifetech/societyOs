import { Redirect, Stack } from 'expo-router';
import { HEALTH_ENABLED } from '../../src/lib/features';

/**
 * The Doctor Portal is part of the gated health module (see
 * src/lib/features.ts). While HEALTH_ENABLED is false these routes are
 * unreachable — they redirect home — so the Play Health Apps Declaration can
 * be answered truthfully. Mirrors apps/resident-app/app/health/_layout.tsx.
 */
export default function DoctorLayout() {
  if (!HEALTH_ENABLED) return <Redirect href={'/(tabs)' as any} />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    />
  );
}
