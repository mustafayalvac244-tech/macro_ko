import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vekil-applock';

/**
 * ARKA PLANDAN DÖNÜŞTE KİLİTLEME MÜHLETİ.
 *
 * Neden sıfır değil: uygulama belge/fotoğraf seçerken ve kamerayı açarken
 * KENDİSİ arka plana geçiyor. Mühletsiz bir kilit, avukat bir dilekçe eklemek
 * için dosya seçicisini her açtığında onu parmak izi ekranına düşürürdü —
 * yani kilit, uygulamanın kendi akışını kırardı. Bir dakika, dosya seçmeye
 * yeten ama telefonu masada bırakmaya yetmeyen bir aralık.
 */
const KILIT_MUHLETI_MS = 60_000;

interface LockState {
  /** User preference: require biometrics to open the app. */
  enabled: boolean;
  /** Whether the lock overlay is currently shown. */
  locked: boolean;
  /**
   * Tercihi kaydeder. Cihaza YAZILAMAZSA false döner — çağıran taraf bunu
   * kullanıcıya söylemek zorundadır (aşağıdaki açıklamaya bakınız).
   */
  setEnabled: (enabled: boolean) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
}

export const useLockStore = create<LockState>((set, get) => ({
  enabled: false,
  locked: false,
  /**
   * TERCİH KAYDEDİLEMEZSE SESSİZ KALINMAZ.
   *
   * Eski hâlde yazma hatası yutuluyordu: kullanıcı kilidi açıyor, anahtar
   * ekranda AÇIK görünüyor, uygulama yeniden başlatıldığında kilit YOK.
   * Kullanıcı kilidin kurulu olduğunu sanarak telefonunu bırakır — güvenlik
   * ayarının sessizce çalışmaması, hiç olmamasından kötüdür.
   */
  setEnabled: async (enabled) => {
    set({ enabled, locked: false });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      return true;
    } catch {
      return false;
    }
  },
  lock: () => {
    if (get().enabled) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));

/**
 * Uygulama arka plana geçip geri döndüğünde kilidin yeniden devreye girmesi
 * gerekip gerekmediğine karar verir.
 *
 * BULUNAN KUSUR. `lock()` fonksiyonunu HİÇBİR YER çağırmıyordu; kilit yalnız
 * soğuk açılışta (hydrateLock) devreye giriyordu. Sonuç: avukat sabah parmak
 * izini okutup uygulamayı açıyor, gün boyunca telefon açık kalıyor ve
 * uygulama bir daha hiç kilitlenmiyordu — işletim sistemi uygulamayı bellekten
 * atana kadar. Yani "uygulama kilidi" fiilen yalnızca telefonun yeniden
 * başlatılmasına karşı koruyordu; masada bırakılan bir telefona karşı değil.
 *
 * Saf tutuldu ki karar (mühlet) test edilebilsin.
 */
export function kilitGerekliMi(
  arkaPlanaGecisMs: number | null,
  simdiMs: number,
  muhletMs: number = KILIT_MUHLETI_MS
): boolean {
  if (arkaPlanaGecisMs === null) return false;
  return simdiMs - arkaPlanaGecisMs > muhletMs;
}

export { KILIT_MUHLETI_MS };

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
