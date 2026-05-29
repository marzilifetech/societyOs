/**
 * Snapshot + behaviour tests for ScreenHeader.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
  },
}));

import { ScreenHeader } from '../src/components/ui/ScreenHeader';

describe('ScreenHeader', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
  });

  it('renders title only (default)', () => {
    const tree = render(<ScreenHeader title="Medical SOS" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders title + subtitle', () => {
    const tree = render(<ScreenHeader title="Medical SOS" subtitle="Tap to send alert" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders without back button when onBack={null}', () => {
    const { queryByLabelText } = render(<ScreenHeader title="Home" onBack={null} />);
    expect(queryByLabelText('Go back')).toBeNull();
  });

  it('calls onBack when provided', () => {
    const onBack = jest.fn();
    const { getByLabelText } = render(<ScreenHeader title="X" onBack={onBack} />);
    fireEvent.press(getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('falls back to router.back when no onBack passed and history exists', () => {
    const { getByLabelText } = render(<ScreenHeader title="X" />);
    fireEvent.press(getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('does not call router.back when canGoBack is false', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = render(<ScreenHeader title="X" />);
    fireEvent.press(getByLabelText('Go back'));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('renders trailing element', () => {
    const { Text } = require('react-native');
    const { getByText } = render(
      <ScreenHeader title="X" trailing={<Text>BADGE</Text>} />,
    );
    expect(getByText('BADGE')).toBeTruthy();
  });
});
