import { Redirect, Stack } from 'expo-router';
import { HEALTH_ENABLED } from '../../src/lib/features';

/**
 * The entire /health tree (records, vitals, medications) is part of the health
 * module gated off for the Play build. When HEALTH_ENABLED is false these
 * routes are unreachable — any deep link (including stale notifications) lands
 * on Home instead. See src/lib/features.ts.
 */
export default function HealthLayout() {
  if (!HEALTH_ENABLED) return <Redirect href={'/(tabs)' as any} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
