/**
 * TUTAR VE ORAN GİRİŞİ — tek ayrıştırıcı, testli (08.10.2026).
 *
 * BULUNAN KUSUR (50 denetçi taraması, kodla doğrulandı). Tutar kutuları her
 * ekranda ayrı ayrı ayrıştırılıyordu ve iki zıt hata vardı:
 *
 *  1. "Her nokta binliktir" (finans, taksit, icra, hesaplayıcı, saat ücreti):
 *     `s.replace(/\./g, '').replace(',', '.')`. Veritabanından gelen 1250.5
 *     forma `String()` ile "1250.5" diye yazılıyor, kaydet 12505 yapıyordu.
 *     Taksit taslağı "333.33" üretip 33333 kaydediyordu (1.000 ₺ → 100.000 ₺).
 *     Faiz oranı "24.5" → %245.
 *  2. "Yalnız virgül ondalıktır" (dava detayı, müvekkil, dava formu):
 *     `Number(s.replace(',', '.'))`. "10.000" → 10 ₺, "1.250,50" → NaN.
 *
 * KURAL. Tutar Türkçe yazılır ama kullanıcı noktayı ondalık için de basabilir
 * (Android ve web klavyesi). Bu yüzden:
 *  - İki ayraç birden varsa SONUNCUSU ondalıktır: "1.250,50", "1,250.50".
 *  - Aynı ayraç birden çok kez geçiyorsa binliktir: "1.250.000".
 *  - Tek ayraç ve ardından TAM 3 rakam varsa binliktir: "10.000", "2,500".
 *    (Para 2 haneli ondalık taşır; 3 haneli ondalık yazan yok.)
 *  - Tek ayraç ve ardından 1–2 rakam varsa ondalıktır: "1250.5", "333,33".
 * Binlik grupları 3 haneli değilse ("1.25.000") sayı GEÇERSİZDİR: yanlış bir
 * tutarı sessizce kaydetmek, kullanıcıya "okunamadı" demekten kötüdür.
 *
 * ORAN ayrı ayrıştırılır: oranda binlik yoktur, tek ayraç her zaman ondalıktır
 * ("24.5" ve "24,5" → 24,5; "%20" → 20).
 */

/** Tutar metnini sayıya çevirir; okunamazsa NaN. Negatif kabul edilmez. */
export function tutarOku(girdi: string | null | undefined): number {
  if (girdi == null) return NaN;
  const s = String(girdi).replace(/[\s ₺]/g, '').replace(/(TL|TRY)$/i, '');
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;

  const sonNokta = s.lastIndexOf('.');
  const sonVirgul = s.lastIndexOf(',');
  let tam: string;
  let ondalik = '';
  let binlik: string | null = null;

  if (sonNokta >= 0 && sonVirgul >= 0) {
    const ondalikAyrac = sonNokta > sonVirgul ? '.' : ',';
    binlik = ondalikAyrac === '.' ? ',' : '.';
    const i = s.lastIndexOf(ondalikAyrac);
    tam = s.slice(0, i);
    ondalik = s.slice(i + 1);
    if (tam.includes(ondalikAyrac)) return NaN; // "1.250,50,3"
  } else if (sonNokta >= 0 || sonVirgul >= 0) {
    const ayrac = sonNokta >= 0 ? '.' : ',';
    const parcalar = s.split(ayrac);
    if (parcalar.length > 2) {
      binlik = ayrac;
      tam = s;
    } else {
      const [once, sonra] = parcalar as [string, string];
      if (sonra.length === 3 && once.length > 0 && Number(once) > 0) {
        binlik = ayrac;
        tam = s;
      } else {
        tam = once;
        ondalik = sonra;
      }
    }
  } else {
    tam = s;
  }

  if (binlik) {
    const gruplar = tam.split(binlik);
    const [ilk, ...kalan] = gruplar as [string, ...string[]];
    if (!/^\d{1,3}$/.test(ilk) || kalan.some((g) => !/^\d{3}$/.test(g))) return NaN;
    tam = gruplar.join('');
  }
  if (!/^\d*$/.test(tam) || !/^\d*$/.test(ondalik)) return NaN;
  if (!tam && !ondalik) return NaN;
  const n = Number(`${tam || '0'}.${ondalik || '0'}`);
  return Number.isFinite(n) ? n : NaN;
}

/** Oran metnini (yüzde) sayıya çevirir; okunamazsa NaN. "24.5", "24,5", "%20". */
export function oranOku(girdi: string | null | undefined): number {
  if (girdi == null) return NaN;
  const s = String(girdi).replace(/[\s %]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Kayıtlı tutarı FORM KUTUSUNA yazar: 1250.5 → "1250,50", 12500 → "12500".
 * Binlik ayracı konmaz; `tutarOku` bu çıktıyı her zaman aynı sayıya geri çevirir.
 */
export function tutarYaz(n: number | string | null | undefined): string {
  const x = typeof n === 'string' ? Number(n) : n;
  if (x == null || !Number.isFinite(x)) return '';
  const yuvarlak = Math.round(x * 100) / 100;
  return Number.isInteger(yuvarlak) ? String(yuvarlak) : yuvarlak.toFixed(2).replace('.', ',');
}

/** Kayıtlı oranı form kutusuna yazar: 24.5 → "24,5", 20 → "20". */
export function oranYaz(n: number | string | null | undefined): string {
  const x = typeof n === 'string' ? Number(n) : n;
  if (x == null || !Number.isFinite(x)) return '';
  return String(Math.round(x * 10000) / 10000).replace('.', ',');
}
