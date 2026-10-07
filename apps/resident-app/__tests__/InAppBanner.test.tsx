/**
 * The foreground notification banner — how a resident with the app open
 * learns a visitor is at the gate. It must be ON SCREEN the moment it mounts:
 * it used to start 200dp above the screen and rely on an animation to slide
 * in, which never ran on device, so the alert stayed hidden.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue(undefined) } }));

import { InAppBanner } from '../src/components/InAppBanner';
import {
  NotificationProvider,
  useNotificationBanner,
  type BannerNotification,
} from '../src/contexts/NotificationContext';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let show: ((n: BannerNotification) => void) | null = null;
let dismiss: (() => void) | null = null;
function Capture() {
  const ctx = useNotificationBanner();
  useEffect(() => {
    show = ctx.showBanner;
    dismiss = ctx.dismiss;
  }, [ctx.showBanner, ctx.dismiss]);
  return null;
}

function renderBanner() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <NotificationProvider>
        <Capture />
        <InAppBanner />
      </NotificationProvider>
    </SafeAreaProvider>,
  );
}

/** Every translateY on the banner's ancestors-or-self, flattened. */
function translateYOf(text: string): number[] {
  const values: number[] = [];
  let node: any = screen.getByText(text);
  while (node) {
    const style = StyleSheet.flatten(node.props?.style);
    for (const t of style?.transform ?? []) {
      if ('translateY' in t) {
        const v = (t as any).translateY;
        values.push(typeof v === 'object' && v && '__getValue' in v ? v.__getValue() : Number(v));
      }
    }
    node = node.parent;
  }
  return values;
}

describe('InAppBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    show = null;
  });
  afterEach(() => jest.useRealTimers());

  it('renders nothing until a notification arrives', () => {
    renderBanner();
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('is on screen the moment a notification arrives — not parked above it', () => {
    renderBanner();
    act(() => {
      show!({
        id: 'n1',
        title: 'Visitor at the gate',
        body: 'Ravi Kumar is waiting',
        type: 'visitor_approvals',
        data: {},
      });
    });
    expect(screen.getByText('Visitor at the gate')).toBeTruthy();
    expect(screen.getByText('Ravi Kumar is waiting')).toBeTruthy();
    const offsets = translateYOf('Visitor at the gate');
    expect(offsets.length).toBeGreaterThan(0);
    offsets.forEach((y) => expect(y).toBe(0));
  });

  it('a queued notification also appears in place once the first is dismissed', () => {
    renderBanner();
    act(() => {
      show!({ id: 'n1', title: 'First', body: 'one', data: {} });
    });
    act(() => {
      show!({ id: 'n2', title: 'Second', body: 'two', data: {} }); // queued behind the first
    });
    expect(screen.queryByText('Second')).toBeNull();
    act(() => {
      dismiss!();
    });
    expect(screen.getByText('Second')).toBeTruthy();
    translateYOf('Second').forEach((y) => expect(y).toBe(0));
  });
});
