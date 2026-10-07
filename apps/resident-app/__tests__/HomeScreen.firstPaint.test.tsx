/**
 * Home's first frame at launch.
 *
 * Home used to draw itself before its data arrived and then visibly redraw:
 * "Hi, Resident" turning into the resident's name, "No active requests"
 * turning into their requests, the flat line pushing everything down. These
 * tests pin the first frame to what is already known.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock('../src/lib/care-portal', () => ({ openCarePortal: jest.fn() }));

type QueryState = { data?: unknown; isPending: boolean };
const mockQueries: Record<string, QueryState> = {};
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    ...(mockQueries[queryKey[0]] ?? { data: undefined, isPending: false }),
    refetch: jest.fn(),
  }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import HomeScreen from '../app/(tabs)/index';
import { useAuthStore } from '../src/store/auth.store';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderHome() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen />
    </SafeAreaProvider>,
  );
}

function launchState() {
  // Everything still loading, as on the first frame after launch.
  mockQueries['resident-profile'] = { isPending: true };
  mockQueries['my-service-requests'] = { isPending: true };
}

describe('Home — first paint', () => {
  beforeEach(() => {
    Object.keys(mockQueries).forEach((k) => delete mockQueries[k]);
    useAuthStore.setState({
      user: { id: 'u1', phone: '+91', role: 'RESIDENT', status: 'ACTIVE', name: 'Asha Rao' },
    });
  });

  it('greets by the name known from sign-in, before the profile loads', () => {
    launchState();
    renderHome();
    expect(screen.getByText(/Hi, Asha/)).toBeTruthy();
    expect(screen.queryByText(/Resident/)).toBeNull();
  });

  it('prefers the freshly loaded profile name', () => {
    launchState();
    mockQueries['resident-profile'] = {
      isPending: false,
      data: { user: { name: 'Asha R. Menon' }, flat: { block: 'A', number: '101' } },
    };
    useAuthStore.setState({
      user: { id: 'u1', phone: '+91', role: 'RESIDENT', status: 'ACTIVE', name: 'Old' },
    });
    renderHome();
    expect(screen.getByText(/Hi, Asha/)).toBeTruthy();
    expect(screen.getByText('Flat A - 101')).toBeTruthy();
  });

  it('falls back to "Resident" only when no name is known at all', () => {
    launchState();
    useAuthStore.setState({ user: null });
    renderHome();
    expect(screen.getByText(/Hi, Resident/)).toBeTruthy();
  });

  it('holds the flat line with a skeleton until the profile arrives', () => {
    launchState();
    renderHome();
    expect(screen.getByTestId('flat-skeleton', { includeHiddenElements: true })).toBeTruthy();
  });

  it('swaps the flat skeleton for the real flat once loaded', () => {
    launchState();
    mockQueries['resident-profile'] = {
      isPending: false,
      data: { user: { name: 'Asha' }, flat: { block: 'B', number: '204' } },
    };
    renderHome();
    expect(screen.getByText('Flat B - 204')).toBeTruthy();
    expect(screen.queryByTestId('flat-skeleton', { includeHiddenElements: true })).toBeNull();
  });

  it('shows loading, not "No active requests", while requests are loading', () => {
    launchState();
    renderHome();
    expect(screen.getByTestId('active-requests-loading')).toBeTruthy();
    expect(screen.queryByText('No active requests')).toBeNull();
  });

  it('says "No active requests" once it actually knows', () => {
    launchState();
    mockQueries['my-service-requests'] = { isPending: false, data: [] };
    renderHome();
    expect(screen.getByText('No active requests')).toBeTruthy();
    expect(screen.queryByTestId('active-requests-loading')).toBeNull();
  });

  it('lists active requests once loaded', () => {
    launchState();
    mockQueries['my-service-requests'] = {
      isPending: false,
      data: [
        { id: 'r1', category: 'plumbing', description: 'Leaking tap', status: 'IN_PROGRESS' },
        { id: 'r2', category: 'electrical', description: 'Fan', status: 'COMPLETED' },
      ],
    };
    renderHome();
    expect(screen.getByText('plumbing')).toBeTruthy();
    expect(screen.queryByText('electrical')).toBeNull(); // completed: not active
  });
});
