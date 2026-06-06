import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AccessibilityState {
  seniorMode: boolean;
  toggleSeniorMode: () => void;
  setSeniorMode: (val: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      // Default ON: this is the Marzi Senior Community app — elders are the
      // primary audience, so the larger/higher-contrast token set is the
      // baseline experience. Users who want a denser UI can toggle it off
      // in Settings → Accessibility.
      seniorMode: true,
      toggleSeniorMode: () => set((s) => ({ seniorMode: !s.seniorMode })),
      setSeniorMode: (val) => set({ seniorMode: val }),
    }),
    {
      name: 'accessibility-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
