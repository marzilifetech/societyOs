const { withAndroidManifest, AndroidConfig, createRunOncePlugin } = require('expo/config-plugins');

const pkg = { name: 'with-android-activity-config-changes', version: '1.0.0' };

/**
 * Configuration changes MainActivity handles itself instead of being
 * destroyed and recreated.
 *
 * WHY
 * ---
 * Expo's template omits `smallestScreenSize`, which React Native's own
 * template includes. Without it, any change to the smallest screen width
 * recreates the activity — and for a React Native app that means the whole JS
 * app unmounts and boots again: splash, redirect, Home, with the resident's
 * place lost. On Samsung phones that happens on very ordinary actions:
 * opening the app in split screen or pop-up view, resizing either, and
 * folding or unfolding a Galaxy Z Fold/Flip. Android 16 also stops honouring
 * the portrait lock on large screens (targetSdk 36), so tablets rotate too.
 *
 * React Native re-lays out on its own when these change (it emits new window
 * dimensions), so handling them in place is safe.
 *
 * `density` and `fontScale` are deliberately NOT handled: changing display
 * size or font size in Settings should rebuild the UI at the new scale.
 */
const REQUIRED = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenLayout',
  'screenSize',
  'smallestScreenSize',
  'uiMode',
];

function mergeConfigChanges(existing) {
  const current = (existing ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...current];
  for (const change of REQUIRED) {
    if (!merged.includes(change)) merged.push(change);
  }
  return merged.join('|');
}

const withAndroidActivityConfigChanges = (config) =>
  withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const activity = application.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (!activity) {
      throw new Error(
        '[with-android-activity-config-changes] .MainActivity not found in AndroidManifest.xml.',
      );
    }
    activity.$['android:configChanges'] = mergeConfigChanges(activity.$['android:configChanges']);
    return config;
  });

module.exports = createRunOncePlugin(withAndroidActivityConfigChanges, pkg.name, pkg.version);
module.exports.mergeConfigChanges = mergeConfigChanges;
