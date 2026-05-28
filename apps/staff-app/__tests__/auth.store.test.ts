/**
 * Hook test for useAuthStore (zustand). Mocks SecureStore + api token setter.
 */
jest.mock('../src/lib/api', () => ({
  setApiToken: jest.fn(),
  setApiTokens: jest.fn(),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import { useAuthStore } from '../src/store/auth.store';
import * as SecureStore from 'expo-secure-store';
import { setApiTokens } from '../src/lib/api';

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: null, refreshToken: null, user: null, societyId: null });
  });

  const fakeUser = { id: 'u1', name: 'Ravi', phone: '+91999', role: 'STAFF', societyId: 'soc1' };

  it('setAuth persists token + user and updates store', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok');
    expect(setApiTokens).toHaveBeenCalledWith('tok', 'rt');
    expect(useAuthStore.getState().societyId).toBe('soc1');
  });

  it('setAuth persists auth_user JSON to SecureStore', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user', JSON.stringify(fakeUser));
  });

  it('setAuth throws when token is an empty string', async () => {
    await expect(useAuthStore.getState().setAuth('', 'rt', fakeUser)).rejects.toThrow(
      'Cannot save session: access token is missing or not a string.',
    );
  });

  it('setAuth throws when token is not a string', async () => {
    await expect(useAuthStore.getState().setAuth(null as any, 'rt', fakeUser)).rejects.toThrow(
      'Cannot save session: access token is missing or not a string.',
    );
  });

  it('setAuth with user that has optional department stores it correctly', async () => {
    const userWithDept = { ...fakeUser, department: 'Engineering' };
    await useAuthStore.getState().setAuth('tok', 'rt', userWithDept);
    expect(useAuthStore.getState().user?.department).toBe('Engineering');
    expect(useAuthStore.getState().societyId).toBe('soc1');
  });

  it('clearAuth wipes everything', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    await useAuthStore.getState().clearAuth();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clearAuth calls setApiTokens(null, null)', async () => {
    await useAuthStore.getState().setAuth('tok', 'rt', fakeUser);
    jest.clearAllMocks();
    await useAuthStore.getState().clearAuth();
    expect(setApiTokens).toHaveBeenCalledWith(null, null);
  });

  it('hydrate restores from SecureStore when present', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('persisted-tok')           // auth_token
      .mockResolvedValueOnce('rt-persisted')            // refresh_token
      .mockResolvedValueOnce(JSON.stringify(fakeUser)); // auth_user
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBe('persisted-tok');
    expect(useAuthStore.getState().refreshToken).toBe('rt-persisted');
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('hydrate restores user with department field', async () => {
    const userWithDept = { ...fakeUser, department: 'Plumbing' };
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('tok3')                       // auth_token
      .mockResolvedValueOnce('rt3')                        // refresh_token
      .mockResolvedValueOnce(JSON.stringify(userWithDept)); // auth_user
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().user?.department).toBe('Plumbing');
  });

  it('hydrate is a no-op when SecureStore is empty', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('hydrate is a no-op when token present but user JSON is null', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('tok')   // auth_token
      .mockResolvedValueOnce(null)    // refresh_token
      .mockResolvedValueOnce(null);   // auth_user
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
