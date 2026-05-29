/**
 * Snapshot + behaviour tests for BottomActionBar.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/store/accessibility.store', () => ({
  useAccessibilityStore: (sel: any) =>
    sel({ seniorMode: false, toggleSeniorMode: jest.fn(), setSeniorMode: jest.fn() }),
}));

import { BottomActionBar } from '../src/components/ui/BottomActionBar';

describe('BottomActionBar', () => {
  it('primary-only snapshot', () => {
    const tree = render(
      <BottomActionBar primary={{ label: 'Send SOS', onPress: jest.fn() }} />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('primary + secondary snapshot', () => {
    const tree = render(
      <BottomActionBar
        primary={{ label: 'Confirm', onPress: jest.fn() }}
        secondary={{ label: 'Cancel', onPress: jest.fn(), variant: 'secondary' }}
      />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders helper text', () => {
    const { getByText } = render(
      <BottomActionBar
        primary={{ label: 'Send', onPress: jest.fn() }}
        helperText="A 4-digit OTP will be sent"
      />,
    );
    expect(getByText('A 4-digit OTP will be sent')).toBeTruthy();
  });

  it('calls primary onPress', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <BottomActionBar primary={{ label: 'Send SOS', onPress }} />,
    );
    fireEvent.press(getByLabelText('Send SOS'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls secondary onPress', () => {
    const sec = jest.fn();
    const { getByLabelText } = render(
      <BottomActionBar
        primary={{ label: 'OK', onPress: jest.fn() }}
        secondary={{ label: 'Cancel', onPress: sec }}
      />,
    );
    fireEvent.press(getByLabelText('Cancel'));
    expect(sec).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state on primary', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <BottomActionBar primary={{ label: 'Send', onPress, disabled: true }} />,
    );
    fireEvent.press(getByLabelText('Send'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
