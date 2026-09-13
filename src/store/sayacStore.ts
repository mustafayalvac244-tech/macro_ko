import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gecenDakika } from '@/utils/zamanKaydi';

// ÇALIŞAN SAYAÇ.
// ---------------------------------------------------------------------------
// NEDEN SAYAÇ VAR. Elle süre girmek, çalışma bittikten SONRA hatırlamayı
// gerektirir; avukat günün sonunda "o görüşme kaç dakikaydı" diye tahmin eder
// ve tahmin hep aşağı kayar. Smokeball'un uluslararası piyasadaki ayrışma
// noktası tam olarak budur (kaynak: karşılaştırma yazıları, Eylül 2026).
//
// NEDEN BAŞLANGIÇ ANI SAKLANIYOR, GEÇEN SÜRE DEĞİL. Uygulama arka plana
// atılınca ya da tamamen kapanınca JS zamanlayıcısı durur. Geçen süreyi
// saysaydık sayaç arka planda donardı ve avukat 40 dakikalık görüşmeyi
// 3 dakika görürdü. Başlangıç damgasını saklayıp farkı OKURKEN hesaplıyoruz:
// uygulama kapansa da süre doğru işler.
//
// NEDEN DOĞRUDAN KAYIT YAZMIYOR. Sayaç durduğunda kaydı kendisi oluştursaydı
// iki ayrı yazma yolu olurdu (form ve sayaç) ve ikisi ayrışırdı. Sayaç yalnız
// dakikayı üretir; kaydı her zaman form yazar.

const KEY = 'vekil-calisan-sayac';

export interface SayacDurumu {
  caseId: string | null;
  caseTitle: string | null;
  /** Epoch ms. null ise sayaç çalışmıyor. */
  startedAt: number | null;
}

interface SayacState extends SayacDurumu {
  baslat: (caseId: string | null, caseTitle: string | null) => void;
  /** Sayacı durdurur ve geçen süreyi DAKİKA olarak döner (en az 1). */
  durdur: () => number;
  iptal: () => void;
}

function yaz(d: SayacDurumu) {
  AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
}

export const useSayacStore = create<SayacState>((set, get) => ({
  caseId: null,
  caseTitle: null,
  startedAt: null,

  baslat: (caseId, caseTitle) => {
    const next: SayacDurumu = { caseId, caseTitle, startedAt: Date.now() };
    set(next);
    yaz(next);
  },

  durdur: () => {
    const { startedAt } = get();
    const dakika = startedAt ? gecenDakika(startedAt) : 0;
    const next: SayacDurumu = { caseId: null, caseTitle: null, startedAt: null };
    set(next);
    yaz(next);
    return dakika;
  },

  iptal: () => {
    const next: SayacDurumu = { caseId: null, caseTitle: null, startedAt: null };
    set(next);
    yaz(next);
  },
}));

export async function hydrateSayac(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (!saved) return;
    const d = JSON.parse(saved) as SayacDurumu;
    // Bozuk ya da geleceğe ait damgayı yükleme: saat değişimi veya elle
    // kurcalama sonucu gelecekteki bir damga, negatif süre üretirdi.
    if (typeof d.startedAt === 'number' && d.startedAt > 0 && d.startedAt <= Date.now()) {
      useSayacStore.setState(d);
    }
  } catch {
    // varsayılan: sayaç kapalı
  }
}
