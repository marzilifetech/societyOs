/**
 * Tests for apps/resident-app/src/hooks/useRealtime.ts
 *
 * Realtime events refresh cached screens and nothing else: society-wide
 * events (an emergency broadcast, a visitor at another flat) used to pop an
 * Alert over whatever the resident was doing, and the hook replaced the
 * foreground notification handler so every push showed twice.
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The suite-wide setup stubs react-query; this hook needs the real client.
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

const mockListeners: Record<string, (data: unknown) => void> = {};
const mockUnsubscribe = jest.fn();
jest.mock('../src/lib/socket', () => ({
  subscribe: jest.fn((event: string, listener: (data: unknown) => void) => {
    mockListeners[event] = listener;
    return mockUnsubscribe;
  }),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRealtime } from '../src/hooks/useRealtime';

function mount() {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  const hook = renderHook(() => useRealtime(), { wrapper });
  return { ...hook, invalidate };
}

describe('useRealtime', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockListeners)) delete mockListeners[k];
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alert.mockRestore());

  it('never replaces the foreground notification handler', () => {
    mount();
    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
  });

  it.each([
    ['emergency:broadcast', ['notices']],
    ['visitor:arrived', ['my-visitors']],
    ['complaint:updated', ['my-complaints']],
    ['package:arrived', ['packages']],
    ['service-request:updated', ['my-service-requests']],
    ['maintenance:due', ['maintenance-bills']],
  ])('%s refreshes %j without a popup or a local notification', (event, key) => {
    const { invalidate } = mount();
    mockListeners[event]({ message: 'Water off 2-4pm' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    expect(alert).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('unsubscribes everything on unmount', () => {
    const { unmount } = mount();
    const subscribed = Object.keys(mockListeners).length;
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(subscribed);
  });
});
