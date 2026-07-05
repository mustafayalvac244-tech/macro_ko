import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from './palettes';

const STORAGE_KEY = 'vekil-theme';

interface ThemeState {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'light',
  setTheme: (themeId) => {
    set({ themeId });
    AsyncStorage.setItem(STORAGE_KEY, themeId).catch(() => {});
  },
}));

export async function hydrateTheme(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'sepia' || saved === 'emerald') {
      useThemeStore.setState({ themeId: saved });
    }
  } catch {
    // keep default
  }
}
