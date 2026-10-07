jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import { render, screen, act, fireEvent } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  BootScreen,
  BOOT_BACKGROUND,
  SPINNER_DELAY_MS,
  REASSURE_DELAY_MS,
  ANDROID_SPLASH_ICON_DP,
} from '../src/components/BootScreen';
import { SplashMark, SPLASH_MARK_DOTS } from '../src/components/SplashMark';

/** BootScreen picks its logo per platform when it renders. */
function onPlatform(os: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', os);
}

describe('BootScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe.each(['ios', 'android'] as const)('on %s', (os) => {
    beforeEach(() => onPlatform(os));

    it('is the splash colour with only the logo at first — no spinner flash on fast launches', () => {
      render(<BootScreen />);
      expect(screen.getByTestId('boot-screen')).toHaveStyle({ backgroundColor: BOOT_BACKGROUND });
      expect(screen.getByTestId('boot-logo')).toBeTruthy();
      expect(screen.queryByTestId('boot-spinner')).toBeNull();
      expect(screen.queryByText(/still loading/i)).toBeNull();
    });

    it('centres the logo', () => {
      render(<BootScreen />);
      expect(screen.getByTestId('boot-screen')).toHaveStyle({
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    it('gives the logo EXPLICIT width and height', () => {
      // Regression: a required image gets its intrinsic 1024×1024 size as a
      // default width/height, which beats absolute-fill insets — the logo was
      // drawn at 1024dp from the corner with one dot visible.
      render(<BootScreen />);
      const style = StyleSheet.flatten(screen.getByTestId('boot-logo').props.style);
      expect(style.width).toBeDefined();
      expect(style.height).toBeDefined();
    });

    it('shows a spinner once launch is slow', () => {
      render(<BootScreen />);
      act(() => {
        jest.advanceTimersByTime(SPINNER_DELAY_MS);
      });
      expect(screen.getByTestId('boot-spinner')).toBeTruthy();
      expect(screen.queryByText(/still loading/i)).toBeNull();
    });

    it('reassures in words when launch is very slow', () => {
      render(<BootScreen />);
      act(() => {
        jest.advanceTimersByTime(REASSURE_DELAY_MS);
      });
      expect(screen.getByTestId('boot-spinner')).toBeTruthy();
      expect(screen.getByText('Please wait, still loading…')).toBeTruthy();
    });

    it('is announced to screen readers as loading', () => {
      render(<BootScreen />);
      const root = screen.getByTestId('boot-screen');
      expect(root.props.accessibilityLabel).toBe('Loading, please wait');
      expect(root.props.accessibilityRole).toBe('progressbar');
    });

    it('leaves no timers running after it unmounts', () => {
      const { unmount } = render(<BootScreen />);
      unmount();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('android', () => {
    beforeEach(() => onPlatform('android'));

    it('draws the mark with Views at the OS splash-icon size — no bitmap to decode', () => {
      render(<BootScreen />);
      expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
      expect(screen.getByTestId('boot-logo')).toHaveStyle({
        width: ANDROID_SPLASH_ICON_DP,
        height: ANDROID_SPLASH_ICON_DP,
      });
    });
  });

  describe('ios', () => {
    beforeEach(() => onPlatform('ios'));

    it('fills the screen with splash.png, contain — exactly like the native splash', () => {
      render(<BootScreen />);
      const logo = screen.getByTestId('boot-logo');
      expect(StyleSheet.flatten(logo.props.style)).toMatchObject({ width: '100%', height: '100%' });
      expect(logo.props.resizeMode).toBe('contain');
      expect(logo.props.fadeDuration).toBe(0);
    });

    it('hides the native splash once its logo has loaded, not before', () => {
      render(<BootScreen />);
      expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
      fireEvent(screen.getByTestId('boot-logo'), 'loadEnd');
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('matches app.json so the native splash hands over invisibly', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appJson = require('../app.json');
    expect(appJson.expo.splash.backgroundColor).toBe(BOOT_BACKGROUND);
    expect(appJson.expo.splash.resizeMode).toBe('contain');
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe(BOOT_BACKGROUND);
  });
});

describe('SplashMark', () => {
  type Dot = { left: number; top: number; width: number; height: number; borderRadius: number };

  function dotStyles(size: number): Dot[] {
    render(<SplashMark size={size} testID="mark" />);
    return screen
      .getByTestId('mark')
      .children.map(
        (child: unknown) =>
          StyleSheet.flatten((child as { props: { style: object } }).props.style) as Dot,
      );
  }

  it('draws the seven dots of the launcher mark', () => {
    expect(SPLASH_MARK_DOTS).toHaveLength(7);
    expect(dotStyles(ANDROID_SPLASH_ICON_DP)).toHaveLength(7);
  });

  it('every dot is a circle', () => {
    dotStyles(ANDROID_SPLASH_ICON_DP).forEach((s) => {
      expect(s.width).toBeCloseTo(s.height);
      expect(s.borderRadius).toBeCloseTo(s.width / 2);
    });
  });

  it('is ~122dp wide and centred in its 240dp box — the size measured on the OS splash', () => {
    const styles = dotStyles(ANDROID_SPLASH_ICON_DP);
    const left = Math.min(...styles.map((s) => s.left));
    const right = Math.max(...styles.map((s) => s.left + s.width));
    const top = Math.min(...styles.map((s) => s.top));
    const bottom = Math.max(...styles.map((s) => s.top + s.height));
    expect(right - left).toBeGreaterThan(118);
    expect(right - left).toBeLessThan(126);
    expect((left + right) / 2).toBeCloseTo(ANDROID_SPLASH_ICON_DP / 2, 0);
    expect((top + bottom) / 2).toBeCloseTo(ANDROID_SPLASH_ICON_DP / 2, 0);
  });

  it('scales with the box', () => {
    const styles = dotStyles(480);
    const widest = Math.max(...styles.map((s) => s.width));
    expect(widest).toBeCloseTo((184 * 480) / 1024);
  });
});
