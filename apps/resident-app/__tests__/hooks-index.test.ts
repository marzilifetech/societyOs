/**
 * Barrel coverage for src/hooks/index.ts
 */

jest.mock('../src/lib/socket', () => ({
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
  getSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn() })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import * as hooksBarrel from '../src/hooks/index';

describe('hooks/index barrel', () => {
  it('exports useTheme', () => {
    expect(typeof hooksBarrel.useTheme).toBe('function');
  });

  it('exports useRealtime', () => {
    expect(typeof hooksBarrel.useRealtime).toBe('function');
  });
});
