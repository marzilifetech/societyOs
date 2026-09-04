/**
 * The permission module's whole reason to exist is the granted / denied /
 * blocked distinction. Conflating "denied" with "blocked" is what makes a
 * permission button look broken: on Android 13+ (and iOS after the first
 * refusal) requesting an already-blocked permission resolves immediately
 * having shown the user nothing at all.
 */
const mockCamera = { getCameraPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() };
const mockLocation = { getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn() };
const mockPicker = { getMediaLibraryPermissionsAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() };
const mockNotif = { getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() };
const mockOpenSettings = jest.fn().mockResolvedValue(undefined);
let alertButtons: any[] = [];

jest.mock('expo-camera', () => ({ Camera: mockCamera }));
jest.mock('expo-location', () => mockLocation);
jest.mock('expo-image-picker', () => mockPicker);
jest.mock('expo-notifications', () => mockNotif);
jest.mock('expo-constants', () => ({ isDevice: true }));
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (o: any) => o.android },
  Linking: { openSettings: (...a: any[]) => mockOpenSettings(...a), openURL: jest.fn() },
  Alert: {
    alert: (_t: string, _m: string, buttons: any[]) => {
      alertButtons = buttons ?? [];
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const perms = require('../src/lib/permissions') as typeof import('../src/lib/permissions');

beforeEach(() => {
  jest.clearAllMocks();
  alertButtons = [];
});

describe('checkPermission outcomes', () => {
  it('reports granted', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    expect(await perms.checkPermission('camera')).toEqual({ outcome: 'granted', granted: true });
  });

  it('treats undetermined as askable, not as a refusal', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    expect(await perms.checkPermission('camera')).toEqual({ outcome: 'denied', granted: false });
  });

  it('separates a re-askable refusal from a permanent one', async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });
    expect((await perms.checkPermission('location')).outcome).toBe('denied');

    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    expect((await perms.checkPermission('location')).outcome).toBe('blocked');
  });

  it('assumes askable when canAskAgain is absent', async () => {
    // A redundant prompt is recoverable; a wrongly-blocked permission strands
    // the user with no route forward.
    mockPicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect((await perms.checkPermission('photos')).outcome).toBe('denied');
  });

  it('never throws — a permission read must not break a render path', async () => {
    mockCamera.getCameraPermissionsAsync.mockRejectedValue(new Error('boom'));
    expect(await perms.checkPermission('camera')).toEqual({ outcome: 'denied', granted: false });
  });
});

describe('ensurePermission', () => {
  it('short-circuits when already granted — no dialog at all', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    const r = await perms.ensurePermission('camera');
    expect(r.granted).toBe(true);
    expect(mockCamera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(alertButtons).toEqual([]);
  });

  it('prompts the OS when a refusal can still be re-asked', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockCamera.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
    const r = await perms.ensurePermission('camera');
    expect(mockCamera.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(r.granted).toBe(true);
  });

  // These three drive a dialog, so the promise cannot be awaited until a
  // button has been pressed — start it, flush the microtask queue so the
  // Alert has been raised, then press.
  const flush = () => new Promise((r) => setImmediate(r));

  it('does NOT re-request when blocked — that shows nothing and looks broken', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const p = perms.ensurePermission('camera');
    await flush();

    expect(mockCamera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    // It offers the only thing that can actually fix it.
    expect(alertButtons.map((b) => b.text)).toContain('Open settings');

    alertButtons.find((b) => b.text === 'Not now')!.onPress();
    await p;
  });

  it('opens OS settings when the user accepts that offer', async () => {
    mockCamera.getCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const p = perms.ensurePermission('camera');
    await flush();

    alertButtons.find((b) => b.text === 'Open settings')!.onPress();
    await p;
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('lets the user decline the rationale without an OS prompt firing', async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    const p = perms.ensurePermission('location', { withRationale: true });
    await flush();

    // The rationale is shown BEFORE the OS dialog; declining stops there.
    alertButtons.find((b) => b.text === 'Not now')!.onPress();
    const r = await p;
    expect(r.granted).toBe(false);
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports notifications as unavailable off-device instead of pretending', async () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ isDevice: false }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p2 = require('../src/lib/permissions') as typeof import('../src/lib/permissions');
    expect((await p2.checkPermission('notifications')).outcome).toBe('unavailable');
  });
});
