const {
  withMainActivity,
  withAndroidManifest,
  withAndroidStyles,
  AndroidConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

const pkg = { name: 'with-android-no-system-splash', version: '1.0.0' };

const SPLASH_BACKGROUND = '@color/splashscreen_background';

/**
 * Disables expo-splash-screen's androidx system-splash management on Android.
 *
 * WHY THIS EXISTS
 * ---------------
 * `SplashScreenManager.registerOnActivity(this)` (injected into MainActivity by
 * @expo/prebuild-config) calls `installSplashScreen()` AND installs an
 * `OnPreDrawListener` that returns `false` — blocking EVERY draw pass of the
 * activity's content view — until JS calls `SplashScreen.hideAsync()`.
 *
 * `hide()` only flips a boolean; it does not itself schedule a redraw. On
 * Android 15 with edge-to-edge + the New Architecture that combination is
 * unreliable: the splash window fails to auto-dismiss and the app sits on the
 * maroon splash forever even though JS is running fine. It reproduces on
 * OnePlus/OxygenOS in particular.
 *
 * The workaround (previously applied by hand to `android/`, which is gitignored
 * and therefore silently reverted by every `expo prebuild` / EAS build — this
 * is why Play Store builds hung while local builds worked) is three coupled
 * edits, all of which must be applied together:
 *
 *   1. Remove the `registerOnActivity` call from MainActivity.
 *   2. Point MainActivity at `@style/AppTheme` instead of
 *      `@style/Theme.App.SplashScreen`. `Theme.App.SplashScreen` relies on
 *      `installSplashScreen()` to swap in `postSplashScreenTheme`; without
 *      step 1's call that swap never happens and the app would be stuck on the
 *      system splash instead.
 *   3. Give `AppTheme` a maroon `android:windowBackground` so the OS's own
 *      transient launch window matches the brand splash — no white flash.
 *
 * The OS still shows its own launch splash from the theme, and it dismisses
 * reliably because nothing is holding back the first frame.
 */
function withNoSplashScreenManager(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // The call ships inside a mergeContents-generated block.
    src = src.replace(
      /[ \t]*\/\/ @generated begin expo-splashscreen[\s\S]*?\/\/ @generated end expo-splashscreen[ \t]*\r?\n/g,
      '',
    );
    // Belt and braces if the marker shape ever changes upstream.
    src = src.replace(
      /^[ \t]*SplashScreenManager\.registerOnActivity\(this\);?[ \t]*\r?\n/gm,
      '',
    );
    // The import is dead once the call is gone.
    src = src.replace(
      /^[ \t]*import expo\.modules\.splashscreen\.SplashScreenManager[ \t]*\r?\n/gm,
      '',
    );

    if (src.includes('registerOnActivity')) {
      throw new Error(
        '[with-android-no-system-splash] Could not strip ' +
          'SplashScreenManager.registerOnActivity from MainActivity. The upstream ' +
          'expo-splash-screen plugin changed shape — update this plugin before ' +
          'shipping, or the app will hang on the splash screen.',
      );
    }

    config.modResults.contents = src;
    return config;
  });
}

function withAppThemeOnMainActivity(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const activity = application.activity?.find((a) => a.$['android:name'] === '.MainActivity');

    if (!activity) {
      throw new Error(
        '[with-android-no-system-splash] .MainActivity not found in AndroidManifest.xml.',
      );
    }

    activity.$['android:theme'] = '@style/AppTheme';
    return config;
  });
}

function withSplashColoredWindowBackground(config) {
  return withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources?.style?.find(({ $ }) => $.name === 'AppTheme');

    if (!appTheme) {
      throw new Error('[with-android-no-system-splash] AppTheme not found in styles.xml.');
    }

    appTheme.item = [
      ...(appTheme.item ?? []).filter(({ $ }) => $.name !== 'android:windowBackground'),
      { $: { name: 'android:windowBackground' }, _: SPLASH_BACKGROUND },
    ];
    return config;
  });
}

const withAndroidNoSystemSplash = (config) =>
  withSplashColoredWindowBackground(withAppThemeOnMainActivity(withNoSplashScreenManager(config)));

module.exports = createRunOncePlugin(withAndroidNoSystemSplash, pkg.name, pkg.version);
