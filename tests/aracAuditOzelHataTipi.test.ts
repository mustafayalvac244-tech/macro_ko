import { beforeEach, describe, expect, it } from 'vitest';

import {
  DERECELER,
  HATA_TIPI_INDEKS,
  HATA_TIPLERI,
  ozelHataTipleriniAyarla,
  parcaHataTipleri,
  tumHataTipleri,
} from '../arac-audit-app/src/cekirdek/katalog';
import { dereceGosterimi } from '../arac-audit-app/src/cekirdek/puan';
import { SUTUNLAR } from '../arac-audit-app/src/cekirdek/rapor';
import { HataTipi } from '../arac-audit-app/src/cekirdek/tipler';

// Ekibin uygulama içinden eklediği hata tipleri.
//
// BU TESTİN VAR OLMA SEBEBİ: bozulma SESSİZDİR. Özel tip katalog indeksine
// bağlanmazsa uygulama çalışmaya devam eder, hata kaydedilir, hiçbir uyarı
// çıkmaz — ama Excel raporunda hata adı yerine "ht_m4x9k2" yazar ve bunu
// ancak raporu açan kişi, günler sonra fark eder.

const tip = (o: Partial<HataTipi> & { id: string }): HataTipi => ({
  grup: 'yuzey', ad: 'Deneme', en: 'Test', derece: '1', ozel: true, ...o,
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
    id: 'h1', parcaId: 'sol_on_kapi', hataTipiId: 'ht_9', derece: '2' as const,
    kabulEdilebilir: false,
    adet: 1, konum: '', aciklama: '', zaman: '2026-09-15T10:00:00.000Z',
    durum: 'acik' as const, atananKisi: null, gideren: null, giderilmeZamani: null,
    dogrulayan: null, dogrulamaZamani: null, fotograflar: [],
  };

  beforeEach(() => ozelHataTipleriniAyarla([
    tip({ id: 'ht_9', grup: 'sizdirmazlik', ad: 'Fitil ucu kalkık', en: 'Weatherstrip lifted', derece: '2' }),
  ]));

  it('hata tipi sütununda ad yazar, kimlik değil', () => {
    expect(sutun('hata').deger(hata, 0, { dil: 'tr' })).toBe('Fitil ucu kalkık');
    expect(sutun('hata').deger(hata, 0, { dil: 'en' })).toBe('Weatherstrip lifted');
  });

  it('hata grubu sütunu çözülür', () => {
    expect(sutun('grup').deger(hata, 0, { dil: 'tr' })).toBe('Sızdırmazlık');
  });
});

describe('derece gösterimi — parantez anlamı tersine çevirir', () => {
  // Ekibin sistemi (16.09.2026): 3 = hata, (3) = kabul edilebilir. Parantez
  // raporda kaybolursa kabul edilmiş bir bulgu iş emri doğurur; fazladan
  // eklenirse gerçek bir hata "kabul edildi" diye kapanır. İki yön de
  // sessizdir, o yüzden ikisi de sınanır.
  const derece = SUTUNLAR.find((x) => x.anahtar === 'derece')!;
  const h = (d: '1' | '2' | '3', kabulEdilebilir: boolean) => ({
    id: 'x', parcaId: 'kaput', hataTipiId: 'cizik', derece: d, kabulEdilebilir,
    adet: 1, konum: '', aciklama: '', zaman: '2026-09-16T10:00:00.000Z',
    durum: 'acik' as const, fotograflar: [],
  });

  it('düz derece parantezsiz yazılır', () => {
    expect(dereceGosterimi(h('3', false))).toBe('3');
    expect(derece.deger(h('3', false), 0, { dil: 'tr' })).toBe('3');
  });

  it('kabul edilebilir derece parantez içinde yazılır', () => {
    expect(dereceGosterimi(h('3', true))).toBe('(3)');
    expect(derece.deger(h('1', true), 0, { dil: 'tr' })).toBe('(1)');
  });

  it('Excel sütunu da aynı kaynağı kullanır (ekranla rapor ayrışmasın)', () => {
    for (const d of ['1', '2', '3'] as const) {
      for (const k of [false, true]) {
        expect(derece.deger(h(d, k), 0, { dil: 'tr' })).toBe(dereceGosterimi(h(d, k)));
      }
    }
  });

  it('eski A/B/C ve ceza puanı sütunu raporda yok', () => {
    expect(SUTUNLAR.find((x) => x.anahtar === 'puan')).toBeUndefined();
    expect(DERECELER.map((d) => d.id).sort()).toEqual(['1', '2', '3']);
  });
});
