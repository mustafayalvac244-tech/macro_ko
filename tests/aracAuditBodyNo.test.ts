import { describe, expect, it } from 'vitest';

import { excelUret, htmlRapor } from '../arac-audit-app/src/cekirdek/rapor';
import { Denetim } from '../arac-audit-app/src/cekirdek/tipler';
import { aracKimligi, bodyNoSadelestir } from '../arac-audit-app/src/cekirdek/vin';

// Ürün sahibi, 24.10.2026: şirketteki Excel formu aracı model + body numarası
// ile tanıyor ("015253"); "Body no ile giriş" ve "Problem Source" istendi.

describe('body no', () => {
  it('baştaki sıfır korunur (metin, sayı değil)', () => {
    expect(bodyNoSadelestir('015253')).toBe('015253');
  });

  it('boşluk ve işaretler atılır, harf büyür, en çok 12 karakter', () => {
    expect(bodyNoSadelestir(' 015 253 ')).toBe('015253');
    expect(bodyNoSadelestir('bj-015253')).toBe('BJ-015253');
    expect(bodyNoSadelestir('1234567890123456')).toBe('123456789012');
    expect(bodyNoSadelestir(null)).toBe('');
  });

  it('araç kimliği: şasi varsa şasi, yoksa "Body …", ikisi de yoksa boş', () => {
    expect(aracKimligi({ vin: 'NLHB51ABPDH1234S6', bodyNo: '015253' })).toBe('NLHB51ABPDH1234S6');
    expect(aracKimligi({ vin: '', bodyNo: '015253' })).toBe('Body 015253');
    expect(aracKimligi({ vin: '' })).toBe('');
  });
});

describe('rapor — body no ve kaynak', () => {
  const d = (o: Partial<Denetim>): Denetim => ({
    id: 'd', aracId: 'i20', vin: '', bodyNo: '015253', plaka: '', raporNo: '', denetci: 'Denetçi A', hat: '', vardiya: '',
    denetimTipi: 'Durability', faz: '', ekip: '', spec: '', km: null,
    baslangic: '2026-10-24T08:30:00', bitis: null, durum: 'devam', hatalar: [], ...o,
  });
  const excelMetni = (x: Denetim) => new TextDecoder('utf-8').decode(excelUret(x, new Map(), { dil: 'en' }));

  it('şasisiz denetimde Excel ve web raporu body no ve kaynağı yazar', () => {
    const x = excelMetni(d({}));
    expect(x).toContain('Body No');
    expect(x).toContain('015253');
    expect(x).toContain('Durability');
    const html = htmlRapor(d({}), new Map(), { dil: 'en' });
    expect(html).toContain('<span>Body No</span><strong>015253</strong>');
    expect(html).toContain('Body 015253');
  });
});
