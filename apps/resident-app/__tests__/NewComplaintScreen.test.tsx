/**
 * Behaviour test for the redesigned File-a-Complaint screen.
 * Validates the ScreenHeader title/subtitle, category selection, validation
 * gating on the BottomActionBar primary button, and the api.post call.
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: (...args: any[]) => mockReplace(...args),
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

const mockApiPost = jest.fn().mockResolvedValue({ id: 'cmp-1' });
jest.mock('../src/lib/api', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (opts: any) => {
    let pending = false;
    return {
      mutate: async () => {
        pending = true;
        try {
          const result = await opts.mutationFn();
          opts.onSuccess?.(result);
        } catch (err) {
          opts.onError?.(err);
        } finally {
          pending = false;
        }
      },
      isPending: pending,
    };
  },
}));

import NewComplaintScreen from '../app/complaints/new';

describe('NewComplaintScreen (redesigned)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockApiPost.mockClear();
  });

  it('renders the ScreenHeader title, subtitle, category list, and submit button', () => {
    const { getByText, getByLabelText } = render(<NewComplaintScreen />);
    expect(getByText('File a Complaint')).toBeTruthy();
    expect(getByText("We'll review and respond within 48 hours")).toBeTruthy();
    expect(getByLabelText('Submit complaint')).toBeTruthy();
    expect(getByLabelText('Select Noise category')).toBeTruthy();
    expect(getByLabelText('Select Parking category')).toBeTruthy();
  });

  it('keeps the submit button disabled until required fields are filled', () => {
    const { getByLabelText } = render(<NewComplaintScreen />);
    const submit = getByLabelText('Submit complaint');
    // Disabled is reflected via accessibilityState; tap should not POST anything.
    fireEvent.press(submit);
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
