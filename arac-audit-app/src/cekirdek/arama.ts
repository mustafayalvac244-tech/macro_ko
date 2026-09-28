// ARAMA — parça ve hata tipi aramasının ortak kuralı (28.09.2026).
//
// Kullanılabilirlik sınamasında (üç ajan, web paketi) "sol ön kapı" araması
// dıştaki sol ön kapıyı BULMUYORDU. Eşleşme tek parça alt dize aramasıydı;
// parçanın adı "Ön kapı", tarafı yalnız bölge adında ("Dış · Sol yan"), sıra
// tutmadığı için yalnız iç döşeme ("Sol ön kapı döşemesi") çıkıyordu. Denetçi
// çıkan tek sonuca dokunup hatayı yanlış parçaya yazabilirdi.
//
// Kural:
//  - sorgudaki HER kelime aranır, sıra önemsiz ("ön kapı sol" = "sol ön kapı");
//  - kelime, metindeki bir kelimenin BAŞIYLA eşleşir: "sol" konSOL'u bulmaz;
//  - Türkçe karakter şart değil ("sag on kapi" → "Sağ ön kapı"): eldivenle ya
//    da Türkçe olmayan klavyeyle yazana göre.

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Küçük harf (Türkçe kuralıyla), Türkçe harfler Latin karşılığına, noktalama boşluğa. */
export function aramaSadelestir(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => HARF[c] ?? c)
    // "İ" Türkçe küçültmede "i" olur; Türkçe dışı bir motor "i̇" (i + nokta) bırakırsa noktayı at.
    .replace(/̇/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Aranacak metni kurar: verilen parçalar birleştirilip sadeleştirilir. */
export function aramaMetni(...parcalar: (string | null | undefined)[]): string {
  return aramaSadelestir(parcalar.filter(Boolean).join(' '));
}

/**
 * Sorgunun her kelimesi `metin`deki bir kelimenin başıyla eşleşiyor mu?
 * `metin` aramaMetni() ile kurulmuş olmalı. Boş sorgu her şeyle eşleşir.
 */
export function aramaEslesir(metin: string, sorgu: string): boolean {
  const sozcukler = aramaSadelestir(sorgu).split(' ').filter(Boolean);
  if (!sozcukler.length) return true;
  const kelimeler = metin.split(' ');
  return sozcukler.every((q) => kelimeler.some((k) => k.startsWith(q)));
}
