const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');

const pkg = { name: 'with-android-release-signing', version: '1.0.0' };

/**
 * Wires the local release keystore into `android/app/build.gradle`.
 *
 * WHY THIS IS A PLUGIN
 * --------------------
 * `apps/*​/android/` is gitignored, so anything hand-edited in there is thrown
 * away by the next `expo prebuild`. That is exactly how the splash-screen hang
 * shipped to the Play Store while local builds stayed fine (see
 * `withAndroidNoSystemSplash.js`). Release signing was the same hand edit, so
 * it lives here too — `pnpm android:release` keeps producing an upload-key
 * signed APK across prebuilds instead of silently reverting to the debug key.
 *
 * The credentials themselves stay OUT of git: the plugin only emits references
 * to `MARZI_UPLOAD_*` Gradle properties, which are set in the gitignored
 * `android/gradle.properties`. If those properties are absent (a fresh clone,
 * or an EAS build, which supplies credentials via `credentials.json` instead)
 * the release build falls back to the debug keystore exactly as the stock
 * template does.
 */
const SIGNING_CONFIG = `
        release {
            // Marzi upload key. Values come from the gitignored
            // android/gradle.properties; absent => fall back to debug signing.
            if (project.hasProperty('MARZI_UPLOAD_STORE_FILE')) {
                storeFile file(MARZI_UPLOAD_STORE_FILE)
                storePassword MARZI_UPLOAD_STORE_PASSWORD
                keyAlias MARZI_UPLOAD_KEY_ALIAS
                keyPassword MARZI_UPLOAD_KEY_PASSWORD
            }
        }
`;

const withAndroidReleaseSigning = (config) =>
  withAppBuildGradle(config, (config) => {
    let src = config.modResults.contents;

    if (src.includes('MARZI_UPLOAD_STORE_FILE')) {
      return config; // already applied
    }

    // 1. Add a `release` entry to signingConfigs, right after the `debug` one.
    const debugSigningBlock = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;
    if (!src.includes(debugSigningBlock)) {
      throw new Error(
        '[with-android-release-signing] Could not find the debug signingConfig ' +
          'block in app/build.gradle — the Expo template changed. Update this plugin.',
      );
    }
    src = src.replace(debugSigningBlock, debugSigningBlock + SIGNING_CONFIG);

    // 2. Point the release buildType at it when the properties are present.
    const templateReleaseSigning = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    if (!src.includes(templateReleaseSigning)) {
      throw new Error(
        '[with-android-release-signing] Could not find the release buildType ' +
          'signingConfig in app/build.gradle — the Expo template changed. Update this plugin.',
      );
    }
    src = src.replace(
      templateReleaseSigning,
      `            signingConfig project.hasProperty('MARZI_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );

    config.modResults.contents = src;
    return config;
  });

module.exports = createRunOncePlugin(withAndroidReleaseSigning, pkg.name, pkg.version);
