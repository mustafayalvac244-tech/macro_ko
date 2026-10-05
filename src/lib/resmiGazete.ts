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
