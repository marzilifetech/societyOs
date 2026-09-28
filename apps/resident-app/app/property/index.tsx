import { Redirect } from 'expo-router';
import { UNFINISHED_SCREENS_ENABLED } from '../../src/lib/features';
import { ComingSoonScreen } from '../../src/components/ComingSoonScreen';

// Gated off on iOS (App Review: placeholder / developer screen) — see src/lib/features.ts.
export default function PropertyScreenGate() {
  if (!UNFINISHED_SCREENS_ENABLED) return <Redirect href={'/(tabs)' as any} />;
  return <PropertyScreen />;
}

function PropertyScreen() {
  return (
    <ComingSoonScreen
      title="Property"
      message="Property listings aren't available in your community yet. We'll notify you when this feature launches."
    />
  );
}
