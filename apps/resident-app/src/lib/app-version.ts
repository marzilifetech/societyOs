import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * Single source of truth for the app's user-visible version. Reads the NATIVE
 * version/build first (what the store actually shipped), falling back to the
 * Expo config values so it still works in Expo Go / dev where the native
 * modules report null.
 */
const version =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

const build =
  Application.nativeBuildVersion ??
  String((Constants.expoConfig as { android?: { versionCode?: number } } | null)?.android
    ?.versionCode ?? '');

export const APP_VERSION = version;
export const APP_BUILD = build;

/** e.g. "v1.0.4 (10)" — build omitted if unknown. */
export const APP_VERSION_LABEL = build ? `v${version} (${build})` : `v${version}`;
