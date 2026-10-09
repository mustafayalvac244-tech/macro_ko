/**
 * DOSYA BAYTLARINI METNE ÇEVİR — UTF-8, değilse Windows-1254 (08.10.2026).
 *
 * BULUNAN KUSUR (denetimde bulundu). Toplu aktarımda CSV hep UTF-8 diye
 * okunuyordu. Türkçe Excel "CSV (virgülle ayrılmış)" kaydını Windows-1254
 * kodlamasıyla yazar; UTF-8 sanılınca ç/ğ/ı/ş/İ yerine "�" çıkıyor ve müvekkil
 * adları, mahkemeler bozuk kaydediliyordu.
 *
 * Kural: bayt dizisi GEÇERLİ UTF-8 ise UTF-8 (BOM atılır); değilse 1254.
 * Geçerli UTF-8 denetimi kendimizce yapılıyor: Hermes'teki TextDecoder'ın
 * 'fatal' ve 'windows-1254' desteğine güvenmiyoruz (ölçülmedi).
 */

/** 0x80–0x9F aralığı (cp1254). Tanımsız kodlar boşluk. */
const CP1254_80: string[] = [
  '€', ' ', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', ' ', ' ', ' ',
  ' ', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', ' ', ' ', 'Ÿ',
];
/** 0xA0–0xFF aralığında Latin-1'den farklı olan altı Türkçe harf. */
const CP1254_FARK: Record<number, string> = { 0xd0: 'Ğ', 0xdd: 'İ', 0xde: 'Ş', 0xf0: 'ğ', 0xfd: 'ı', 0xfe: 'ş' };

export function gecerliUtf8(b: Uint8Array): boolean {
  let i = 0;
  while (i < b.length) {
    const c = b[i]!;
    if (c < 0x80) { i += 1; continue; }
    let n: number;
    if (c >= 0xc2 && c <= 0xdf) n = 1;
    else if (c >= 0xe0 && c <= 0xef) n = 2;
    else if (c >= 0xf0 && c <= 0xf4) n = 3;
    else return false;
    for (let k = 1; k <= n; k += 1) {
      const d = b[i + k];
      if (d === undefined || (d & 0xc0) !== 0x80) return false;
    }
    i += n + 1;
  }
  return true;
}

function utf8Coz(b: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < b.length) {
    const c = b[i]!;
    let kod: number;
    if (c < 0x80) { kod = c; i += 1; }
    else if (c < 0xe0) { kod = ((c & 0x1f) << 6) | (b[i + 1]! & 0x3f); i += 2; }
    else if (c < 0xf0) { kod = ((c & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f); i += 3; }
    else { kod = ((c & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f); i += 4; }
    s += String.fromCodePoint(kod);
  }
  return s;
}

function cp1254Coz(b: Uint8Array): string {
  let s = '';
  for (const c of b) {
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xa0) s += CP1254_80[c - 0x80];
    else s += CP1254_FARK[c] ?? String.fromCharCode(c);
  }
  return s;
}

export function baytlariMetneCevir(girdi: Uint8Array | ArrayBuffer): string {
  let b = girdi instanceof Uint8Array ? girdi : new Uint8Array(girdi);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3);
  return gecerliUtf8(b) ? utf8Coz(b) : cp1254Coz(b);
}
