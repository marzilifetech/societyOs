/**
 * Tests for apps/resident-app/src/components/ErrorBoundary.tsx
 *
 * ErrorBoundary is a class component tested by rendering a child that throws.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

jest.mock('../src/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));
import { Sentry } from '../src/lib/sentry';
const mockCaptureException = Sentry.captureException as jest.Mock;

// Suppress React's error boundary console output in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Error boundaries')) return;
    if (typeof args[0] === 'string' && args[0].includes('The above error occurred')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => { console.error = originalConsoleError; });

function Boom({ message = 'test error' }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

function Fine() {
  return <Text>All good</Text>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary><Fine /></ErrorBoundary>,
    );
    expect(getByText('All good')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary><Boom /></ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('test error')).toBeTruthy();
  });

  it('calls Sentry.captureException in componentDidCatch', () => {
    render(<ErrorBoundary><Boom message="crash!" /></ErrorBoundary>);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'crash!' }),
      expect.objectContaining({ extra: expect.any(Object) }),
    );
  });

  it('reset() clears the error and shows children again', () => {
    const { getByText, rerender } = render(
      <ErrorBoundary><Boom /></ErrorBoundary>,
    );
    // Swap to non-throwing children while error UI is still shown,
    // so reset() won't trigger a re-throw cycle
    rerender(<ErrorBoundary><Fine /></ErrorBoundary>);
    fireEvent.press(getByText('Retry'));
    expect(getByText('All good')).toBeTruthy();
  });

  it('report() calls Sentry.captureException with user-report tag then resets', () => {
    const { getByLabelText, rerender } = render(
      <ErrorBoundary><Boom message="user-visible error" /></ErrorBoundary>,
    );
    // Swap children before pressing report, so reset() won't trigger a re-throw
    rerender(<ErrorBoundary><Fine /></ErrorBoundary>);
    fireEvent.press(getByLabelText('Report issue'));
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'user-visible error' }),
      expect.objectContaining({ tags: { source: 'user-report' } }),
    );
  });

  it('report() is a no-op when there is no error', () => {
    const ref = React.createRef<ErrorBoundary>();
    render(<ErrorBoundary ref={ref}><Fine /></ErrorBoundary>);
    // Manually call report — should not throw
    expect(() => ref.current?.report()).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('swallows Sentry errors in componentDidCatch gracefully', () => {
    mockCaptureException.mockImplementationOnce(() => { throw new Error('Sentry down'); });
    expect(() => render(<ErrorBoundary><Boom /></ErrorBoundary>)).not.toThrow();
  });

  it('swallows Sentry errors in report() gracefully', () => {
    mockCaptureException
      .mockImplementationOnce(() => {}) // componentDidCatch call is ok
      .mockImplementationOnce(() => { throw new Error('Sentry down'); }); // report() throws
    const { getByLabelText } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(() => fireEvent.press(getByLabelText('Report issue'))).not.toThrow();
  });
});
