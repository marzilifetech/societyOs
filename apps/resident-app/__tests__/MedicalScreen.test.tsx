/**
 * Behaviour test for the redesigned Medical screen.
 * Validates the ScreenHeader title/subtitle, the SOS trailing affordance,
 * and that the empty-state renders when /medical/doctors returns no doctors.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => true,
    push: (...args: any[]) => mockPush(...args),
    replace: jest.fn(),
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

jest.mock('../src/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: any[] }) => {
    if (queryKey[0] === 'doctors') return { data: [], isLoading: false, isError: false, refetch: jest.fn() };
    if (queryKey[0] === 'emergency-contacts') return { data: [], refetch: jest.fn() };
    return { data: null, isLoading: false, refetch: jest.fn() };
  },
}));

import MedicalScreen from '../app/medical/index';

describe('MedicalScreen (redesigned)', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the ScreenHeader, the SOS trailing button, and the empty state', () => {
    const { getByText, getByLabelText } = render(<MedicalScreen />);
    expect(getByText('Medical')).toBeTruthy();
    expect(getByText('Book a doctor appointment')).toBeTruthy();
    expect(getByLabelText('Emergency SOS - call for immediate help')).toBeTruthy();
    expect(getByText('No doctors available')).toBeTruthy();
  });
});
