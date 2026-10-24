import { describe, expect, it } from 'vitest';

import { listedenCikar, listedeyse, listeyeEkle } from '../arac-audit-app/src/cekirdek/listeler';
import { excelUret, htmlRapor } from '../arac-audit-app/src/cekirdek/rapor';
import { Denetim } from '../arac-audit-app/src/cekirdek/tipler';

// Yeni denetim formu, 28.09.2026 ürün sahibi isteği: denetçi listeden seçilir,
// "isteyen ekstra ekleyebilir"; üretim hattı ve vardiya kaldırıldı. Faz listesi
// de vardı; faz 24.10.2026'da formdan kalktı (ürün sahibinin seçimi).

describe('seçim listeleri', () => {
  it('ekler, fazla boşluğu atar', () => {
    expect(listeyeEkle(['T1'], '  P1  ')).toEqual({ liste: ['T1', 'P1'], secilen: 'P1' });
    expect(listeyeEkle([], 'Ali   Veli')).toEqual({ liste: ['Ali Veli'], secilen: 'Ali Veli' });
  });

  it('aynı adı ikinci kez eklemez; var olan yazılışı seçer', () => {
    // "ali veli" ile "Ali Veli" raporda iki ayrı kişi gibi görünmemeli.
    const liste = ['Ali Veli', 'Ayşe Kaya'];
    expect(listeyeEkle(liste, 'ali veli')).toEqual({ liste, secilen: 'Ali Veli' });
    expect(listeyeEkle(liste, '  ayşe   kaya ')).toEqual({ liste, secilen: 'Ayşe Kaya' });
  });

  it('Türkçe büyük/küçük harfi doğru karşılaştırır', () => {
    // Türkçe olmayan küçültmede "İ" → "i̇" (iki karakter) olur ve bu eşleşme kaçar.
    const { liste, secilen } = listeyeEkle(['İsmail Işık'], 'ismail ışık');
    expect(liste).toEqual(['İsmail Işık']);
    expect(secilen).toBe('İsmail Işık');
  });

  it('boş girdi listeyi değiştirmez', () => {
    expect(listeyeEkle(['T1'], '   ')).toEqual({ liste: ['T1'], secilen: '' });
  });

  it('çıkarır; listede olmayan hatırlanmış değer boş sayılır', () => {
    expect(listedenCikar(['A', 'B'], 'A')).toEqual(['B']);
    expect(listedeyse(['B'], 'A')).toBe('');
    expect(listedeyse(['B'], 'B')).toBe('B');
  });
});

describe('rapor başlığı — hat ve vardiya', () => {
  const d = (hat: string, vardiya: string): Denetim => ({
    id: 'd', aracId: 'ioniq3', vin: 'V', plaka: '', raporNo: 'R-1', denetci: 'Denetçi A', hat, vardiya,
    denetimTipi: 'HMC Audit', faz: 'LP2', ekip: 'QE Team 2', spec: '', km: null,
    baslangic: '2026-09-28T08:30:00', bitis: null, durum: 'devam', hatalar: [],
  });

  // XLSX sıkıştırmasız ("store") ZIP; hücre metinleri baytların içinde düz durur.
  const excelMetni = (x: Denetim) => new TextDecoder('utf-8').decode(excelUret(x, new Map(), { dil: 'en' }));

  it('boşken "Line / Shift" basılmaz, denetçi ve rapor no kalır', () => {
    const html = htmlRapor(d('', ''), new Map(), { dil: 'en' });
    expect(html).not.toContain('Line / Shift');
    expect(html).toContain('Denetçi A');
    expect(html).toContain('R-1');
    // Eksik çift için boş kutu çizilmez.
    expect(html).not.toContain('<span></span><strong></strong>');

    const excel = excelMetni(d('', ''));
    expect(excel).not.toContain('Line / Shift');
    expect(excel).toContain('Denetçi A');
    expect(excel).toContain('R-1');
  });

  it('eski bir denetimde doluysa kaybolmaz', () => {
    expect(htmlRapor(d('Montaj 2', 'B'), new Map(), { dil: 'en' })).toContain('Montaj 2 / B');
    expect(excelMetni(d('Montaj 2', 'B'))).toContain('Montaj 2 / B');
  });
});
