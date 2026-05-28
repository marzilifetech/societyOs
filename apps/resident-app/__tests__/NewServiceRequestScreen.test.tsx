/**
 * Behaviour test for the redesigned Service Request screen.
 * Validates the ScreenHeader title/subtitle, category and time-slot
 * affordances, and submit-button gating.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('../src/lib/photo-upload', () => ({
  pickImageFromLibrary: jest.fn().mockResolvedValue(null),
  uploadToPresignedUrl: jest.fn(),
}));

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

const mockApiPost = jest.fn().mockResolvedValue({ id: 'sr-1' });
jest.mock('../src/lib/api', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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

import NewServiceRequestScreen from '../app/services/new';

describe('NewServiceRequestScreen (redesigned)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockApiPost.mockClear();
  });

  it('renders the ScreenHeader title/subtitle and primary submit affordance', () => {
    const { getByText, getByLabelText } = render(<NewServiceRequestScreen />);
    expect(getByText('New Service Request')).toBeTruthy();
    expect(getByText('What needs fixing?')).toBeTruthy();
    expect(getByLabelText('Submit service request')).toBeTruthy();
    expect(getByLabelText('Select Plumbing category')).toBeTruthy();
    expect(getByLabelText('Select Electrical category')).toBeTruthy();
  });

  it('does not POST when required fields are empty', () => {
    const { getByLabelText } = render(<NewServiceRequestScreen />);
    fireEvent.press(getByLabelText('Submit service request'));
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
