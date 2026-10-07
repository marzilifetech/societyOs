import { router } from 'expo-router';

/**
 * Navigation requested by something outside the screen tree — chiefly a
 * notification tap — that must wait until the signed-in app shell (the tabs)
 * is actually on screen.
 *
 * WHY
 * ---
 * Tapping a notification while the app is closed is the most common way
 * residents open it ("visitor at the gate"). The tap is read as soon as the
 * root layout mounts, but at that moment the root layout is still showing the
 * boot screen and no navigator exists yet; expo-router's `router.push` then
 * throws "Attempted to navigate before mounting the Root Layout component".
 * The throw was swallowed and the tap already recorded as handled, so the
 * resident landed on Home with the visitor request nowhere in sight. When the
 * timing went the other way, the push raced the root redirect to Home and the
 * first screen visibly changed several times.
 *
 * Requests made before the shell is ready are held (the latest wins) and run
 * once, right after the tabs mount, on top of Home — so Back returns there.
 */

let shellReady = false;
let pendingHref: string | null = null;

function push(href: string) {
  try {
    router.push(href as never);
  } catch {
    // Navigator gone mid-flight (e.g. signed out). Dropping the route is
    // correct: it pointed into the signed-in app.
  }
}

/** Navigate now if the app shell is up, otherwise as soon as it is. */
export function navigateWhenAppReady(href: string): void {
  if (shellReady) {
    push(href);
    return;
  }
  pendingHref = href;
}

/**
 * Called by the tabs layout on mount. Returns the cleanup to call on unmount.
 * The held route runs on the next tick, after the mount has committed.
 */
export function markAppShellReady(): () => void {
  shellReady = true;
  const href = pendingHref;
  pendingHref = null;
  const timer = href ? setTimeout(() => push(href), 0) : null;
  return () => {
    shellReady = false;
    if (timer) clearTimeout(timer);
  };
}

/** Test seam: reset module state between tests. */
export function __resetDeferredNavigationForTests(): void {
  shellReady = false;
  pendingHref = null;
}
