import { useEffect, useState } from 'react';

/**
 * How long launch waits for the custom fonts before showing the app in the
 * system font. Fonts load on the same native queue as everything else, so a
 * slow device can hold them up; text then re-renders in the brand fonts when
 * they arrive.
 */
export const FONT_WAIT_MS = 3500;

type BootGateInput = {
  /** The stored session has been read (or given up on). */
  isHydrated: boolean;
  /** Fonts finished loading, successfully or not. */
  fontsSettled: boolean;
};

/**
 * Decides when the app may leave the boot screen.
 *
 * The session MUST be known first: rendering routes before it is would send a
 * signed-in resident to the sign-in flow. Hydration bounds itself (see
 * HYDRATE_BUDGET_MS), so waiting on it can never be indefinite. Fonts are
 * cosmetic and only waited on for FONT_WAIT_MS.
 *
 * Every input only ever moves from false to true, so once ready the gate
 * stays ready — the app tree is never torn down and remounted by it.
 */
export function useBootGate({ isHydrated, fontsSettled }: BootGateInput): boolean {
  const [fontWaitOver, setFontWaitOver] = useState(false);

  useEffect(() => {
    if (fontsSettled) return undefined;
    const timer = setTimeout(() => {
      // Visible in logcat / Xcode console when diagnosing a slow launch.
      console.warn(`[boot] fonts not ready after ${FONT_WAIT_MS}ms — continuing with system font`);
      setFontWaitOver(true);
    }, FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [fontsSettled]);

  return isHydrated && (fontsSettled || fontWaitOver);
}
