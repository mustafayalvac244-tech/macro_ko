import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vekil-applock';

interface LockState {
  /** User preference: require biometrics to open the app. */
  enabled: boolean;
  /** Whether the lock overlay is currently shown. */
  locked: boolean;
  setEnabled: (enabled: boolean) => void;
  lock: () => void;
  unlock: () => void;
}

export const useLockStore = create<LockState>((set, get) => ({
  enabled: false,
  locked: false,
  setEnabled: (enabled) => {
    set({ enabled, locked: false });
    AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0').catch(() => {});
  },
  lock: () => {
    if (get().enabled) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));

export async function hydrateLock(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === '1') {
      // Start locked: the user opted in, so a cold start requires biometrics.
      useLockStore.setState({ enabled: true, locked: true });
    }
  } catch {
    // ignore
  }
}
