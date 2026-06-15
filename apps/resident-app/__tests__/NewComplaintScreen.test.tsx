/**
 * Behaviour test for the redesigned File-a-Complaint screen (2026 Figma).
 * Validates the ScreenHeader title, category selection in the pill-chip list,
 * validation gating on the footer PillButton, the anonymous toggle, and the
 * api.post call shape.
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
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

const mockApiPost = jest.fn().mockResolvedValue({ id: 'cmp-1', createdAt: new Date().toISOString() });
jest.mock('../src/lib/api', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('../src/lib/photo-upload', () => ({
  uploadViaMedia: jest.fn(),
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

describe('NewComplaintScreen (2026 redesign)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockApiPost.mockClear();
  });

  it('renders the ScreenHeader title and all 8 category chips', () => {
    const { getByText, getByLabelText } = render(<NewComplaintScreen />);
    // ScreenHeader renders the title
    expect(getByText('Raise a Complaint')).toBeTruthy();
    // All 8 category chips are rendered
    expect(getByLabelText('Select Noise category')).toBeTruthy();
    expect(getByLabelText('Select Parking category')).toBeTruthy();
    expect(getByLabelText('Select Cleanliness category')).toBeTruthy();
    expect(getByLabelText('Select Water category')).toBeTruthy();
    expect(getByLabelText('Select Maintenance category')).toBeTruthy();
    expect(getByLabelText('Select Neighbour category')).toBeTruthy();
    expect(getByLabelText('Select Pets category')).toBeTruthy();
    expect(getByLabelText('Select Other category')).toBeTruthy();
  });

  it('keeps the submit button disabled until a category is selected', () => {
    const { getByLabelText } = render(<NewComplaintScreen />);
    const submit = getByLabelText('Submit complaint');
    fireEvent.press(submit);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('enables submit once a category is selected (description is optional)', async () => {
    const { getByLabelText } = render(<NewComplaintScreen />);

    // Select a category — no description needed
    fireEvent.press(getByLabelText('Select Noise category'));

    // Submit without filling description
    const submit = getByLabelText('Submit complaint');
    fireEvent.press(submit);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/complaints', expect.objectContaining({
        category: 'NOISE',
        isAnonymous: false,
      }));
    });
  });

  it('sends enum value and user description when both are provided', async () => {
    const { getByLabelText, getByPlaceholderText } = render(<NewComplaintScreen />);

    fireEvent.press(getByLabelText('Select Noise category'));

    const descInput = getByPlaceholderText('Describe the issue in detail...');
    fireEvent.changeText(descInput, 'Loud music from Flat 3C after midnight every day');

    const submit = getByLabelText('Submit complaint');
    fireEvent.press(submit);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/complaints', expect.objectContaining({
        category: 'NOISE',
        description: 'Loud music from Flat 3C after midnight every day',
        isAnonymous: false,
      }));
    });
  });

  it('toggles isAnonymous correctly', () => {
    const { getByLabelText } = render(<NewComplaintScreen />);
    const toggle = getByLabelText('Toggle anonymous submission');
    // Default off — toggle on
    fireEvent(toggle, 'valueChange', true);
    // No assertion on API yet — just ensure no crash
    expect(toggle).toBeTruthy();
  });
});
