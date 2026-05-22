import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import kn from '../locales/kn.json';
import ta from '../locales/ta.json';
import mr from '../locales/mr.json';

export type AppLocale = 'en' | 'hi' | 'kn' | 'ta' | 'mr';

export const SUPPORTED_LOCALES: { code: AppLocale; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

const STORAGE_KEY = 'app_locale';

export async function loadStoredLocale(): Promise<AppLocale> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v && ['en', 'hi', 'kn', 'ta', 'mr'].includes(v)) return v as AppLocale;
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

export default i18n;
