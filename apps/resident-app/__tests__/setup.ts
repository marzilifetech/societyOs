/**
 * `process` is not defined in this preset's sandbox, but Expo's virtual env
 * module and several app modules read `process.env`. Define a minimal shim
 * before anything imports them.
 */
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {} };
} else if (!(globalThis as any).process.env) {
  (globalThis as any).process.env = {};
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
  Accuracy: { High: 6 },
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false, error: null }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: any) => children,
}));

// Vector icons rely on expo-font which needs native registration we don't have
// in jest-expo's default setup. Render each icon as a plain host component so
// snapshots & accessibility queries continue to work.
jest.mock('@expo/vector-icons', () => {
  const passthroughIcon = 'Icon';
  return new Proxy(
    { __esModule: true },
    {
      get: (target, prop) => {
        if (prop === '__esModule') return true;
        // any glyph-set component (Ionicons, MaterialIcons, …)
        return passthroughIcon;
      },
    },
  );
});
