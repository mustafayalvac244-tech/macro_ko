import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ana ekrandaki "masraf avansı eksiye düştü" uyarısı için kapatılan müvekkiller.
// Burak önerisi: başta hatırlatsın ama kullanıcı "yoksay" ile kapatabilsin.
const KEY = 'vekil-dismissed-advance-alerts';

interface AdvanceAlertState {
  dismissed: string[];
  dismiss: (clientId: string) => void;
  restore: (clientId: string) => void;
}

export const useAdvanceAlertStore = create<AdvanceAlertState>((set, get) => ({
  dismissed: [],
  dismiss: (clientId) => {
    const next = Array.from(new Set([...get().dismissed, clientId]));
    set({ dismissed: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },
  restore: (clientId) => {
    const next = get().dismissed.filter((id) => id !== clientId);
    set({ dismissed: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },
}));

export async function hydrateAdvanceAlerts(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) useAdvanceAlertStore.setState({ dismissed: JSON.parse(saved) });
  } catch {
    // varsayılan boş
  }
}
