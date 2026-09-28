import { Redirect, Stack } from 'expo-router';
import { UGC_ENABLED } from '../../src/lib/features';

/**
 * The community feed is user-generated content with no report/block yet, so it
 * is gated off on iOS (App Store Guideline 1.2). When UGC_ENABLED is false any
 * deep link here lands on Home instead. See src/lib/features.ts.
 */
export default function CommunityLayout() {
  if (!UGC_ENABLED) return <Redirect href={'/(tabs)' as any} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
