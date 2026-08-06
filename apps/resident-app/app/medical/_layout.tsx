import { Redirect, Stack, useSegments } from 'expo-router';
import { HEALTH_ENABLED } from '../../src/lib/features';

/**
 * SOS is a generic security/gate emergency alert (POST /sos/trigger), NOT a
 * health feature, so it stays reachable even when the health module is gated
 * off for the Play build. Everything else under /medical (doctor desk,
 * booking, appointments) is part of the gated health module and redirects
 * home while HEALTH_ENABLED is false. See src/lib/features.ts.
 */
const SOS_ROUTES = new Set(['sos', 'sos-history']);

export default function MedicalLayout() {
  // segments e.g. ['medical'], ['medical','sos'], ['medical','book'],
  // ['medical','appointments','reschedule']. segments[1] is the sub-route.
  const segments = useSegments() as string[];
  const sub = segments[1] ?? '';
  if (!HEALTH_ENABLED && !SOS_ROUTES.has(sub)) {
    return <Redirect href={'/(tabs)' as any} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
