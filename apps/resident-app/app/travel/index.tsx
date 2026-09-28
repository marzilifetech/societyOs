import { Redirect } from 'expo-router';
import { UNFINISHED_SCREENS_ENABLED } from '../../src/lib/features';
import { ComingSoonScreen } from '../../src/components/ComingSoonScreen';

// Gated off on iOS (App Review: placeholder / developer screen) — see src/lib/features.ts.
export default function TravelScreenGate() {
  if (!UNFINISHED_SCREENS_ENABLED) return <Redirect href={'/(tabs)' as any} />;
  return <TravelScreen />;
}

function TravelScreen() {
  return (
    <ComingSoonScreen
      title="Travel"
      message="Travel pause isn't available in your community yet. We'll notify you when it launches."
    />
  );
}
