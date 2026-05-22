/**
 * Snapshot + behaviour tests for ThemedButton.
 * Uses the real defaultTokens/seniorTokens via useAccessibilityStore mock.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

// Let real tokens flow through useTheme — only stub the store
jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { ThemedButton } from '../src/components/ui/ThemedButton';

describe('ThemedButton', () => {
  it('primary variant (default) snapshot', () => {
    const tree = render(<ThemedButton label="Pay" onPress={jest.fn()} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('secondary variant snapshot', () => {
    const tree = render(<ThemedButton label="Cancel" onPress={jest.fn()} variant="secondary" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('ghost variant snapshot', () => {
    const tree = render(<ThemedButton label="Skip" onPress={jest.fn()} variant="ghost" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('danger variant snapshot', () => {
    const tree = render(<ThemedButton label="Delete" onPress={jest.fn()} variant="danger" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('sm size snapshot', () => {
    const tree = render(<ThemedButton label="Small" onPress={jest.fn()} size="sm" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('lg size snapshot', () => {
    const tree = render(<ThemedButton label="Large" onPress={jest.fn()} size="lg" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('loading state shows ActivityIndicator', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <ThemedButton label="Load" onPress={jest.fn()} loading />,
    );
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('disabled primary renders with dimmed background', () => {
    const tree = render(<ThemedButton label="Disabled" onPress={jest.fn()} disabled />).toJSON() as any;
    expect(tree).toMatchSnapshot();
  });

  it('disabled danger renders with dimmed background', () => {
    const tree = render(<ThemedButton label="Delete" onPress={jest.fn()} variant="danger" disabled />).toJSON() as any;
    expect(tree).toMatchSnapshot();
  });

  it('fullWidth=false renders without width:100%', () => {
    const tree = render(<ThemedButton label="Inline" onPress={jest.fn()} fullWidth={false} />).toJSON() as any;
    expect(tree.props.style).not.toContain(expect.objectContaining({ width: '100%' }));
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<ThemedButton label="Tap me" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<ThemedButton label="Disabled" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses custom accessibilityLabel when provided', () => {
    const { getByLabelText } = render(
      <ThemedButton label="Pay" onPress={jest.fn()} accessibilityLabel="Pay now" />,
    );
    expect(getByLabelText('Pay now')).toBeTruthy();
  });
});
