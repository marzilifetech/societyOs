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
