import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Android SMS Retriever auto-read, matching the flow already shipping in the
 * Marzi User-Mobile-Application (`src/Screens/AuthV2/OTPSubmission`).
 *
 * The module is optional: it is loaded with require() inside a try/catch so the
 * app still builds and runs if `react-native-otp-verify` is not installed. When
 * absent — and on iOS, which has no equivalent API — the OTP screen falls back
 * to the platform one-time-code affordances (`autoComplete="sms-otp"` on
 * Android, `textContentType="oneTimeCode"` on iOS), which need no native module
 * and no permission.
 *
 * IMPORTANT — the SMS must carry this app's own hash. SMS Retriever matches on
 * an 11-character hash derived from the package name AND the signing
 * certificate, so the hash that works for the other Marzi app will NOT work for
 * com.marzi.resident. Log `getSmsRetrieverHash()` from a release build signed
 * with the upload key and give that value to whoever owns the SMS template.
 * Until the template carries the right hash, this listener simply never fires
 * and the user types the code — no breakage, just no autofill.
 *
 * No READ_SMS permission is involved: SMS Retriever hands the app only the one
 * matching message, which is why Play does not treat it as a sensitive
 * permission.
 */
type OtpVerifyModule = {
  getHash: () => Promise<string[]>;
  getOtp: () => Promise<boolean>;
  addListener: (handler: (message: string) => void) => { remove: () => void } | void;
  removeListener: () => void;
  /** Play Services phone-number picker — the native "choose your number" sheet. */
  requestHint: () => Promise<string | null>;
};

let RNOtpVerify: OtpVerifyModule | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-otp-verify');
    RNOtpVerify = (mod?.default ?? mod) as OtpVerifyModule;
  } catch {
    RNOtpVerify = null;
  }
}

/** True when native auto-read is actually available on this build. */
export const smsAutoReadAvailable = RNOtpVerify != null;

/**
 * Resolve this build's SMS Retriever hash. Returns null when unavailable.
 * The value depends on the signing certificate, so debug and release differ.
 */
export async function getSmsRetrieverHash(): Promise<string | null> {
  if (!RNOtpVerify) return null;
  try {
    const hashes = await RNOtpVerify.getHash();
    return hashes?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Show the Android system phone-number picker (Play Services Hint API) and
 * return the chosen number as plain digits, or null if the user dismissed it,
 * Play Services is missing, or the device has no number on the SIM.
 *
 * This is a real OS sheet listing the numbers on the device — not an autofill
 * dropdown — so the text input deliberately opts OUT of autofill to avoid two
 * competing suggestion UIs fighting over the same field.
 */
export async function requestPhoneNumberHint(): Promise<string | null> {
  if (!RNOtpVerify?.requestHint) return null;
  try {
    const hint = await RNOtpVerify.requestHint();
    if (!hint) return null;
    // Comes back E.164-ish ("+919876543210"); callers want the 10-digit local part.
    const digits = hint.replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  } catch {
    return null;
  }
}

/**
 * Extract an OTP of exactly `length` digits from an SMS body. Anchored with
 * lookarounds so a longer number in the message (an order id, a phone number)
 * can't be mistaken for the code.
 */
export function extractOtp(message: string, length: number): string | null {
  if (!message || message === 'Timeout Error') return null;
  const re = new RegExp(`(?<!\\d)(\\d{${length}})(?!\\d)`);
  return message.match(re)?.[1] ?? null;
}

export function useSmsOtpAutoRead(length: number, onCode: (code: string) => void) {
  // Keep the latest callback without re-subscribing the native listener.
  const cbRef = useRef(onCode);
  cbRef.current = onCode;

  useEffect(() => {
    if (!RNOtpVerify) return;

    let subscription: { remove: () => void } | void;
    let cancelled = false;

    RNOtpVerify.getOtp()
      .then(() => {
        if (cancelled || !RNOtpVerify) return;
        subscription = RNOtpVerify.addListener((message) => {
          const code = extractOtp(message, length);
          if (code) cbRef.current(code);
        });
      })
      .catch(() => {
        /* retriever unavailable (no Play Services) — manual entry still works */
      });

    return () => {
      cancelled = true;
      try {
        subscription?.remove();
        RNOtpVerify?.removeListener();
      } catch {
        /* already torn down */
      }
    };
  }, [length]);
}
