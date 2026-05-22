/**
 * Tests for apps/resident-app/src/store/accessibility.store.ts
 */

import { useAccessibilityStore } from '../src/store/accessibility.store';

describe('useAccessibilityStore', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ seniorMode: false });
  });

  it('initial seniorMode is false', () => {
    expect(useAccessibilityStore.getState().seniorMode).toBe(false);
  });

  it('toggleSeniorMode flips from false to true', () => {
    useAccessibilityStore.getState().toggleSeniorMode();
    expect(useAccessibilityStore.getState().seniorMode).toBe(true);
  });

  it('toggleSeniorMode flips from true to false', () => {
    useAccessibilityStore.setState({ seniorMode: true });
    useAccessibilityStore.getState().toggleSeniorMode();
    expect(useAccessibilityStore.getState().seniorMode).toBe(false);
  });

  it('setSeniorMode sets to true', () => {
    useAccessibilityStore.getState().setSeniorMode(true);
    expect(useAccessibilityStore.getState().seniorMode).toBe(true);
  });

  it('setSeniorMode sets to false', () => {
    useAccessibilityStore.setState({ seniorMode: true });
    useAccessibilityStore.getState().setSeniorMode(false);
    expect(useAccessibilityStore.getState().seniorMode).toBe(false);
  });

  it('exposes toggleSeniorMode and setSeniorMode as functions', () => {
    const state = useAccessibilityStore.getState();
    expect(typeof state.toggleSeniorMode).toBe('function');
    expect(typeof state.setSeniorMode).toBe('function');
  });
});
