import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSettingsStore, type ThemeMode } from '../src/store/settings.store';

const SETTINGS_KEY = 'settings_v1';
const BIO_KEY = 'biometric_enabled';

function resetStore() {
  useSettingsStore.setState({
    theme: 'system',
    largeText: false,
    dataSaver: false,
    biometricEnabled: false,
    autoLockMinutes: 5,
    notifications: { tasks: true, reviews: true, leave: true, announcements: true, helpRequests: true },
    badges: { tasks: 0, reviews: 0, helpRequests: 0 },
    hydrated: false,
  });
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── Initial state ─────────────────────────────────────────────────────────

  it('has correct default state', () => {
    const s = useSettingsStore.getState();
    expect(s.theme).toBe('system');
    expect(s.largeText).toBe(false);
    expect(s.dataSaver).toBe(false);
    expect(s.biometricEnabled).toBe(false);
    expect(s.autoLockMinutes).toBe(5);
    expect(s.hydrated).toBe(false);
    expect(s.notifications).toEqual({
      tasks: true, reviews: true, leave: true, announcements: true, helpRequests: true,
    });
    expect(s.badges).toEqual({ tasks: 0, reviews: 0, helpRequests: 0 });
  });

  // ─── setTheme ──────────────────────────────────────────────────────────────

  it.each<ThemeMode>(['light', 'dark', 'system'])('setTheme(%s) updates state and persists', async (theme) => {
    await useSettingsStore.getState().setTheme(theme);
    expect(useSettingsStore.getState().theme).toBe(theme);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.stringContaining(`"theme":"${theme}"`));
  });

  // ─── setLargeText ─────────────────────────────────────────────────────────

  it('setLargeText(true) updates state and persists', async () => {
    await useSettingsStore.getState().setLargeText(true);
    expect(useSettingsStore.getState().largeText).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.stringContaining('"largeText":true'));
  });

  it('setLargeText(false) updates state', async () => {
    useSettingsStore.setState({ largeText: true });
    await useSettingsStore.getState().setLargeText(false);
    expect(useSettingsStore.getState().largeText).toBe(false);
  });

  // ─── setDataSaver ─────────────────────────────────────────────────────────

  it('setDataSaver(true) updates state and persists', async () => {
    await useSettingsStore.getState().setDataSaver(true);
    expect(useSettingsStore.getState().dataSaver).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.stringContaining('"dataSaver":true'));
  });

  // ─── setBiometricEnabled ──────────────────────────────────────────────────

  it('setBiometricEnabled(true) stores "1" in SecureStore', async () => {
    await useSettingsStore.getState().setBiometricEnabled(true);
    expect(useSettingsStore.getState().biometricEnabled).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(BIO_KEY, '1');
  });

  it('setBiometricEnabled(false) stores "0" in SecureStore', async () => {
    await useSettingsStore.getState().setBiometricEnabled(false);
    expect(useSettingsStore.getState().biometricEnabled).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(BIO_KEY, '0');
  });

  // ─── setAutoLockMinutes ───────────────────────────────────────────────────

  it('setAutoLockMinutes updates state and persists', async () => {
    await useSettingsStore.getState().setAutoLockMinutes(15);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(15);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.stringContaining('"autoLockMinutes":15'));
  });

  // ─── setNotificationPref ──────────────────────────────────────────────────

  it('setNotificationPref toggles a single key without touching others', async () => {
    await useSettingsStore.getState().setNotificationPref('tasks', false);
    const { notifications } = useSettingsStore.getState();
    expect(notifications.tasks).toBe(false);
    expect(notifications.reviews).toBe(true); // unchanged
    expect(notifications.leave).toBe(true);   // unchanged
  });

  it.each(['tasks', 'reviews', 'leave', 'announcements', 'helpRequests'] as const)(
    'setNotificationPref(%s, false) persists to AsyncStorage',
    async (key) => {
      await useSettingsStore.getState().setNotificationPref(key, false);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    }
  );

  // ─── setBadge (sync) ──────────────────────────────────────────────────────

  it('setBadge updates a badge count without persisting', () => {
    useSettingsStore.getState().setBadge('tasks', 7);
    expect(useSettingsStore.getState().badges.tasks).toBe(7);
    expect(useSettingsStore.getState().badges.reviews).toBe(0);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('setBadge sets to 0', () => {
    useSettingsStore.setState({ badges: { tasks: 5, reviews: 2, helpRequests: 1 } });
    useSettingsStore.getState().setBadge('reviews', 0);
    expect(useSettingsStore.getState().badges.reviews).toBe(0);
  });

  // ─── hydrate ──────────────────────────────────────────────────────────────

  it('hydrate restores all settings from AsyncStorage and biometric from SecureStore', async () => {
    const stored = {
      theme: 'dark',
      largeText: true,
      dataSaver: true,
      autoLockMinutes: 30,
      notifications: { tasks: false, reviews: true, leave: false, announcements: true, helpRequests: false },
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('1');

    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();

    expect(s.theme).toBe('dark');
    expect(s.largeText).toBe(true);
    expect(s.dataSaver).toBe(true);
    expect(s.autoLockMinutes).toBe(30);
    expect(s.biometricEnabled).toBe(true);
    expect(s.notifications.tasks).toBe(false);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate uses defaults when AsyncStorage is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();

    expect(s.theme).toBe('system');
    expect(s.autoLockMinutes).toBe(5);
    expect(s.biometricEnabled).toBe(false);
    expect(s.hydrated).toBe(true);
  });

  it('hydrate merges stored notifications with defaults (partial stored data)', async () => {
    const stored = { theme: 'light', notifications: { tasks: false } };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    await useSettingsStore.getState().hydrate();
    const { notifications } = useSettingsStore.getState();

    // Stored override
    expect(notifications.tasks).toBe(false);
    // Default filled in
    expect(notifications.reviews).toBe(true);
    expect(notifications.leave).toBe(true);
  });

  it('hydrate uses default autoLockMinutes when field missing in stored data', async () => {
    const stored = { theme: 'dark' }; // no autoLockMinutes
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().autoLockMinutes).toBe(5);
  });

  it('hydrate sets biometricEnabled false when SecureStore has "0"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('0');

    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().biometricEnabled).toBe(false);
  });

  it('hydrate coerces legacy theme "system" to "light" only ONCE', async () => {
    // Pre-migration blob (no themeMigrated marker) → coerced to light.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ theme: 'system' }),
    );
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('hydrate preserves a deliberately chosen "system" theme after migration', async () => {
    // Once migrated, picking System must survive a restart. Before the
    // themeMigrated marker existed this reverted to 'light' on every launch,
    // making the System option impossible to keep.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ theme: 'system', themeMigrated: true }),
    );
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('hydrate always sets hydrated: true even when AsyncStorage throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    // SecureStore mock may or may not be called depending on where the throw is caught
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });

  it('hydrate defaults theme to "light" when field is absent from stored object', async () => {
    // No `theme` key → falls back to the app default, which is 'light'
    // (deliberately NOT 'system': see the store's default-theme comment).
    const stored = { largeText: true, autoLockMinutes: 10 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(stored));
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().theme).toBe('light');
    // Other fields from stored data should still be applied
    expect(useSettingsStore.getState().largeText).toBe(true);
    expect(useSettingsStore.getState().autoLockMinutes).toBe(10);
  });
});
