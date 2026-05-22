/**
 * Snapshot + interaction tests for SeniorModeToggle.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

const mockToggle = jest.fn();

// We control mockSeniorMode via a mutable variable so we can test both states
let mockSeniorMode = false;

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: () => ({
    seniorMode: mockSeniorMode,
    toggleSeniorMode: mockToggle,
    setSeniorMode: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useTheme', () => ({
  useTheme: () => {
    const { defaultTokens } = require('../src/theme/tokens');
    return defaultTokens;
  },
}));

import { SeniorModeToggle } from '../src/components/ui/SeniorModeToggle';

describe('SeniorModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeniorMode = false;
  });

  it('renders in OFF state snapshot', () => {
    const tree = render(<SeniorModeToggle />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders in ON state snapshot (shows ON badge)', () => {
    mockSeniorMode = true;
    const tree = render(<SeniorModeToggle />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('shows "ON" badge text when seniorMode is true', () => {
    mockSeniorMode = true;
    const { getByText } = render(<SeniorModeToggle />);
    expect(getByText('ON')).toBeTruthy();
  });

  it('does not show "ON" badge when seniorMode is false', () => {
    mockSeniorMode = false;
    const { queryByText } = render(<SeniorModeToggle />);
    expect(queryByText('ON')).toBeNull();
  });

  it('shows correct description text when ON', () => {
    mockSeniorMode = true;
    const { getByText } = render(<SeniorModeToggle />);
    expect(getByText('Large text, bigger buttons, higher contrast active')).toBeTruthy();
  });

  it('shows correct description text when OFF', () => {
    mockSeniorMode = false;
    const { getByText } = render(<SeniorModeToggle />);
    expect(getByText('Increase text size and button targets for easier use')).toBeTruthy();
  });

  it('calls toggleSeniorMode when the outer button is pressed', () => {
    const { getByLabelText } = render(<SeniorModeToggle />);
    fireEvent.press(getByLabelText('Senior Mode'));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
