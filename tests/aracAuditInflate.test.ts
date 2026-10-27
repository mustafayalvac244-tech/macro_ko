import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { inflate } from '../arac-audit-app/src/cekirdek/inflate';

// 27.10.2026 — ekibin NAS dosyasını (deflate'li ZIP) okumak için yazılan çözücü.
// Doğruluk ölçütü Node'un zlib'i: aynı veriyi zlib sıkıştırır, biz açarız.

const metin = (n: number) => {
  const p = ['<row r="', '"><c r="A', '" t="s"><v>', '</v></c>', 'FRT BUMPER', 'T GATE INR PNL', 'Çizik ğüşıöç'];
  let s = '';
  for (let i = 0; s.length < n; i++) s += p[i % p.length] + String(i * 7919 % 1000);
  return new TextEncoder().encode(s.slice(0, n));
};
const rastgele = (n: number, tohum = 1) => {
  const b = new Uint8Array(n);
  let x = tohum;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; }
  return b;
};

describe('inflate', () => {
  it('zlib\'in sıkıştırdığını aynen açar: metin, rastgele, boş, büyük; bütün seviyeler', () => {
    const veriler = [new Uint8Array(0), metin(10), metin(5000), rastgele(3000), metin(400_000), rastgele(70_000, 7)];
    for (const v of veriler) {
      for (const level of [0, 1, 6, 9]) {
        const s = deflateRawSync(v, { level });
        expect([...inflate(s, v.length)].length).toBe(v.length);
        expect(Buffer.from(inflate(s)).equals(Buffer.from(v))).toBe(true);
      }
    }
  });

  it('sabit Huffman (kısa veri) ve saklı blok (level 0) açılır', () => {
    const v = new TextEncoder().encode('abcabcabcabc');
    expect(new TextDecoder().decode(inflate(deflateRawSync(v, { level: 9 })))).toBe('abcabcabcabc');
    expect(new TextDecoder().decode(inflate(deflateRawSync(v, { level: 0 })))).toBe('abcabcabcabc');
  });

  it('bozuk veri sessizce kesilmez, hata verir', () => {
    const s = deflateRawSync(metin(20_000));
    expect(() => inflate(s.subarray(0, s.length >> 1))).toThrow(/DEFLATE/);
    expect(() => inflate(new Uint8Array([0xFF, 0xFF, 0xFF]))).toThrow(/DEFLATE/);
  });
});
