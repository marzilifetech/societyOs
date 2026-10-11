/**
 * Behaviour test for the redesigned Service Request screen.
 * Validates the ScreenHeader title, date/time slot affordances, and submit-button gating.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/lib/photo-upload', () => ({
  pickImageFromLibrary: jest.fn().mockResolvedValue(null),
  uploadToPresignedUrl: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  router: {
    back: () => mockBack(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack() }),
  useLocalSearchParams: () => ({ category: 'Plumber' }),
  Link: ({ children }: any) => children,
}));

const mockApiPost = jest.fn().mockResolvedValue({ id: 'sr-1' });
jest.mock('../src/lib/api', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  // The resident-profile guard: a profile exists, so the form is shown.
  useQuery: () => ({ data: { id: 'r1' }, isError: false, isLoading: false, error: null }),
  useMutation: (opts: any) => ({
    mutate: async () => {
      try {
        const result = await opts.mutationFn();
        opts.onSuccess?.(result);
      } catch (err) {
        opts.onError?.(err);
      }
    },
    isPending: false,
  }),
}));

// expo-linear-gradient stub
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

import NewServiceRequestScreen from '../app/services/new';

describe('NewServiceRequestScreen (redesigned)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockApiPost.mockClear();
  });

  it('renders the ScreenHeader title and category name', () => {
    const { getByText } = render(<NewServiceRequestScreen />);
    expect(getByText('Plumber')).toBeTruthy();
    expect(getByText('Choose a Date')).toBeTruthy();
  });

  it('renders time slot grid', () => {
    const { getAllByLabelText, getByLabelText } = render(<NewServiceRequestScreen />);
    // Tomorrow: today's earlier slots are hidden once they have passed.
    fireEvent.press(getAllByLabelText(/^Select (?!time slot)/)[1]);
    expect(getByLabelText('Select time slot 09:00 AM')).toBeTruthy();
    expect(getByLabelText('Select time slot 02:00 PM')).toBeTruthy();
  });

  it('submit button is present', () => {
    const { getByLabelText } = render(<NewServiceRequestScreen />);
    expect(getByLabelText('Submit service request')).toBeTruthy();
  });

  it('books for the chosen day at any time when no time slot is picked', async () => {
    const { getByLabelText } = render(<NewServiceRequestScreen />);
    await fireEvent.press(getByLabelText('Submit service request'));
    expect(mockApiPost).toHaveBeenCalledWith(
      '/service-requests',
      expect.objectContaining({ category: 'Plumber', preferredTime: expect.stringMatching(/, Any time$/) }),
    );
  });

  it('POSTs when a time slot is selected', async () => {
    const { getAllByLabelText, getByLabelText } = render(<NewServiceRequestScreen />);
    // Pick tomorrow, so the 9 AM slot is never already past whenever this runs.
    fireEvent.press(getAllByLabelText(/^Select (?!time slot)/)[1]);
    fireEvent.press(getByLabelText('Select time slot 09:00 AM'));
    await fireEvent.press(getByLabelText('Submit service request'));
    expect(mockApiPost).toHaveBeenCalledWith(
      '/service-requests',
      expect.objectContaining({ category: 'Plumber' }),
    );
  });
});
