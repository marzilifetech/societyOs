/**
 * Swapping the Android window background from the launch splash to plain
 * white once a real screen is up — exactly once, never on iOS, and never
 * before the screen has had time to draw.
 */

const mockSetBackground = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: (...a: unknown[]) => mockSetBackground(...a),
}));

import { Platform } from 'react-native';
import {
  settleWindowBackground,
  APP_WINDOW_BACKGROUND,
  SETTLE_AFTER_SCREEN_MS,
  SETTLE_FALLBACK_MS,
  __resetWindowBackgroundForTests,
} from '../src/lib/window-background';

describe('settleWindowBackground', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetBackground.mockReset().mockResolvedValue(undefined);
    __resetWindowBackgroundForTests();
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('turns the window white after the screen has had time to draw', () => {
    settleWindowBackground();
    jest.advanceTimersByTime(SETTLE_AFTER_SCREEN_MS - 1);
    expect(mockSetBackground).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockSetBackground).toHaveBeenCalledWith(APP_WINDOW_BACKGROUND);
  });

  it('happens once, however many screens ask', () => {
    settleWindowBackground();
    settleWindowBackground();
    settleWindowBackground(SETTLE_FALLBACK_MS);
    jest.runAllTimers();
    expect(mockSetBackground).toHaveBeenCalledTimes(1);
    settleWindowBackground();
    jest.runAllTimers();
    expect(mockSetBackground).toHaveBeenCalledTimes(1);
  });

  it('a screen that unmounts first cancels its pending swap', () => {
    const cancel = settleWindowBackground();
    cancel();
    jest.runAllTimers();
    expect(mockSetBackground).not.toHaveBeenCalled();
  });

  it('retries on a later screen if the native call failed', async () => {
    mockSetBackground.mockRejectedValueOnce(new Error('no activity'));
    settleWindowBackground();
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();
    settleWindowBackground();
    jest.runAllTimers();
    expect(mockSetBackground).toHaveBeenCalledTimes(2);
  });

  it('does nothing on iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    settleWindowBackground();
    jest.runAllTimers();
    expect(mockSetBackground).not.toHaveBeenCalled();
  });
});
