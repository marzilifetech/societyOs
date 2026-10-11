import { create } from 'zustand';

/**
 * App lock (PIN / biometric) as STATE, rendered as an overlay above the
 * navigator — not as a route.
 *
 * It used to be a route (`/(auth)/pin-login`) reached with `router.replace`.
 * `replace` swaps only the top screen, so locking from any detail screen left
 * the app underneath it in the stack: Android Back walked straight past the
 * lock without a PIN. Unlocking replaced the lock with a fresh `/(tabs)`,
 * stacking another Home (with its own polling) on every lock and destroying
 * whatever form the guard had open. An overlay has none of those problems: the
 * screens underneath are untouched, Back is intercepted, and unlocking just
 * removes it.
 */
interface LockState {
  /** True while the overlay must cover the app. */
  locked: boolean;
  /** A PIN exists for this session (read once at launch, updated on set/clear). */
  hasPin: boolean;
  lock: () => void;
  unlock: () => void;
  setHasPin: (hasPin: boolean) => void;
  /** Sign-out: no lock, no PIN. */
  reset: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  hasPin: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  setHasPin: (hasPin) => set({ hasPin }),
  reset: () => set({ locked: false, hasPin: false }),
}));
