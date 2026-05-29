/**
 * Snapshot + behaviour tests for RadioCard.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { RadioCard } from '../src/components/ui/RadioCard';

describe('RadioCard', () => {
  it('unselected snapshot', () => {
    const tree = render(
      <RadioCard title="Plumbing" subtitle="Tap, leak, fitting" selected={false} onPress={jest.fn()} icon="water" />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('selected snapshot', () => {
    const tree = render(
      <RadioCard title="Plumbing" subtitle="Tap, leak, fitting" selected onPress={jest.fn()} icon="water" />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('disabled snapshot', () => {
    const tree = render(
      <RadioCard title="Plumbing" selected={false} onPress={jest.fn()} disabled />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('calls onPress', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<RadioCard title="Pick" selected={false} onPress={onPress} />);
    fireEvent.press(getByRole('radio'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<RadioCard title="Pick" selected={false} onPress={onPress} disabled />);
    fireEvent.press(getByRole('radio'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports selected state via accessibilityState', () => {
    const { getByRole } = render(<RadioCard title="X" selected onPress={jest.fn()} />);
    const node = getByRole('radio');
    expect(node.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});
