import { useAccessibilityStore } from '../store/accessibility.store';
import { defaultTokens, seniorTokens } from '../theme/tokens';

export function useTheme() {
  const seniorMode = useAccessibilityStore((s) => s.seniorMode);
  return seniorMode ? seniorTokens : defaultTokens;
}
