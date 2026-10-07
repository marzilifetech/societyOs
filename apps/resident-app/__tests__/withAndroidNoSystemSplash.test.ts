/**
 * The Android window background drawn between the OS splash and the app's
 * first frame. It must put the same logo in the same place as the OS splash
 * and the in-app BootScreen, or the logo jumps (or vanishes) during launch.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WINDOW_BACKGROUND_XML } = require('../plugins/withAndroidNoSystemSplash');
import { ANDROID_SPLASH_ICON_DP } from '../src/components/BootScreen';

describe('withAndroidNoSystemSplash — window background', () => {
  it('is the splash colour with the launcher foreground on top', () => {
    expect(WINDOW_BACKGROUND_XML).toContain(
      '<item android:drawable="@color/splashscreen_background" />',
    );
    expect(WINDOW_BACKGROUND_XML).toContain('android:drawable="@mipmap/ic_launcher_foreground"');
  });

  it('draws the logo at the same size and position as the OS splash and BootScreen', () => {
    expect(WINDOW_BACKGROUND_XML).toContain(`android:width="${ANDROID_SPLASH_ICON_DP}dp"`);
    expect(WINDOW_BACKGROUND_XML).toContain(`android:height="${ANDROID_SPLASH_ICON_DP}dp"`);
    expect(WINDOW_BACKGROUND_XML).toContain('android:gravity="center"');
  });
});
