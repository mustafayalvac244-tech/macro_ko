import { beforeEach, describe, expect, it } from 'vitest';

import {
  HATA_TIPI_INDEKS,
  HATA_TIPLERI,
  ozelHataTipleriniAyarla,
  parcaHataTipleri,
  tumHataTipleri,
} from '../arac-audit-app/src/cekirdek/katalog';
import { SUTUNLAR } from '../arac-audit-app/src/cekirdek/rapor';
import { HataTipi } from '../arac-audit-app/src/cekirdek/tipler';

// Ekibin uygulama içinden eklediği hata tipleri.
//
// BU TESTİN VAR OLMA SEBEBİ: bozulma SESSİZDİR. Özel tip katalog indeksine
// bağlanmazsa uygulama çalışmaya devam eder, hata kaydedilir, hiçbir uyarı
// çıkmaz — ama Excel raporunda hata adı yerine "ht_m4x9k2" yazar ve bunu
// ancak raporu açan kişi, günler sonra fark eder.

const tip = (o: Partial<HataTipi> & { id: string }): HataTipi => ({
  grup: 'yuzey', ad: 'Deneme', en: 'Test', siddet: 'C', ozel: true, ...o,
});

describe('özel hata tipleri — katalog katmanı', () => {
  beforeEach(() => ozelHataTipleriniAyarla([]));

  it('eklenen tip katalog indeksinde çözülür (rapor ham kimlik yazmasın)', () => {
    ozelHataTipleriniAyarla([tip({ id: 'ht_1', ad: 'Fitil ucu kalkık' })]);
    expect(HATA_TIPI_INDEKS['ht_1']?.ad).toBe('Fitil ucu kalkık');
  });

  it('eklenen tip, grubu uyan parçanın seçim listesine girer', () => {
    ozelHataTipleriniAyarla([tip({ id: 'ht_2', grup: 'ses', ad: 'Cam indirirken tık sesi' })]);
    const idler = parcaHataTipleri('sol_on_kapi').map((t) => t.id);
    expect(idler).toContain('ht_2');
  });

  it('grubu uymayan parçada listelenmez', () => {
    // 'cam' grubu kapı sacında tanımlı değil; oraya sızmamalı.
    ozelHataTipleriniAyarla([tip({ id: 'ht_3', grup: 'cam' })]);
    const idler = parcaHataTipleri('sol_on_kapi').map((t) => t.id);
    expect(idler).not.toContain('ht_3');
  });

  it('kaldırılan tip seçimden çıkar AMA indekste kalır', () => {
    // En kritik davranış: eski hatalar bu kimliğe bağlı. İndeksten de düşerse
    // geçmiş raporlar hata adını kaybeder.
    ozelHataTipleriniAyarla([tip({ id: 'ht_4', ad: 'Eski tip', silindi: true })]);
    expect(tumHataTipleri().map((t) => t.id)).not.toContain('ht_4');
    expect(parcaHataTipleri('sol_on_kapi').map((t) => t.id)).not.toContain('ht_4');
    expect(HATA_TIPI_INDEKS['ht_4']?.ad).toBe('Eski tip');
  });

  it('yerleşik bir kimliği ezemez', () => {
    // Ezebilseydi "Çizik" kaydı raporda başka bir hatayı anlatmaya başlardı.
    const once = HATA_TIPI_INDEKS['cizik']!.ad;
    ozelHataTipleriniAyarla([tip({ id: 'cizik', ad: 'SAHTE' })]);
    expect(HATA_TIPI_INDEKS['cizik']!.ad).toBe(once);
    expect(tumHataTipleri().filter((t) => t.id === 'cizik')).toHaveLength(1);
  });

  it('yeniden bağlamak önceki özel tipleri bırakmaz', () => {
    ozelHataTipleriniAyarla([tip({ id: 'ht_5' })]);
    ozelHataTipleriniAyarla([tip({ id: 'ht_6' })]);
    expect(HATA_TIPI_INDEKS['ht_5']).toBeUndefined();
    expect(HATA_TIPI_INDEKS['ht_6']).toBeDefined();
  });

  it('boş listeyle yerleşik katalog bozulmadan kalır', () => {
    ozelHataTipleriniAyarla([]);
    expect(tumHataTipleri()).toHaveLength(HATA_TIPLERI.length);
    expect(Object.keys(HATA_TIPI_INDEKS)).toHaveLength(HATA_TIPLERI.length);
  });
});

describe('özel hata tipleri — Excel sütunları', () => {
  // Asıl teslimat Excel raporu. Sütun fonksiyonları katalog indeksini
  // İÇE AKTARMA ANINDA yakalıyor; özel tip oraya bağlanmazsa hata adı
  // sütununda ham kimlik, grup sütununda boş hücre çıkar.
  const sutun = (anahtar: string) => {
    const s = SUTUNLAR.find((x) => x.anahtar === anahtar);
    if (!s) throw new Error(`sütun yok: ${anahtar}`);
    return s;
  };

  const hata = {
    id: 'h1', parcaId: 'sol_on_kapi', hataTipiId: 'ht_9', siddet: 'B' as const,
    adet: 1, konum: '', aciklama: '', zaman: '2026-09-15T10:00:00.000Z',
    durum: 'acik' as const, atananKisi: null, gideren: null, giderilmeZamani: null,
    dogrulayan: null, dogrulamaZamani: null, fotograflar: [],
  };

  beforeEach(() => ozelHataTipleriniAyarla([
    tip({ id: 'ht_9', grup: 'sizdirmazlik', ad: 'Fitil ucu kalkık', en: 'Weatherstrip lifted', siddet: 'B' }),
  ]));

  it('hata tipi sütununda ad yazar, kimlik değil', () => {
    expect(sutun('hata').deger(hata, 0, { dil: 'tr' })).toBe('Fitil ucu kalkık');
    expect(sutun('hata').deger(hata, 0, { dil: 'en' })).toBe('Weatherstrip lifted');
  });

  it('hata grubu sütunu çözülür', () => {
    expect(sutun('grup').deger(hata, 0, { dil: 'tr' })).toBe('Sızdırmazlık');
  });
});
