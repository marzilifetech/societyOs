import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * Single source of truth for the app's user-visible version. Prefers the NATIVE
 * version/build (what the store actually shipped) and falls back to the Expo
 * config so it still works in dev where the native modules report null.
 */
const version =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

const build =
  Application.nativeBuildVersion ??
  String((Constants.expoConfig as { android?: { versionCode?: number } } | null)?.android
    ?.versionCode ?? '');

export const APP_VERSION = version;
export const APP_BUILD = build;

/** e.g. "v1.0.2 (5)" — build omitted if unknown. */
export const APP_VERSION_LABEL = build ? `v${version} (${build})` : `v${version}`;
