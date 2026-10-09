import { describe, expect, it } from 'vitest';
import { baytlariMetneCevir, gecerliUtf8 } from '../src/utils/metinKodlama';
import { tarihCevir } from '../src/utils/iceAktarim';

// Türkçe Excel CSV'yi Windows-1254 ile kaydeder; UTF-8 sanılınca ç/ğ/ı/ş/İ "�" oluyordu.
const cp1254 = (s: string) => {
  const ozel: Record<string, number> = { Ğ: 0xd0, İ: 0xdd, Ş: 0xde, ğ: 0xf0, ı: 0xfd, ş: 0xfe };
  return new Uint8Array([...s].map((h) => ozel[h] ?? h.charCodeAt(0)));
};

describe('baytlariMetneCevir', () => {
  const metin = 'Müvekkil;Mahkeme\nŞükrü Çağlar Işık;İstanbul 3. İş Mahkemesi\nğüşıöç ĞÜŞİÖÇ';

  it('UTF-8 aynen okunur, BOM atılır', () => {
    const b = new TextEncoder().encode('﻿' + metin);
    expect(baytlariMetneCevir(b)).toBe(metin);
  });

  it('Windows-1254 (Excel CSV) doğru okunur', () => {
    expect(baytlariMetneCevir(cp1254(metin))).toBe(metin);
  });

  it('UTF-8 geçerlilik denetimi', () => {
    expect(gecerliUtf8(new TextEncoder().encode('çğış 😀'))).toBe(true);
    expect(gecerliUtf8(cp1254('çğış'))).toBe(false);
    expect(gecerliUtf8(new Uint8Array([0xc3]))).toBe(false); // yarım dizi
  });

  it('emoji ve 4 baytlık karakterler', () => {
    expect(baytlariMetneCevir(new TextEncoder().encode('Dava 📎 notu'))).toBe('Dava 📎 notu');
  });
});

describe('tarihCevir — takvimde olmayan gün', () => {
  it.each([
    ['31.02.2026', null],
    ['29.02.2025', null],
    ['29.02.2024', '2024-02-29'],
    ['2026-13-45', null],
    ['2026-02-30', null],
    ['15.09.2026', '2026-09-15'],
    ['2026-09-15', '2026-09-15'],
  ])('%s → %s', (g, b) => {
    expect(tarihCevir(g)).toBe(b);
  });
});
