import React from 'react';
import { act, render } from '@testing-library/react-native';
import {
  NotificationProvider,
  useNotificationBanner,
  type BannerNotification,
} from '../src/contexts/NotificationContext';
import { useAuthStore } from '../src/store/auth.store';

const banner = (id: string, type = 'staff_tasks'): BannerNotification => ({
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
  render(
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
    act(() => api.showBanner(banner('task')));
    act(() => api.showBanner(banner('sos', 'emergency_sos')));
    expect(api.current?.id).toBe('sos');
    act(() => api.dismiss());
    expect(api.current?.id).toBe('task');
  });

  it('never auto-dismisses an SOS', () => {
    setup();
    act(() => api.showBanner(banner('sos', 'SOS_TRIGGERED')));
    act(() => jest.advanceTimersByTime(60_000));
    expect(api.current?.id).toBe('sos');
  });

  it('auto-dismisses routine banners and shows the next one', () => {
    setup();
    act(() => {
      api.showBanner(banner('a'));
      api.showBanner(banner('b'));
    });
    act(() => jest.advanceTimersByTime(10_000));
    expect(api.current?.id).toBe('b');
    act(() => jest.advanceTimersByTime(10_000));
    expect(api.current).toBeNull();
  });
});

describe('NotificationProvider — emergencies and sign-out', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthStore.setState({ token: 'tok' });
  });
  afterEach(() => {
    jest.useRealTimers();
    useAuthStore.setState({ token: null });
  });

  it('puts a second SOS ahead of routine banners already waiting', () => {
    setup();
    act(() => {
      api.showBanner(banner('sos1', 'emergency_sos'));
      api.showBanner(banner('task1'));
      api.showBanner(banner('task2'));
      api.showBanner(banner('sos2', 'emergency_sos'));
      api.showBanner(banner('sos3', 'emergency_sos'));
    });
    expect(api.current?.id).toBe('sos1');
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      act(() => api.dismiss());
      order.push(api.current!.id);
    }
    expect(order).toEqual(['sos2', 'sos3', 'task1', 'task2']);
  });

  it('never drops an SOS when the queue is full', () => {
    setup();
    act(() => {
      api.showBanner(banner('sos1', 'emergency_sos'));
      for (let i = 0; i < 5; i++) api.showBanner(banner(`task${i}`));
      api.showBanner(banner('sos2', 'emergency_sos'));
    });
    act(() => api.dismiss());
    expect(api.current?.id).toBe('sos2');
  });

  it('clears the banner and the queue on sign-out', () => {
    setup();
    act(() => {
      api.showBanner(banner('sos1', 'emergency_sos'));
      api.showBanner(banner('task1'));
    });
    act(() => useAuthStore.setState({ token: null }));
    expect(api.current).toBeNull();
    act(() => useAuthStore.setState({ token: 'tok2' }));
    act(() => api.dismiss());
    expect(api.current).toBeNull();
  });
});
