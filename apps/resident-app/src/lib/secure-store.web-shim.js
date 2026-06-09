// Web-only shim for `expo-secure-store` (which has no web implementation).
// Used ONLY for in-browser verification via react-native-web; native builds
// keep the real expo-secure-store (see metro.config.js resolveRequest alias).
function mem() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {}
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}
export async function getItemAsync(key) { try { return mem().getItem(key) ?? null; } catch { return null; } }
export async function setItemAsync(key, value) { try { mem().setItem(key, value); } catch {} }
export async function deleteItemAsync(key) { try { mem().removeItem(key); } catch {} }
export async function isAvailableAsync() { return true; }
export const WHEN_UNLOCKED = 'whenUnlocked';
export const AFTER_FIRST_UNLOCK = 'afterFirstUnlock';
export default { getItemAsync, setItemAsync, deleteItemAsync, isAvailableAsync, WHEN_UNLOCKED, AFTER_FIRST_UNLOCK };
