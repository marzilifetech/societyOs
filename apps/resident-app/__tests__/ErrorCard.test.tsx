/**
 * Tests for apps/resident-app/src/components/ErrorCard.tsx
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorCard } from '../src/components/ErrorCard';

describe('ErrorCard', () => {
  it('renders default message when none provided', () => {
    const { getByText } = render(<ErrorCard />);
    expect(getByText(/Something didn't load/)).toBeTruthy();
  });

  it('renders custom message', () => {
    const { getByText } = render(<ErrorCard message="Custom error message" />);
    expect(getByText('Custom error message')).toBeTruthy();
  });

  it('renders the hint text', () => {
    const { getByText } = render(<ErrorCard />);
    expect(getByText(/If this keeps happening/)).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(<ErrorCard onRetry={onRetry} />);
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('does not render retry button when onRetry is absent', () => {
    const { queryByText } = render(<ErrorCard />);
    expect(queryByText('Try Again')).toBeNull();
  });

  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(<ErrorCard onRetry={onRetry} />);
    fireEvent.press(getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses custom retryLabel', () => {
    const { getByText } = render(<ErrorCard onRetry={jest.fn()} retryLabel="Reload" />);
    expect(getByText('Reload')).toBeTruthy();
  });

  it('snapshot without retry button', () => {
    const tree = render(<ErrorCard message="Oops" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('snapshot with retry button', () => {
    const tree = render(<ErrorCard message="Oops" onRetry={jest.fn()} retryLabel="Retry" />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
