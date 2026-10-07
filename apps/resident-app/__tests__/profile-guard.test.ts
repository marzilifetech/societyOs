import { isResidentProfileMissing } from '../src/lib/profile-guard';

const notFound = Object.assign(new Error('Resident profile not found'), { status: 404 });
const offline = new Error('Could not reach the server.');
const serverError = Object.assign(new Error('Something went wrong'), { status: 500 });
const sessionEnded = Object.assign(new Error('Your session ended.'), { status: 401 });

describe('isResidentProfileMissing', () => {
  it('bounces on a settled 404', () => {
    expect(isResidentProfileMissing({ isError: true, isFetching: false, error: notFound })).toBe(
      true,
    );
  });

  it('does NOT bounce on a cached 404 while the refetch is in flight', () => {
    // The resident just finished profile setup and re-entered the tabs; the
    // old 404 is still in the cache. Acting on it caused the bounce loop.
    expect(isResidentProfileMissing({ isError: true, isFetching: true, error: notFound })).toBe(
      false,
    );
  });

  it.each([
    ['offline', offline],
    ['a 5xx', serverError],
    ['a 401 (handled by the API layer)', sessionEnded],
    ['no error object', null],
  ])('does not bounce on %s', (_label, error) => {
    expect(isResidentProfileMissing({ isError: true, isFetching: false, error })).toBe(false);
  });

  it('does not bounce when the query succeeded or has not failed', () => {
    expect(isResidentProfileMissing({ isError: false, isFetching: false, error: null })).toBe(
      false,
    );
    expect(isResidentProfileMissing({ isError: false, isFetching: true, error: null })).toBe(false);
  });
});
