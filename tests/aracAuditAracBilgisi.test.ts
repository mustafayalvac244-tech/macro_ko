import { describe, expect, it } from 'vitest';

import { kmAyikla, kmGoster, kmSadelestir } from '../arac-audit-app/src/cekirdek/aracBilgisi';
import { excelUret, htmlRapor } from '../arac-audit-app/src/cekirdek/rapor';
import { Denetim } from '../arac-audit-app/src/cekirdek/tipler';

// Ürün sahibi, 28.09.2026: "Spec seçimi de ekleyelim LH RH km bilgisi yazalım."

describe('kilometre', () => {
  it('kutu yalnız rakam tutar, en çok 7 hane', () => {
    expect(kmSadelestir('12.345')).toBe('12345');
    expect(kmSadelestir('12 345 km')).toBe('12345');
    expect(kmSadelestir('abc')).toBe('');
    expect(kmSadelestir('0012')).toBe('12');
    expect(kmSadelestir('0')).toBe('0');
    expect(kmSadelestir('123456789')).toBe('1234567');
  });

  it('boş "girilmedi" (null) sayılır; 0 geçerli bir değerdir', () => {
    expect(kmAyikla('')).toBeNull();
    expect(kmAyikla('0')).toBe(0);
    expect(kmAyikla('12.345')).toBe(12345);
  });

  it('binlik ayırıcı dile göre: tr nokta, en virgül', () => {
    expect(kmGoster(12345)).toBe('12.345 km');
    expect(kmGoster(12345, 'en')).toBe('12,345 km');
    expect(kmGoster(1234567)).toBe('1.234.567 km');
    expect(kmGoster(999)).toBe('999 km');
    expect(kmGoster(0)).toBe('0 km');
    expect(kmGoster(null)).toBe('');
  });
});

describe('rapor başlığında spec ve km', () => {
  const d = (spec: string, km: number | null): Denetim => ({
    id: 'd', aracId: 'i20', vin: 'V', plaka: '', raporNo: '', denetci: 'Denetçi A', hat: '', vardiya: '',
    denetimTipi: 'HMC Audit', faz: 'T1', ekip: '', spec, km,
    baslangic: '2026-09-28T08:30:00', bitis: null, durum: 'devam', hatalar: [],
  });
  const excelMetni = (x: Denetim) => new TextDecoder('utf-8').decode(excelUret(x, new Map(), { dil: 'en' }));

  it('girildiyse Excel ve web raporunda görünür', () => {
    const html = htmlRapor(d('RH', 12345), new Map(), { dil: 'en' });
    expect(html).toContain('<span>Spec</span><strong>RH</strong>');
    expect(html).toContain('<span>Mileage</span><strong>12,345 km</strong>');
    const excel = excelMetni(d('RH', 12345));
    expect(excel).toContain('RH');
    expect(excel).toContain('12,345 km');
  });

  it('girilmediyse boş kalır, "null" ya da "undefined" yazılmaz', () => {
    const html = htmlRapor(d('', null), new Map(), { dil: 'en' });
    expect(html).toContain('<span>Spec</span><strong></strong>');
    expect(html).not.toMatch(/null|undefined/);
    expect(excelMetni(d('', null))).not.toMatch(/>null<|>undefined</);
  });
});
