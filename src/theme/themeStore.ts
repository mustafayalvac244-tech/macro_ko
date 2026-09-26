import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeMetas, type ThemeId } from './palettes';
import { temaTokenlariniUygula } from './tokens';

/**
 * AÇILIŞ TEMASI — 18.09.2026, ürün sahibi kararı: varsayılan `dark` (Gece).
 *
 * TARİHÇE VE NEDEN GERİ ALINDI. 15.09.2026'da varsayılan `terminal` yapıldı.
 * Ama o değişiklik ürün sahibinin telefonuna hiç ULAŞMADI (telefondaki paket
 * 14.09 derlemesi) ve mağaza görselleri `magaza-pazarlama/` altında Gece
 * temasıyla çekilmişti. Yani üç yerde üç farklı tema vardı:
 *   kod = terminal · telefon = dark · reklam görselleri = dark
 * 3.4.0 yayınlansaydı HER YENİ KULLANICI mağazada gördüğünden farklı bir
 * uygulama açacaktı. `PAZAR.md`'de ölçülmüş bir rakip şikâyeti tam olarak bu:
 * "Uygulama görsellerinde ... var gözüküyor ama uygulamada yok."
 *
 * Terminal KALDIRILMADI — Ayarlar'dan seçilebilen temalardan biri.
 *
 * TOKEN'LAR BURADA, MODÜL YÜKLENİRKEN UYGULANIYOR. `spacing/radius/fonts/
 * typography` tanımlandıkları anda KLASİK değerlerle doluyor (bkz. tokens.ts).
 * Yalnız `themeId`yi değiştirseydik ilk kare YENİ RENKLER + ESKİ YAZI TİPİ
 * ile çizilirdi: kullanıcı açılışta bir anlık yamalı ekran görürdü.
 */
const ACILIS_TEMASI: ThemeId = 'dark';
temaTokenlariniUygula(ACILIS_TEMASI);

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
  themeId: ACILIS_TEMASI,
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
