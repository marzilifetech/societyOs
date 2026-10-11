import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { settleWithin } from '@societyos/mobile-core';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import kn from '../locales/kn.json';
import ta from '../locales/ta.json';
import mr from '../locales/mr.json';
import te from '../locales/te.json';

export type AppLocale = 'en' | 'hi' | 'kn' | 'ta' | 'mr' | 'te';

export const SUPPORTED_LOCALES: { code: AppLocale; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

const STORAGE_KEY = 'app_locale';

export async function loadStoredLocale(): Promise<AppLocale> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v && ['en', 'hi', 'kn', 'ta', 'mr', 'te'].includes(v)) return v as AppLocale;
  } catch {}
  return 'en';
}

export async function setLocale(code: AppLocale) {
  await AsyncStorage.setItem(STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export async function initI18n() {
  const stored = await loadStoredLocale();
  if (i18n.isInitialized) {
    if (i18n.language !== stored) await i18n.changeLanguage(stored);
    return;
  }
  // Deep-clone so Metro/Hermes immutable JSON modules can't break i18next’s store updates.
  const bundle = (m: object) => JSON.parse(JSON.stringify(m)) as object;

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: bundle(en) },
      hi: { translation: bundle(hi) },
      kn: { translation: bundle(kn) },
      ta: { translation: bundle(ta) },
      mr: { translation: bundle(mr) },
      te: { translation: bundle(te) },
    },
    lng: stored,
    fallbackLng: 'en',
    defaultNS: 'translation',
    ns: ['translation'],
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
    react: { useSuspense: false },
  });
}

/** Upper bound on i18n start-up: past it the app shows (English) rather than wait. */
const I18N_BUDGET_MS = 3000;

let started: Promise<void> | null = null;

/**
 * Start i18n once. Never rejects and never hangs — it used to sit inside the
 * boot `Promise.all`, where any throw held the whole app on the splash.
 */
export function startI18n(): Promise<void> {
  if (!started) {
    started = settleWithin(
      initI18n().catch((err) => {
        if (__DEV__) console.warn('[i18n] init failed', err);
      }),
      I18N_BUDGET_MS,
      undefined,
    );
  }
  return started;
}

/** True once i18n has started (or given up). */
export function useI18nReady(): boolean {
  const [ready, setReady] = useState(i18n.isInitialized);
  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    void startI18n().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}

export default i18n;
