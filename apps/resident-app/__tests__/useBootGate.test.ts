import { renderHook, act } from '@testing-library/react-native';
import { useBootGate, FONT_WAIT_MS } from '../src/hooks/useBootGate';

type Props = { isHydrated: boolean; fontsSettled: boolean };

function renderGate(initial: Props) {
  return renderHook((props: Props) => useBootGate(props), { initialProps: initial });
}

describe('useBootGate', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
  });

  it('is closed until the session is known', () => {
    const { result } = renderGate({ isHydrated: false, fontsSettled: true });
    expect(result.current).toBe(false);
  });

  it('opens as soon as the session is known and fonts are settled', () => {
    const { result, rerender } = renderGate({ isHydrated: false, fontsSettled: true });
    rerender({ isHydrated: true, fontsSettled: true });
    expect(result.current).toBe(true);
  });

  it('never opens on fonts alone — that would route a signed-in resident to sign-in', () => {
    const { result } = renderGate({ isHydrated: false, fontsSettled: false });
    act(() => {
      jest.advanceTimersByTime(FONT_WAIT_MS * 10);
    });
    expect(result.current).toBe(false);
  });

  it('stops waiting for fonts after FONT_WAIT_MS', () => {
    const { result } = renderGate({ isHydrated: true, fontsSettled: false });
    act(() => {
      jest.advanceTimersByTime(FONT_WAIT_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[boot] fonts not ready'));
  });

  it('counts the font wait from launch, not from when hydration finished', () => {
    const { result, rerender } = renderGate({ isHydrated: false, fontsSettled: false });
    act(() => {
      jest.advanceTimersByTime(FONT_WAIT_MS);
    });
    rerender({ isHydrated: true, fontsSettled: false });
    expect(result.current).toBe(true);
  });

  it('does not log or schedule anything when fonts are already loaded', () => {
    renderGate({ isHydrated: true, fontsSettled: true });
    expect(jest.getTimerCount()).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('cancels its timer on unmount', () => {
    const { unmount } = renderGate({ isHydrated: false, fontsSettled: false });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stress: across 500 random launch sequences it never closes again once open', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };

    for (let run = 0; run < 500; run += 1) {
      let props: Props = { isHydrated: false, fontsSettled: false };
      const { result, rerender, unmount } = renderGate(props);
      let opened = false;

      for (let step = 0; step < 12; step += 1) {
        // Inputs only ever flip false → true, in any order, at any time.
        props = {
          isHydrated: props.isHydrated || random() < 0.25,
          fontsSettled: props.fontsSettled || random() < 0.2,
        };
        act(() => {
          rerender(props);
          jest.advanceTimersByTime(Math.floor(random() * 1500));
        });
        if (opened) expect(result.current).toBe(true);
        if (result.current) {
          expect(props.isHydrated).toBe(true);
          opened = true;
        }
      }
      unmount();
    }
  });
});
