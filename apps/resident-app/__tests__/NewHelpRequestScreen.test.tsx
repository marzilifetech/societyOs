/**
 * Behaviour test for the redesigned New Help Request screen.
 * Validates the ScreenHeader title/subtitle, RadioCard category list,
 * urgency picker, and submit-button gating.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

const mockApiPost = jest.fn().mockResolvedValue({ id: 'hr-1' });
jest.mock('../src/lib/api', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (opts: any) => ({
    mutate: async (body: any) => {
      try {
        const result = await opts.mutationFn(body);
        opts.onSuccess?.(result);
      } catch (err) {
        opts.onError?.(err);
      }
    },
    isPending: false,
  }),
}));

import NewHelpRequestScreen from '../app/help-requests/new';

describe('NewHelpRequestScreen (redesigned)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockApiPost.mockClear();
  });

  it('renders ScreenHeader, all RadioCard categories, urgency options, and submit', () => {
    const { getByText, getByLabelText } = render(<NewHelpRequestScreen />);
    expect(getByText('New Help Request')).toBeTruthy();
    expect(getByText('Tell us what needs attention')).toBeTruthy();
    // RadioCards expose `accessibilityRole="radio"` with `accessibilityLabel` = title + subtitle.
    expect(getByLabelText('Plumbing, Leaks, drainage, taps')).toBeTruthy();
    expect(getByLabelText('Electrical, Wiring, outlets, lights')).toBeTruthy();
    expect(getByLabelText('Other, Anything not above')).toBeTruthy();
    expect(getByLabelText('Set urgency to Low')).toBeTruthy();
    expect(getByLabelText('Set urgency to High')).toBeTruthy();
    expect(getByLabelText('Submit help request')).toBeTruthy();
  });

  it('selecting a category and typing a description enables submit and POSTs', async () => {
    const { getByLabelText, getByPlaceholderText } = render(<NewHelpRequestScreen />);
    fireEvent.press(getByLabelText('Plumbing, Leaks, drainage, taps'));
    fireEvent.changeText(getByPlaceholderText('Describe the issue in detail…'), 'Tap leaking in kitchen');
    fireEvent.press(getByLabelText('Submit help request'));
    // The mocked useMutation runs synchronously inside this microtask.
    await Promise.resolve();
    expect(mockApiPost).toHaveBeenCalledWith('/help-requests', expect.objectContaining({
      category: 'Plumbing',
      urgency: 'LOW',
      description: 'Tap leaking in kitchen',
    }));
  });
});
