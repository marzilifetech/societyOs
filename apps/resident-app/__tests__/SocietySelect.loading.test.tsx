/**
 * The first screen a new resident sees: the society list, while it loads and
 * once it has.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));

type QueryState = { data?: unknown; isLoading: boolean };
let mockSocieties: QueryState = { isLoading: true };
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => mockSocieties,
}));

import SocietySelectScreen from '../app/(auth)/society-select';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SocietySelectScreen />
    </SafeAreaProvider>,
  );
}

describe('Society select — loading', () => {
  it('shows card-shaped skeleton rows while the list loads', () => {
    mockSocieties = { isLoading: true };
    renderScreen();
    const loading = screen.getByTestId('societies-loading');
    expect(loading.props.accessibilityLabel).toBe('Loading societies');
    expect(
      screen.getAllByTestId('skeleton', { includeHiddenElements: true }).length,
    ).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/societies$/)).toBeNull(); // no count before we know
  });

  it('replaces the skeleton with the societies once loaded', () => {
    mockSocieties = {
      isLoading: false,
      data: [
        { id: 's1', name: 'Brigade Parkside', city: 'Bengaluru' },
        { id: 's2', name: 'Primus Reflection', city: 'Bengaluru' },
      ],
    };
    renderScreen();
    expect(screen.queryByTestId('societies-loading')).toBeNull();
    expect(screen.getByText('Brigade Parkside')).toBeTruthy();
    expect(screen.getByText('2 societies')).toBeTruthy();
  });
});
