import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeMetas, type ThemeId } from './palettes';
import { temaTokenlariniUygula } from './tokens';

const STORAGE_KEY = 'vekil-theme';

interface ThemeState {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
}

/**
 * TEMAYI TEK YERDEN UYGULA.
 *
 * SIRA KRİTİK: ölçü token'ları (yazı tipi, boyut, boşluk, köşe) store
 * aboneleri haber almadan ÖNCE tazelenmeli. Ters sırada bileşenler bir kare
 * boyunca YENİ RENKLERİ ama ESKİ YAZI TİPİNİ kullanarak çizilir — tema
 * geçişinde göze çarpan bir titreme olur.
 *
 * Bu yüzden `set` çağrısına giden tek kapı burası: hem `setTheme` hem
 * `hydrateTheme` bunu kullanıyor. İkinci bir yerden `setState({themeId})`
 * çağrılırsa token'lar geride kalır.
 */
function temayiYerlestir(set: (s: Partial<ThemeState>) => void, themeId: ThemeId): void {
  temaTokenlariniUygula(themeId);
  set({ themeId });
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'light',
  setTheme: (themeId) => {
    temayiYerlestir(set, themeId);
    AsyncStorage.setItem(STORAGE_KEY, themeId).catch(() => {});
  },
}));

/**
 * DİSKTEN OKUNAN DEĞER GERÇEKTEN BİR TEMA MI?
 *
 * Bu kontrol ELLE YAZILMIŞ bir id listesiyle yapılıyordu
 * (`saved === 'light' || saved === 'dark' || ...`). Altıncı tema eklendiği gün
 * o liste sessizce yanlışa düşer: kullanıcı Terminal'i seçer, uygulamayı
 * kapatır, açtığında Klasik'e dönmüş olur — hata da vermez, sadece "kaydetmiyor"
 * gibi görünür. `themeMetas` zaten her temanın tek kaynağı; listeyi ondan
 * türetmek bu sınıf hatayı tümden kaldırır.
 */
function gecerliTemaMi(deger: string | null): deger is ThemeId {
  return deger !== null && themeMetas.some((m) => m.id === deger);
}

export async function hydrateTheme(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (gecerliTemaMi(saved)) {
      temaTokenlariniUygula(saved);
      useThemeStore.setState({ themeId: saved });
    }
  } catch {
    // keep default
  }
}
