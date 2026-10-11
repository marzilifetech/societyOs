import { router } from 'expo-router';
import { createDeferredNavigator } from '@societyos/mobile-core';

/**
 * Navigation from outside the screen tree (notification taps, the in-app
 * banner). Held until the tabs are mounted AND the app is unlocked, so a tap
 * that launches the app neither throws "navigate before mounting" nor shows
 * the target screen on top of the PIN lock. See @societyos/mobile-core.
 */
export const appNavigator = createDeferredNavigator((href) => router.push(href as never));

/**
 * Where the app opens to, once the stored session has been read:
 *
 *   signed out          → society picker
 *   signed in, no PIN   → create one (every session has its own)
 *   signed in, PIN set  → Home, under the lock overlay (see lock.store.ts)
 */
export function entryRoute(token: string | null, hasPin: boolean) {
  if (!token) return '/(auth)/society-select' as const;
  return hasPin ? ('/(tabs)' as const) : ('/(auth)/pin-setup' as const);
}
