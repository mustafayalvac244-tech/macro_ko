import { beforeEach, describe, expect, it } from 'vitest';

import {
  DERECELER,
  HATA_TIPI_INDEKS,
  HATA_TIPLERI,
  ozelHataTipleriniAyarla,
  parcaHataTipleri,
  parcaTamAdi,
  tumHataTipleri,
} from '../arac-audit-app/src/cekirdek/katalog';
import { denetimOzeti, dereceGosterimi, topluOzet } from '../arac-audit-app/src/cekirdek/puan';
import { raporBasligi, sorunMetni, SutunBaglami, SUTUNLAR } from '../arac-audit-app/src/cekirdek/rapor';
import { Denetim, Hata, HataTipi } from '../arac-audit-app/src/cekirdek/tipler';

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

// Ortak örnekler — Hata tipinin TÜM alanları dolu olsun ki tip denetimi
// testin kendisini de sınasın (vitest tip denetlemiyor; bu dosya ayrıca
// tsc'den geçiriliyor).
const ornekHata = (o: Partial<Hata> & { parcaId: string; hataTipiId: string }): Hata => ({
  id: 'h', derece: '2', kabulEdilebilir: false, sorunTipi: 'Part', sorumlu: '',
  adet: 1, konum: '', aciklama: '', zaman: '2026-09-26T10:00:00.000Z',
  durum: 'acik', fotograflar: [], ...o,
});
const baglam = (dil: 'tr' | 'en'): SutunBaglami => ({
  dil, denetim: { faz: 'LP2', ekip: 'QE Team 2', denetimTipi: 'HMC Audit' },
});
const sutun = (anahtar: string) => {
  const s = SUTUNLAR.find((x) => x.anahtar === anahtar);
  if (!s) throw new Error(`sütun yok: ${anahtar}`);
  return s;
};

describe('özel hata tipleri — Excel sütunları', () => {
  // Asıl teslimat Excel raporu. Sütun fonksiyonları katalog indeksini
  // İÇE AKTARMA ANINDA yakalıyor; özel tip oraya bağlanmazsa açıklama
  // sütununda ham kimlik çıkar.
  const hata = ornekHata({ parcaId: 'sol_on_kapi', hataTipiId: 'ht_9' });

  beforeEach(() => ozelHataTipleriniAyarla([
    tip({ id: 'ht_9', grup: 'sizdirmazlik', ad: 'Fitil ucu kalkık', en: 'Weatherstrip lifted', derece: '2' }),
  ]));

  it('açıklama sütununda tipin adı geçer, kimliği geçmez', () => {
    const tr = String(sutun('sorun').deger(hata, 0, baglam('tr')));
    const en = String(sutun('sorun').deger(hata, 0, baglam('en')));
    expect(tr).toContain('Fitil ucu kalkık');
    expect(en).toContain('weatherstrip lifted');
    expect(`${tr} ${en}`).not.toMatch(/ht_/);
  });

  it('özetteki hata grubu özel tip için de çözülür', () => {
    const o = denetimOzeti({ hatalar: [hata] });
    expect(o.grupDagilimi.map((g) => g.ad)).toEqual(['Sızdırmazlık']);
  });

  it('İngilizcesi boş bırakılan özel tip yarım cümle üretmez', () => {
    ozelHataTipleriniAyarla([tip({ id: 'ht_10', ad: 'Klips izi', en: '' })]);
    const en = sorunMetni(ornekHata({ parcaId: 'kaput', hataTipiId: 'ht_10' }), 'en');
    expect(en).toBe('Hood klips izi');
  });
});

describe('derece gösterimi — parantez anlamı tersine çevirir', () => {
  // Ekibin sistemi (26.09.2026): 3 = hata, (3) = kabul edilebilir. Parantez
  // raporda kaybolursa kabul edilmiş bir bulgu iş emri doğurur; fazladan
  // eklenirse gerçek bir hata "kabul edildi" diye kapanır. İki yön de
  // sessizdir, o yüzden ikisi de sınanır.
  const derece = sutun('derece');
  const h = (d: '1' | '2' | '3', kabulEdilebilir: boolean) =>
    ornekHata({ parcaId: 'kaput', hataTipiId: 'cizik', derece: d, kabulEdilebilir });

  it('düz derece parantezsiz yazılır', () => {
    expect(dereceGosterimi(h('3', false))).toBe('3');
    expect(derece.deger(h('3', false), 0, baglam('tr'))).toBe('3');
  });

  it('kabul edilebilir derece parantez içinde yazılır', () => {
    expect(dereceGosterimi(h('3', true))).toBe('(3)');
    expect(derece.deger(h('1', true), 0, baglam('en'))).toBe('(1)');
  });

  it('Excel sütunu da aynı kaynağı kullanır (ekranla rapor ayrışmasın)', () => {
    for (const d of ['1', '2', '3'] as const) {
      for (const k of [false, true]) {
        expect(derece.deger(h(d, k), 0, baglam('tr'))).toBe(dereceGosterimi(h(d, k)));
      }
    }
  });

  it('eski A/B/C ve ceza puanı sütunu raporda yok', () => {
    expect(SUTUNLAR.find((x) => x.anahtar === 'puan')).toBeUndefined();
    expect(DERECELER.map((d) => d.id).sort()).toEqual(['1', '2', '3']);
  });

  it('özet kabul edilebilir bulguyu derece sayısına KATMAZ', () => {
    // "3 × derece 3" yazıp (3)'ü de hata saymak, kabul edilmiş bulguyu
    // düzeltilecek iş gibi gösterirdi.
    const o = denetimOzeti({ hatalar: [h('3', false), h('3', true), { ...h('3', true), adet: 2 }] });
    expect(o.dereceDagilimi['3']).toEqual({ adet: 1, kabul: 3 });
    expect(o.toplamAdet).toBe(4);
    expect(o.kabulEdilebilirAdet).toBe(3);
  });

  it('DPU kabul edilebilir bulguları saymaz', () => {
    const d = (hatalar: Hata[]): Denetim => ({
      id: 'd', aracId: 'i20', vin: '', plaka: '', raporNo: '', denetci: '', hat: '', vardiya: '',
      denetimTipi: '', faz: '', ekip: '', spec: '', km: null, baslangic: '', bitis: null, durum: 'devam', hatalar,
    });
    const t = topluOzet([d([h('3', false), h('2', true)]), d([h('1', true)])]);
    // 3 bulgu, 2'si kabul edilebilir → 2 araçta 1 hata → 0.5
    expect(t.dpu).toBe(0.5);
  });
});

