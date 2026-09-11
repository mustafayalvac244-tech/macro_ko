/**
 * İNDİRİLEN DOSYANIN ADI.
 *
 * Web'de yapay zekâ çıktısı (dilekçe, belge incelemesi, mütalaa) bir dosya
 * olarak indirilebiliyor. Dosya adı tarayıcıya olduğu gibi geçtiği için
 * Türkçe karakter, boşluk ve yol ayıracı barındırmamalı: Windows'ta `\ / : * ?
 * " < > |` yasak, macOS'ta `:` yol ayıracıdır, ve "İ" (U+0130) bazı
 * sistemlerde bozuk kaydediliyor.
 *
 * Bu modül saf tutuldu (Platform/DOM yok) — testten geçirilebilsin diye.
 */

const HARF_KARSILIGI: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/** Türkçe harfleri sadeleştirir. toLowerCase KULLANMAZ — "İ" harfinin uzunluğu değişmesin. */
function sadelestir(s: string): string {
  let out = '';
  for (const ch of s) out += HARF_KARSILIGI[ch] ?? ch;
  return out.toLowerCase();
}

/**
 * Başlıktan güvenli bir dosya adı üretir.
 *
 * @param baslik  ekrandaki başlık (ör. "Dilekçe Taslağı")
 * @param uzanti  nokta olmadan (ör. "txt")
 * @param tarih   dosya adına eklenecek tarih; verilmezse bugünün tarihi
 */
export function dosyaAdiUret(baslik: string, uzanti: string, tarih: Date = new Date()): string {
  const govde =
    sadelestir(baslik)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'vekil-pro';

  const g = `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}-${String(
    tarih.getDate()
  ).padStart(2, '0')}`;

  const uz = sadelestir(uzanti).replace(/[^a-z0-9]/g, '') || 'txt';
  return `${govde}-${g}.${uz}`;
}
