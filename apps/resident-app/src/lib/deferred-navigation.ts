import { router } from 'expo-router';
import { createDeferredNavigator } from '@societyos/mobile-core';

/**
 * Navigation from outside the screen tree (notification taps, the in-app
 * banner). Held until the tabs are mounted, so a tap that launches the app
 * neither throws "navigate before mounting" nor races the root redirect to
 * Home. See @societyos/mobile-core for the full story.
 */
export const appNavigator = createDeferredNavigator((href) => router.push(href as never));

/** Navigate now if the app shell is up, otherwise as soon as it is. */
export function navigateWhenAppReady(href: string): void {
  appNavigator.navigateWhenReady(href);
}

/** Called by the tabs layout on mount. Returns the cleanup to call on unmount. */
export function markAppShellReady(): () => void {
  return appNavigator.markReady();
}
