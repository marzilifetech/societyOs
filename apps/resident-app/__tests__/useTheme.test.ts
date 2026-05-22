/**
 * Tests for apps/resident-app/src/hooks/useTheme.ts
 * Covers both branches: defaultTokens (seniorMode=false) and seniorTokens (seniorMode=true).
 */

import { renderHook } from '@testing-library/react-native';

let mockSeniorMode = false;

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: mockSeniorMode, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { useTheme } from '../src/hooks/useTheme';
import { defaultTokens, seniorTokens } from '../src/theme/tokens';

describe('useTheme', () => {
  it('returns defaultTokens when seniorMode is false', () => {
    mockSeniorMode = false;
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(defaultTokens);
  });

  it('returns seniorTokens when seniorMode is true', () => {
    mockSeniorMode = true;
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(seniorTokens);
  });

  it('defaultTokens fontBase is 16', () => {
    mockSeniorMode = false;
    const { result } = renderHook(() => useTheme());
    expect(result.current.fontBase).toBe(16);
  });

  it('seniorTokens fontBase is 20', () => {
    mockSeniorMode = true;
    const { result } = renderHook(() => useTheme());
    expect(result.current.fontBase).toBe(20);
  });
});
