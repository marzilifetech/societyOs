/**
 * The Request Help screen: category cards, submit gating, and the concierge
 * request it sends.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

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

describe('NewHelpRequestScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockApiPost.mockClear();
  });

  it('shows the categories and keeps submit disabled until one is picked', () => {
    const { getByText, getByLabelText } = render(<NewHelpRequestScreen />);
    expect(getByText('Request Help')).toBeTruthy();
    expect(getByLabelText('Package Pickup, Collect a parcel or package')).toBeTruthy();
    expect(getByLabelText('Heavy Lifting, Move furniture or appliances')).toBeTruthy();

    fireEvent.press(getByText('Submit Request'));
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('posts the chosen category and description to the concierge desk', async () => {
    const { getByText, getByLabelText, getByPlaceholderText } = render(<NewHelpRequestScreen />);
    fireEvent.press(getByLabelText('Heavy Lifting, Move furniture or appliances'));
    fireEvent.changeText(getByPlaceholderText('Any details the staff member should know...'), 'Sofa to 3rd floor');
    fireEvent.press(getByText('Submit Request'));
    await Promise.resolve();
    expect(mockApiPost).toHaveBeenCalledWith('/concierge', {
      type: 'HEAVY_LIFTING',
      description: 'Sofa to 3rd floor',
    });
  });
});
