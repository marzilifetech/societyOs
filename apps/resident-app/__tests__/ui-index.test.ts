/**
 * Barrel coverage for src/components/ui/index.ts
 */

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import * as uiBarrel from '../src/components/ui/index';

describe('components/ui/index barrel', () => {
  it('exports ThemedButton', () => {
    expect(typeof uiBarrel.ThemedButton).toBe('function');
  });

  it('exports ThemedCard', () => {
    expect(typeof uiBarrel.ThemedCard).toBe('function');
  });

  it('exports ThemedText', () => {
    expect(typeof uiBarrel.ThemedText).toBe('function');
  });

  it('exports SeniorModeToggle', () => {
    expect(typeof uiBarrel.SeniorModeToggle).toBe('function');
  });

  it('exports ScreenHeader', () => {
    expect(typeof uiBarrel.ScreenHeader).toBe('function');
  });

  it('exports BottomActionBar', () => {
    expect(typeof uiBarrel.BottomActionBar).toBe('function');
  });

  it('exports StatusChip', () => {
    expect(typeof uiBarrel.StatusChip).toBe('function');
  });

  it('exports RadioCard', () => {
    expect(typeof uiBarrel.RadioCard).toBe('function');
  });
});
