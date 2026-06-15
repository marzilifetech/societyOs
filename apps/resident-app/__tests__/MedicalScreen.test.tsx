/**
 * Behaviour tests for the redesigned Medical Help Desk screens.
 * Validates the ScreenHeader, SOS trailing affordance, and key UI states.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockBack(...args),
    canGoBack: () => true,
    push: (...args: any[]) => mockPush(...args),
    replace: (...args: any[]) => mockReplace(...args),
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
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
    if (queryKey[0] === 'my-appointments') return { data: [], isLoading: false, isError: false, refetch: jest.fn() };
    return { data: null, isLoading: false, isError: false, refetch: jest.fn() };
  },
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import MedicalScreen from '../app/medical/index';
import AppointmentHistoryScreen from '../app/medical/appointments/index';

describe('MedicalScreen (redesigned)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders the ScreenHeader, the SOS trailing button, and the empty state', () => {
    const { getByText, getByLabelText } = render(<MedicalScreen />);
    expect(getByText('Medical')).toBeTruthy();
    expect(getByText('Book a doctor appointment')).toBeTruthy();
    expect(getByLabelText('Emergency SOS - call for immediate help')).toBeTruthy();
    expect(getByText('No doctors available')).toBeTruthy();
  });

  it('renders Book Appointment and My Appointments CTAs', () => {
    const { getByText } = render(<MedicalScreen />);
    expect(getByText('Book Appointment')).toBeTruthy();
    expect(getByText('My Appointments')).toBeTruthy();
  });

  it('tapping SOS navigates to /medical/sos', () => {
    const { getByLabelText } = render(<MedicalScreen />);
    fireEvent.press(getByLabelText('Emergency SOS - call for immediate help'));
    expect(mockPush).toHaveBeenCalledWith('/medical/sos');
  });

  it('tapping My Appointments navigates to /medical/appointments', () => {
    const { getByText } = render(<MedicalScreen />);
    fireEvent.press(getByText('My Appointments'));
    expect(mockPush).toHaveBeenCalledWith('/medical/appointments');
  });
});

describe('AppointmentHistoryScreen (redesigned)', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the empty state with Book an Appointment CTA', () => {
    const { getByText } = render(<AppointmentHistoryScreen />);
    expect(getByText('No appointments yet')).toBeTruthy();
    expect(getByText('Book an Appointment')).toBeTruthy();
  });

  it('tapping Book an Appointment navigates to /medical/book', () => {
    const { getByText } = render(<AppointmentHistoryScreen />);
    fireEvent.press(getByText('Book an Appointment'));
    expect(mockPush).toHaveBeenCalledWith('/medical/book');
  });
});
