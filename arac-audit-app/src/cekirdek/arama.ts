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

// YAZIM HATASI TOLERANSI (26.10.2026). İkinci dış değerlendirmede saha
// denetçisi eldivenle "camurlk", "kaptu" yazdı ve sonuç alamadı. Yalnız TAM
// eşleşme hiç sonuç vermediğinde kullanılır ve ekranda "yakın sonuçlar" diye
// ayrı gösterilir: doğru yazana fazladan, alakasız sonuç düşmesin.

/** İki dize arasındaki düzenleme uzaklığı (yer değiştirme bir adım sayılır). */
export function duzenlemeUzakligi(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const m = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + m);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Sorgu kelimesi, metindeki bir kelimenin BAŞINA en çok `izin` hatayla
 * uyuyor mu? 3 harften kısa kelimede hata kabul edilmez ("on" → "ön"
 * zaten sadeleştirmeyle tutuyor); 4–6 harfte bir, 7+ harfte iki hata.
 */
function yakinKelime(q: string, k: string): boolean {
  if (k.startsWith(q)) return true;
  const izin = q.length < 4 ? 0 : q.length < 7 ? 1 : 2;
  if (!izin) return false;
  // Kelimenin sorgu uzunluğundaki başı (±1 harf: eksik ya da fazla harf).
  for (let n = q.length - 1; n <= q.length + 1; n++) {
    if (n < 1 || n > k.length) continue;
    if (duzenlemeUzakligi(q, k.slice(0, n)) <= izin) return true;
  }
  return false;
}

/** aramaEslesir'in yazım hatasına dayanıklı hâli: her kelime yakın bir kelimeyle eşleşmeli. */
export function aramaYakinEslesir(metin: string, sorgu: string): boolean {
  const sozcukler = aramaSadelestir(sorgu).split(' ').filter(Boolean);
  if (!sozcukler.length) return true;
  const kelimeler = metin.split(' ');
  return sozcukler.every((q) => kelimeler.some((k) => yakinKelime(q, k)));
}
