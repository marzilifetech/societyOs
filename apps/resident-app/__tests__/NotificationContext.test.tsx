import React from 'react';
import { act, render } from '@testing-library/react-native';
import {
  NotificationProvider,
  useNotificationBanner,
  type BannerNotification,
} from '../src/contexts/NotificationContext';

const banner = (id: string, type = 'notices'): BannerNotification => ({
  id,
  title: id,
  body: '',
  type,
  data: {},
});

let api: ReturnType<typeof useNotificationBanner>;
function Probe() {
  api = useNotificationBanner();
  return null;
}

function setup() {
  return render(
    <NotificationProvider>
      <Probe />
    </NotificationProvider>,
  );
}

describe('NotificationProvider', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps BOTH banners when two pushes land in the same frame', () => {
    setup();
    act(() => {
      api.showBanner(banner('a'));
      api.showBanner(banner('b'));
    });
    expect(api.current?.id).toBe('a');
    act(() => api.dismiss());
    expect(api.current?.id).toBe('b');
  });

  it('lets an SOS take the screen at once; the interrupted banner comes back next', () => {
    setup();
    act(() => api.showBanner(banner('notice')));
    act(() => api.showBanner(banner('sos', 'emergency_sos')));
    expect(api.current?.id).toBe('sos');
    act(() => api.dismiss());
    expect(api.current?.id).toBe('notice');
  });

  it('never auto-dismisses an SOS', () => {
    setup();
    act(() => api.showBanner(banner('sos', 'SOS')));
    act(() => jest.advanceTimersByTime(60_000));
    expect(api.current?.id).toBe('sos');
  });

  it('auto-dismisses routine banners and shows the next one', () => {
    setup();
    act(() => {
      api.showBanner(banner('a'));
      api.showBanner(banner('b'));
    });
    act(() => jest.advanceTimersByTime(4_000));
    expect(api.current?.id).toBe('b');
    act(() => jest.advanceTimersByTime(4_000));
    expect(api.current).toBeNull();
  });

  it('leaves no timer behind on unmount', () => {
    const { unmount } = setup();
    act(() => api.showBanner(banner('a')));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
