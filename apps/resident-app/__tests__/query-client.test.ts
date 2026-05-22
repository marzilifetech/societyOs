/**
 * Tests for apps/resident-app/src/lib/query-client.ts
 * The setup mock replaces QueryClient with jest.fn(); we need the real one here.
 */

// Override the setup.ts mock for @tanstack/react-query
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return actual;
});

describe('queryClient', () => {
  it('is a QueryClient instance', () => {
    const { QueryClient } = require('@tanstack/react-query');
    const { queryClient } = require('../src/lib/query-client');
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('has staleTime of 2 minutes', () => {
    const { queryClient } = require('../src/lib/query-client');
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(1000 * 60 * 2);
  });

  it('has retry set to 2', () => {
    const { queryClient } = require('../src/lib/query-client');
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.retry).toBe(2);
  });

  it('has refetchOnWindowFocus set to false', () => {
    const { queryClient } = require('../src/lib/query-client');
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });
});
