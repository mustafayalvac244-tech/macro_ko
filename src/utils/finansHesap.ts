/**
 * FİNANS AY ÖZETİ — TEK HESAP (10.10.2026 denetimi). Saf ve testli:
 * tests/finansHesap.test.ts.
 *
 * NEDEN. Aynı ayın toplamı iki ekranda iki ayrı koddan çıkıyordu:
 *  - Finans ekranı: tekrarlı kalemler (başlangıçtan bitiş ayına dek HER ay),
 *    dava tahsilatları ve gelirde `net_total`.
 *  - Ana ekran (pano) "Bu Ay": yalnız o ayın tek seferlik kayıtları ve
 *    `amount`. Kira gibi tekrarlı gider ve dava tahsilatı panoda hiç yoktu.
 * Avukat panoda bir, Finans'ta başka bir net görüyordu. Artık ikisi de bu
 * dosyadan okur; CSV de aynı `kayitlar` listesinden üretilir, dosya ekranla
 * birebir tutar.
 *
 * KURUŞ HASSASİYETİ. Tutarlar TAM KURUŞ (tamsayı) olarak toplanır, sonunda
 * 100'e bölünür: 0,1 + 0,2 + 0,07 tam 0,37 eder, 1000 × 0,01 tam 10 eder.
 * Düz kayan noktalı toplama bunlarda sapar (testte gösterildi).
 *
 * GELİRDE `net_total`: KDV eklenmiş, stopaj düşülmüş — hesaba gerçekte giren
 * nakit budur (KDV/stopajsız kayıtta `net_total` zaten `amount`'a eşittir).
 * Giderde `amount`.
 */

export interface FinansKaydi {
  kind: 'income' | 'expense';
  amount: number | string;
  net_total?: number | string | null;
  vat_amount?: number | string | null;
  withholding_amount?: number | string | null;
  /** Postgres `date`: "yyyy-MM-dd". */
  entry_date: string;
  is_recurring: boolean;
  recurring_until?: string | null;
}

export interface FinansOdemesi {
  amount: number | string;
  /** timestamptz — YEREL takvim gününe göre ayrılır. */
  paid_at: string;
}

export interface AyKalemi {
  tur: 'gelir' | 'gider';
  kurus: number;
  /** Ayın günü (1–31): ana ekrandaki küçük sütunlar için. */
  gun: number;
}

export interface AyOzeti<T extends FinansKaydi> {
  /** Ayda GEÇERLİ kayıtlar (durdurulmuş/bitmiş tekrarlılar yok); girdi sırası korunur. */
  kayitlar: T[];
  gelir: number;
  gider: number;
  net: number;
  /** Gelire dahil dava tahsilatlarının toplamı ve adedi. */
  odemeToplam: number;
  odemeAdet: number;
  /** Yalnız `kayitlar` içindeki kalemlerin KDV / stopaj toplamı. */
  kdvToplam: number;
  stopajToplam: number;
  kalemler: AyKalemi[];
}

/** Bir `Date`in YEREL "yyyy-MM" anahtarı. */
export function ayAnahtari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TARIH = /^(\d{4}-\d{2})-(\d{2})/;

/** Tutarı tam kuruşa çevirir; okunamazsa 0. */
function kurus(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
}

/**
 * Kayıt `ay` ("yyyy-MM") içinde geçerli mi?
 *  - Tek seferlik: yalnız kendi ayında.
 *  - Tekrarlı: başladığı aydan itibaren, `recurring_until` ayı DAHİL.
 * Ay karşılaştırması metin üzerinden yapılır: `new Date('yyyy-MM-dd')` UTC
 * gece yarısıdır ve UTC'nin batısında bir önceki güne düşer.
 */
export function kayitAyda(k: Pick<FinansKaydi, 'entry_date' | 'is_recurring' | 'recurring_until'>, ay: string): boolean {
  const basla = TARIH.exec(k.entry_date ?? '')?.[1];
  if (!basla) return false;
  if (!k.is_recurring) return basla === ay;
  if (basla > ay) return false;
  const bitis = k.recurring_until ? TARIH.exec(k.recurring_until)?.[1] : undefined;
  return !bitis || bitis >= ay;
}

export function ayOzeti<T extends FinansKaydi>(
  kayitlar: readonly T[],
  odemeler: readonly FinansOdemesi[],
  ay: string,
): AyOzeti<T> {
  let gelirK = 0;
  let giderK = 0;
  let odemeK = 0;
  let odemeAdet = 0;
  let kdvK = 0;
  let stopajK = 0;
  const gecerli: T[] = [];
  const kalemler: AyKalemi[] = [];

  for (const k of kayitlar) {
    if (!kayitAyda(k, ay)) continue;
    gecerli.push(k);
    const gun = Number(TARIH.exec(k.entry_date)?.[2]) || 1;
    if (k.kind === 'income') {
      const kr = kurus(k.net_total ?? k.amount);
      gelirK += kr;
      kalemler.push({ tur: 'gelir', kurus: kr, gun });
    } else {
      const kr = kurus(k.amount);
      giderK += kr;
      kalemler.push({ tur: 'gider', kurus: kr, gun });
    }
    kdvK += kurus(k.vat_amount);
    stopajK += kurus(k.withholding_amount);
  }

  for (const p of odemeler) {
    const d = new Date(p.paid_at);
    if (Number.isNaN(d.getTime()) || ayAnahtari(d) !== ay) continue;
    const kr = kurus(p.amount);
    odemeK += kr;
    odemeAdet += 1;
    kalemler.push({ tur: 'gelir', kurus: kr, gun: d.getDate() });
  }

  const gelirToplamK = gelirK + odemeK;
  return {
    kayitlar: gecerli,
    gelir: gelirToplamK / 100,
    gider: giderK / 100,
    net: (gelirToplamK - giderK) / 100,
    odemeToplam: odemeK / 100,
    odemeAdet,
    kdvToplam: kdvK / 100,
    stopajToplam: stopajK / 100,
    kalemler,
  };
}

/**
 * KDV / stopaj oranı geçerli mi? Veritabanı CHECK'i 0–100 (0070). Okunamayan
 * (NaN) oran eskiden `|| 0` ile sessizce %0 kaydediliyordu; 100'ü aşan oran ise
 * veritabanında reddedilip genel "kaydedilemedi" olarak görünüyordu.
 */
export function oranGecerliMi(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
