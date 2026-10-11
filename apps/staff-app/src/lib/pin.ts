import * as SecureStore from 'expo-secure-store';
import { swallow } from '@societyos/mobile-core';

/**
 * The app-unlock PIN.
 *
 * Lives here, not in the pin-setup route file: expo-router treats every export
 * of a file under app/ as part of a route, and the root layout importing a
 * route module pulled that whole screen into the boot path.
 *
 * The PIN belongs to the SESSION, not the device. Guard phones are shared
 * between shifts; when it outlived sign-out, the next guard signed in with
 * their own OTP and was then locked behind the previous guard's PIN. Sign-out
 * clears it (see auth.store clearAuth).
 */

export const PIN_KEY = 'staff_pin_hash';
const ATTEMPTS_KEY = 'staff_pin_attempts';
export const PIN_LENGTH = 4;
export const MAX_PIN_ATTEMPTS = 5;

// Tiny non-cryptographic hash. Sufficient as obfuscation for a 4-digit PIN
// stored in SecureStore (which is already hardware-backed on iOS/Android).
// Kept as-is so PINs set by earlier builds keep working.
function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export async function isPinSet(): Promise<boolean> {
  try {
    return !!(await SecureStore.getItemAsync(PIN_KEY));
  } catch {
    return false;
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return !!stored && stored === hashPin(pin);
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, hashPin(pin));
  await resetPinAttempts();
}

export async function clearPin(): Promise<void> {
  await swallow(() => SecureStore.deleteItemAsync(PIN_KEY));
  await resetPinAttempts();
}

/**
 * Failed-attempt counter, PERSISTED.
 *
 * The lockout used to live in React state on the PIN screen, so force-quitting
 * the app reset it to zero — the "5 attempts then sign out" rule could be
 * bypassed indefinitely by killing and reopening the app, which makes a
 * 4-digit PIN exhaustively guessable on a stolen phone.
 */
export async function getPinAttempts(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function recordFailedPinAttempt(): Promise<number> {
  const next = (await getPinAttempts()) + 1;
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, String(next));
  } catch {
    /* counter is best-effort; never block the UI on it */
  }
  return next;
}

export async function resetPinAttempts(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

/** PINs that offer no protection at all. Warned about, not blocked. */
export const WEAK_PINS = new Set([
  '0000',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '1234',
  '4321',
]);