describe('ekibin tablosu — "Part Related Issues" düzeni', () => {
  // Kaynak: ekibin 26.09.2026'da gönderdiği ekran görüntüsü. C ve D
  // sütunlarının anlamı bilinmediği için bu listede YOKLAR; F'ye derece
  // kondu ama F'deki "A"nın anlamı sorulmadı. Bu test düzenin kendisini
  // belgeliyor: sütun sırası kazara değişirse düşer.
  it('sütun sırası ekibin tablosunu izler', () => {
    expect(SUTUNLAR.map((s) => s.baslikEn)).toEqual([
      'No', 'Area', 'Phase', 'Grade', 'Issue', 'Type', 'Photo', 'Source', 'Team', 'Responsible',
    ]);
    expect(SUTUNLAR.filter((s) => s.fotograf)).toHaveLength(1);
  });

  it('denetim düzeyindeki sütunlar denetimden gelir', () => {
    const h = ornekHata({ parcaId: 'kaput', hataTipiId: 'cizik' });
    expect(sutun('faz').deger(h, 0, baglam('en'))).toBe('LP2');
    expect(sutun('kaynak').deger(h, 0, baglam('en'))).toBe('HMC Audit');
    expect(sutun('ekip').deger(h, 0, baglam('en'))).toBe('QE Team 2');
  });

  it('açıklama bölge olmadan okunur: dış yan panele taraf eklenir', () => {
    // Katalogda "Ön çamurluk" tarafı taşımıyor, taraf yalnız bölge adında.
    expect(sorunMetni(ornekHata({ parcaId: 'sol_on_camurluk', hataTipiId: 'cizik' }), 'en'))
      .toBe('LH front fender scratch');
    expect(sorunMetni(ornekHata({ parcaId: 'sag_on_camurluk', hataTipiId: 'cizik' }), 'tr'))
      .toBe('Sağ ön çamurluk — Çizik');
  });

  it('tarafı zaten taşıyan parçaya ikinci kez eklenmez', () => {
    expect(parcaTamAdi('sol_on_kapi_doseme', 'en')).toBe('LH front door trim');
    expect(parcaTamAdi('sol_on_kapi_doseme', 'tr')).toBe('Sol ön kapı döşemesi');
  });

  it('tek harfli ya da kısaltmayla başlayan ad küçültülmez', () => {
    expect(parcaTamAdi('sol_a_diregi', 'tr')).toBe('Sol A direği (dış)');
    expect(sorunMetni(ornekHata({ parcaId: 'kaput', hataTipiId: 'hata_kodu' }), 'en'))
      .toBe('Hood DTC present');
  });

  it('İngilizce küçültme Türkçe yerel ayarla yapılmaz ("ınoperative" değil)', () => {
    // Türkçe yerelde "I".toLocaleLowerCase("tr") === "ı". Yerleşik tiplerden
    // Inoperative, Intermittent, Impact mark bu yoldan geçiyor.
    const en = sorunMetni(ornekHata({ parcaId: 'sol_far', hataTipiId: 'calismiyor' }), 'en');
    expect(en).toBe('LH headlamp inoperative');
    expect(en).not.toContain('ı');
    expect(sorunMetni(ornekHata({ parcaId: 'kaput', hataTipiId: 'ezik' }), 'en')).toBe('Hood impact mark');
  });

  it('ayrıntı ve adet ekibin yazım biçimiyle eklenir', () => {
    // Ekibin örneği: "FR door trim wrinkle - quadrant inner & near B PLR"
    const h = ornekHata({
      parcaId: 'sol_on_kapi', hataTipiId: 'bosluk', konum: 'upper corner', aciklama: 'near B PLR', adet: 2,
    });
    expect(sorunMetni(h, 'en')).toBe('LH front door gap variation - upper corner, near B PLR (x2)');
    expect(sorunMetni(h, 'tr')).toBe('Sol ön kapı — Boşluk farkı (gap) — upper corner, near B PLR (2 adet)');
  });

  it('başlık ekibin tablosunun ilk satırını izler', () => {
    const d: Denetim = {
      id: 'd', aracId: 'ioniq3', vin: 'V', plaka: '', raporNo: '', denetci: '', hat: '', vardiya: '',
      denetimTipi: 'HMC Audit', faz: 'LP2', ekip: 'QE Team 2', spec: '', km: null,
      baslangic: '2026-09-26T08:30:00', bitis: null, durum: 'devam', hatalar: [],
    };
    expect(raporBasligi(d, 'en')).toBe('Hyundai IONIQ 3 LP2 — Part-Related Issues (QE Team 2, 26.09.2026)');
    // Faz ve ekip boşsa başlık bozulmaz
    expect(raporBasligi({ ...d, faz: '', ekip: '' }, 'en')).toBe('Hyundai IONIQ 3 — Part-Related Issues (26.09.2026)');
  });
});
