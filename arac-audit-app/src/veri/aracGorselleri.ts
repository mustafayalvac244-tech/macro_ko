// ARAÇ GÖRSELLERİ (360°) — standart bakış görselleri, YALNIZ BU TELEFONDA.
//
// Ürün sahibi, 26.10.2026: döndürülebilir araç görünümü için resmî görselleri
// seçti; elindekiler standart bakışlar (önden, sol önden, soldan …, üstten).
// Her araç için dokuz yuva var (cekirdek/donusGorunumu.ts); her yuvaya
// galeriden TEK görsel seçilir, değiştirilir ya da temizlenir.
//
// Depo da APK bağlantısı da herkese açık; görseller ne koda ne pakete girer.
// Seçilen görsel küçültülüp uygulamanın belge klasörüne kopyalanır (galeriden
// silinse de kalır). Görselin en/boy ölçüsü saklanır: parça haritası yalnız
// oranı uyan görsele uygulanır.
//
// Mutlak adres SAKLANMAZ: iOS güncellemede uygulama klasörünün yolu değişebilir;
// klasör ve dosya adı saklanır, adres açılışta kurulur. Web'de (yalnız sınav
// için) seçilen görselin geçici adresi yalnız bellekte tutulur, kaydedilmez:
// sayfa yenilenince adres ölür, görünüm boş görsel yerine haritaya döner.
//
// YEDEK: tam yedek (yedek.ts) bu görselleri ALMAZ — yeniden aktarılabilir;
// denetim yedeğini de büyütürdü.

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { GorunumId } from '@/cekirdek/gorunumParcalari';
import { fotografKucult } from '@/cekirdek/goruntu';
import { ayarOku, ayarYaz } from '@/veri/depo';

export interface YuvaGorseli {
  /** Belge klasöründeki dosya adı; web'de tam adres. */
  ad: string;
  /** Piksel ölçüsü (küçültülmüş hâli; oranı özgünüyle aynı). */
  en: number;
  boy: number;
}

export interface AracGorseli {
  yuvalar: Partial<Record<GorunumId, YuvaGorseli>>;
}

const ANAHTAR = 'aracGorselleri';
const KOK = 'arac-gorselleri';
/** Görsel genişliği: telefonda keskin, dokuz görselde belleği yormayacak kadar. */
const GORSEL_EN = 1600;

const web = Platform.OS === 'web';

/** Yuvanın gösterilecek adresi. */
export function yuvaAdresi(aracId: string, g: YuvaGorseli): string {
  return web ? g.ad : new File(Paths.document, KOK, aracId, g.ad).uri;
}

export type SecimSonucu = { durum: 'tamam' } | { durum: 'iptal' } | { durum: 'izinYok' };

interface Durum {
  gorseller: Record<string, AracGorseli>;
  yuklendi: boolean;
  yukle: () => Promise<void>;
  yuvaSec: (aracId: string, yuva: GorunumId) => Promise<SecimSonucu>;
  yuvaTemizle: (aracId: string, yuva: GorunumId) => void;
}

const dosyaSil = (aracId: string, g: YuvaGorseli | undefined) => {
  if (!g || web) return;
  try {
    const f = new File(Paths.document, KOK, aracId, g.ad);
    if (f.exists) f.delete();
  } catch { /* silinemeyen dosya yalnız yer kaplar; kayıt yine kalkar */ }
};

export const useAracGorselleri = create<Durum>((set, get) => {
  const kaydet = (gorseller: Record<string, AracGorseli>) => {
    set({ gorseller });
    if (!web) ayarYaz(ANAHTAR, gorseller).catch(() => { /* bu oturumda geçerli */ });
  };

  return {
    gorseller: {},
    yuklendi: false,

    yukle: async () => {
      try {
        const k = await ayarOku<Record<string, AracGorseli> | null>(ANAHTAR, null);
        set({ gorseller: k && typeof k === 'object' ? k : {}, yuklendi: true });
      } catch {
        set({ yuklendi: true });
      }
    },

    yuvaSec: async (aracId, yuva) => {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) return { durum: 'izinYok' };
      const secim = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: false, quality: 1 });
      if (secim.canceled || !secim.assets?.[0]) return { durum: 'iptal' };
      const varlik = secim.assets[0];

      let yeni: YuvaGorseli;
      if (web) {
        yeni = { ad: varlik.uri, en: varlik.width || 1, boy: varlik.height || 1 };
      } else {
        const klasor = new Directory(Paths.document, KOK, aracId);
        klasor.create({ intermediates: true, idempotent: true });
        const kucuk = await fotografKucult(varlik.uri, Math.min(GORSEL_EN, varlik.width || GORSEL_EN), 0.88);
        // Her seçimde yeni ad: görüntü önbelleği eski görseli göstermesin.
        const ad = `${yuva}-${Date.now()}.jpg`;
        await new File(kucuk.uri).move(new File(klasor, ad));
        yeni = { ad, en: kucuk.en, boy: kucuk.boy };
      }
      const eski = get().gorseller[aracId]?.yuvalar[yuva];
      const arac = get().gorseller[aracId] ?? { yuvalar: {} };
      kaydet({ ...get().gorseller, [aracId]: { yuvalar: { ...arac.yuvalar, [yuva]: yeni } } });
      dosyaSil(aracId, eski);
      return { durum: 'tamam' };
    },

    yuvaTemizle: (aracId, yuva) => {
      const arac = get().gorseller[aracId];
      if (!arac?.yuvalar[yuva]) return;
      const eski = arac.yuvalar[yuva];
      const yuvalar = { ...arac.yuvalar };
      delete yuvalar[yuva];
      const gorseller = { ...get().gorseller };
      if (Object.keys(yuvalar).length) gorseller[aracId] = { yuvalar };
      else delete gorseller[aracId];
      kaydet(gorseller);
      dosyaSil(aracId, eski);
    },
  };
});

/** Aracın en az bir görseli var mı (yoksa şematik harita gösterilir). */
export const gorselVar = (g: AracGorseli | undefined): boolean => !!g && Object.keys(g.yuvalar).length > 0;
