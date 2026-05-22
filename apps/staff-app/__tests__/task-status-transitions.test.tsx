/**
 * Component test: task status transition. Tests the contract that the
 * pressable status button calls onChange with the right next-state.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import React from 'react';

const NEXT: Record<string, string> = {
  PENDING: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

function StatusButton({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const next = NEXT[status];
  if (!next) return <Text>Done</Text>;
  return (
    <Pressable accessibilityRole="button" onPress={() => onChange(next)} testID="status-btn">
      <Text>{`Move to ${next}`}</Text>
    </Pressable>
  );
}

describe('Task status transitions', () => {
  it('PENDING button advances to IN_PROGRESS', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<StatusButton status="PENDING" onChange={onChange} />);
    fireEvent.press(getByTestId('status-btn'));
    expect(onChange).toHaveBeenCalledWith('IN_PROGRESS');
  });

  it('IN_PROGRESS advances to COMPLETED', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<StatusButton status="IN_PROGRESS" onChange={onChange} />);
    fireEvent.press(getByTestId('status-btn'));
    expect(onChange).toHaveBeenCalledWith('COMPLETED');
  });

  it('COMPLETED renders Done text and no button', () => {
    const { queryByTestId, getByText } = render(<StatusButton status="COMPLETED" onChange={() => {}} />);
    expect(queryByTestId('status-btn')).toBeNull();
    expect(getByText('Done')).toBeTruthy();
  });
});
