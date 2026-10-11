/**
 * RESMÎ GAZETE — gösterim kuralları (05.10.2026).
 *
 * Veri sunucuda çekilir ve ayrıştırılır (supabase/functions/_shared/
 * resmiGazete.ts → public.resmi_gazete). Burada yalnız "avukata neyi önce
 * gösterelim" kararı var. Başlıklar Gazete'nin fihristinden AYNEN gelir;
 * hiçbir başlık yeniden yazılmaz ya da özetlenmez.
 */

export interface GazeteMaddesi {
  bolum: string;
  grup: string;
  baslik: string;
  url: string;
  mukerrer?: boolean;
}

export interface GazeteGunu {
  tarih: string;
  sayi: number | null;
  maddeler: GazeteMaddesi[];
  mukerrer: number;
  cekildi: string;
}

/**
 * Öne çıkan gruplar. ÜRÜN KARARI, ölçüm değil: kanun ve yargı kararları
 * avukatın işini doğrudan değiştirir; atama kararları değiştirmez.
 */
const ONCELIK: Array<[RegExp, number]> = [
  [/^KANUN/, 0],
  [/KARARNAME/, 1],
  [/ANAYASA MAHKEMESİ/, 2],
  [/YARGITAY|DANIŞTAY|UYUŞMAZLIK/, 3],
  [/CUMHURBAŞKANI KARAR/, 4],
  [/GENELGE/, 5],
  [/YÖNETMELİK/, 6],
  [/TEBLİĞ/, 7],
  [/H[ÂA]KİMLER VE SAVCILAR/, 8],
  [/KURUL KARAR/, 9],
  [/ANDLAŞMA|ANLAŞMA/, 10],
  [/ATAMA/, 99],
];

export function grupOnceligi(grup: string): number {
  for (const [re, n] of ONCELIK) if (re.test(grup)) return n;
  return 50;
}

/** Üniversitelerin iç yönetmelikleri — avukat için düşük öncelikli. */
export function universiteMi(m: GazeteMaddesi): boolean {
  return /YÖNETMELİK/.test(m.grup) && /Üniversitesi/.test(m.baslik);
}

/** Atama ve üniversite yönetmeliği dışındakiler, önceliğe göre. */
export function onemliMaddeler(maddeler: GazeteMaddesi[]): GazeteMaddesi[] {
  return maddeler
    .map((m, i) => ({ m, i, p: grupOnceligi(m.grup) }))
    .filter(({ m, p }) => p < 99 && !universiteMi(m))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map(({ m }) => m);
}

/** Ekran için: gruplar önceliğe göre, grup içi Gazete sırası. */
export function grupla(maddeler: GazeteMaddesi[]): Array<{ grup: string; maddeler: GazeteMaddesi[] }> {
  const sira: string[] = [];
  const harita = new Map<string, GazeteMaddesi[]>();
  for (const m of maddeler) {
    const g = m.grup || m.bolum;
    if (!harita.has(g)) {
      harita.set(g, []);
      sira.push(g);
    }
    harita.get(g)!.push(m);
  }
  return sira
    .map((grup, i) => ({ grup, i, maddeler: harita.get(grup)! }))
    .sort((a, b) => grupOnceligi(a.grup) - grupOnceligi(b.grup) || a.i - b.i)
    .map(({ grup, maddeler: ms }) => ({ grup, maddeler: ms }));
}

export type ListeDurumu =
  | { ekran: 'hata' | 'bos'; uyari: null }
  | { ekran: 'liste'; uyari: null | 'yenilenemedi' }
  | { ekran: 'liste'; uyari: 'bayat'; sonTarih: string };

/** Türkiye'nin bugünkü takvim günü (UTC+3, yaz saati yok) — sunucudaki turkiyeBugun ile aynı. */
export function turkiyeGunu(simdi: Date = new Date()): string {
  return new Date(simdi.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Ekran ne göstermeli (10.10.2026 denetimi). Eskiden `isError` her şeyden önce
 * geliyordu: arka plandaki yenileme düşünce, önbellekte duran gün listesi
 * TAMAMEN gizlenip "Liste yüklenemedi" çıkıyordu. Şimdi tam ekran hata yalnız
 * gösterilecek hiç veri yokken; veri varsa liste kalır, üstte uyarı çıkar.
 * İkinci uyarı "bayat": en yeni kayıtlı gün bugünden eskiyse (bugünün sayısı
 * henüz çekilmemiş ya da çekilememiş) bu söylenir; gece yarısından sonraki ilk
 * saatlerde bu normaldir ve metin yalnız "en güncel sayı şu tarihte" der.
 */
export function listeDurumu(gunler: GazeteGunu[], isError: boolean, bugun: string): ListeDurumu {
  if (gunler.length === 0) return { ekran: isError ? 'hata' : 'bos', uyari: null };
  if (isError) return { ekran: 'liste', uyari: 'yenilenemedi' };
  const sonTarih = gunler.reduce((en, g) => (g.tarih > en ? g.tarih : en), gunler[0].tarih);
  if (sonTarih < bugun) return { ekran: 'liste', uyari: 'bayat', sonTarih };
  return { ekran: 'liste', uyari: null };
}
