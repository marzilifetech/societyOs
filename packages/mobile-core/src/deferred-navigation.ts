/**
 * Navigation requested from outside the screen tree — chiefly a notification
 * tap — that must wait until the signed-in app shell is on screen.
 *
 * WHY
 * ---
 * Tapping a notification while the app is closed is the most common way the
 * apps are opened ("visitor at the gate", "SOS"). The tap is read as soon as the
 * root layout mounts, but at that moment no navigator exists yet (the boot
 * screen is showing) and, in the staff app, the PIN lock has not been passed.
 * expo-router's `router.push` then throws "Attempted to navigate before
 * mounting the Root Layout component", or — worse — the target screen is pushed
 * on top of the lock screen and is visible without a PIN.
 *
 * Requests made before the shell is ready are held (the latest wins) and run
 * once, right after the shell marks itself ready, on top of Home — so Back
 * returns there.
 *
 * The router is injected so this module has no dependency on expo-router and
 * each app keeps its own instance.
 */
export interface DeferredNavigator {
  /** Navigate now if the shell is up, otherwise as soon as it is. */
  navigateWhenReady(href: string): void;
  /**
   * Called by the shell (e.g. the tabs layout) once it is mounted AND usable.
   * Returns the cleanup to call when it goes away. The held route runs on the
   * next tick, after the mount has committed.
   */
  markReady(): () => void;
  /** Drop any held route — e.g. on sign-out, where it pointed into the old session. */
  clearPending(): void;
  /** Test seam. */
  reset(): void;
}

export function createDeferredNavigator(navigate: (href: string) => void): DeferredNavigator {
  let ready = false;
  let pendingHref: string | null = null;

  const go = (href: string) => {
    try {
      navigate(href);
    } catch {
      // Navigator gone mid-flight (e.g. signed out). Dropping the route is
      // correct: it pointed into the signed-in app.
    }
  };

  return {
    navigateWhenReady(href) {
      if (ready) {
        go(href);
        return;
      }
      pendingHref = href;
    },
    markReady() {
      ready = true;
      const href = pendingHref;
      pendingHref = null;
      const timer = href ? setTimeout(() => go(href), 0) : null;
      return () => {
        ready = false;
        if (timer) clearTimeout(timer);
      };
    },
    clearPending() {
      pendingHref = null;
    },
    reset() {
      ready = false;
      pendingHref = null;
    },
  };
}
