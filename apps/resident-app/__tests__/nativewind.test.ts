/**
 * Tests for apps/resident-app/src/lib/nativewind.ts
 * Verifies that cssInterop is called with SafeAreaView on module load.
 */

const mockCssInterop = jest.fn();

jest.mock('nativewind', () => ({
  cssInterop: mockCssInterop,
}));

const mockSafeAreaView = {};
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: mockSafeAreaView,
}));

describe('nativewind.ts', () => {
  it('calls cssInterop with SafeAreaView and className mapping on import', () => {
    require('../src/lib/nativewind');
    const { SafeAreaView } = require('react-native-safe-area-context');
    expect(mockCssInterop).toHaveBeenCalledWith(SafeAreaView, { className: 'style' });
  });
});
