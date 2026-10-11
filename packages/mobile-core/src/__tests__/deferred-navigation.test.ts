import { createDeferredNavigator } from '../deferred-navigation';

describe('createDeferredNavigator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds a request made before the shell is ready and runs it after markReady', () => {
    const navigate = jest.fn();
    const nav = createDeferredNavigator(navigate);
    nav.navigateWhenReady('/tasks/1');
    expect(navigate).not.toHaveBeenCalled();
    nav.markReady();
    expect(navigate).not.toHaveBeenCalled(); // next tick, after the mount commits
    jest.runAllTimers();
    expect(navigate).toHaveBeenCalledWith('/tasks/1');
  });

  it('keeps only the latest held request', () => {
    const navigate = jest.fn();
    const nav = createDeferredNavigator(navigate);
    nav.navigateWhenReady('/a');
    nav.navigateWhenReady('/b');
    nav.markReady();
    jest.runAllTimers();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/b');
  });

  it('navigates immediately once ready, and holds again after the shell unmounts', () => {
    const navigate = jest.fn();
    const nav = createDeferredNavigator(navigate);
    const cleanup = nav.markReady();
    nav.navigateWhenReady('/now');
    expect(navigate).toHaveBeenCalledWith('/now');
    cleanup();
    nav.navigateWhenReady('/later');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('drops a held route when cleared (sign-out)', () => {
    const navigate = jest.fn();
    const nav = createDeferredNavigator(navigate);
    nav.navigateWhenReady('/tasks/1');
    nav.clearPending();
    nav.markReady();
    jest.runAllTimers();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels the held route if the shell unmounts before the tick', () => {
    const navigate = jest.fn();
    const nav = createDeferredNavigator(navigate);
    nav.navigateWhenReady('/tasks/1');
    const cleanup = nav.markReady();
    cleanup();
    jest.runAllTimers();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('swallows a navigator throw instead of crashing the caller', () => {
    const nav = createDeferredNavigator(() => {
      throw new Error('Attempted to navigate before mounting');
    });
    nav.markReady();
    expect(() => nav.navigateWhenReady('/x')).not.toThrow();
  });
});
