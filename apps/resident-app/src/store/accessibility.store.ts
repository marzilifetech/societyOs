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
      // Default OFF: the 2026 redesign baseline matches the Figma (default
      // scale). Senior Mode (larger/higher-contrast tokens) remains an opt-in
      // toggle in Settings → Accessibility for elders who want a bigger UI.
      seniorMode: false,
      toggleSeniorMode: () => set((s) => ({ seniorMode: !s.seniorMode })),
      setSeniorMode: (val) => set({ seniorMode: val }),
    }),
    {
      name: 'accessibility-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
