import { afterEach, describe, expect, it } from 'vitest';

import {
  aracHaritasiVar, cizimRolu, dokunulanYuz, dokunusSonucu, gorunenYuzler, gorunumHaritasi, goruntuKutusu, goruntuNoktasi, halka,
  HALKA_YUVALARI, kaymaSinirla, parcaDemeritleri, yakinKutu, YAKINLIKLAR, yogunlukKademesi, haritaOdagi, kaydirmaIndeksi, kutudakiNokta, odakKutusu, oranUyar, sar, UST_BOLGESI,
  yumusakYol, yuvaAdi, YUVALAR, YUZ_BOLGESI,
} from '../arac-audit-app/src/cekirdek/donusGorunumu';
import { GorunumId, PARCA_HARITALARI } from '../arac-audit-app/src/cekirdek/gorunumParcalari';
import { BOLGELER, PARCA_INDEKS, parcaCiftiAdi } from '../arac-audit-app/src/cekirdek/katalog';
import { sorunMetni } from '../arac-audit-app/src/cekirdek/rapor';
import { ARAC_INDEKS } from '../arac-audit-app/src/cekirdek/model3d';

// 26.10.2026 — ürün sahibi: "Hyundai sitelerinde aracı döndürebiliyoruz, araç
// üstünden parça seçmek için ekleyebilir miyiz?" Görseller telefonda; bu test
// yalnız saf hesabı korur. Beklentileri ben yazdım; açı yönü ürün sahibinin
// sol yan ve sol ön görselleriyle karşılaştırıldı (önü solda), başka gerçek
// görselle denenmedi.

const IONIQ3 = ARAC_INDEKS.ioniq3!;
const olcu = { uzunluk: IONIQ3.uzunluk, genislik: IONIQ3.genislik };

describe('yuvalar ve halka', () => {
  it('dokuz yuva; halka 0–315, üst halkada değil; adlar iki dilde', () => {
    expect(YUVALAR).toHaveLength(9);
    expect(HALKA_YUVALARI.map((x) => x.aci)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(yuvaAdi('sol_on')).toBe('Sol ön');
    expect(yuvaAdi('sag', 'en')).toBe('RH side');
    expect(yuvaAdi('ust', 'en')).toBe('Top');
  });

  it('eksik yan, karşı yanın aynası; ön/arka uydurulmaz', () => {
    const dolu = new Set<GorunumId>(['sol_on', 'sol', 'arka', 'ust']);
    const h = halka((y) => dolu.has(y));
    expect(h.map((x) => [x.yuva, x.kaynak, x.ayna])).toEqual([
      ['sol_on', 'sol_on', false], ['sol', 'sol', false], ['arka', 'arka', false],
      ['sag', 'sol', true], ['sag_on', 'sol_on', true],
    ]);
  });

  // 26.10.2026 — ürün sahibi: "360 seçim ekranında olmalı." Görsel yüklemeden
  // de: görseli olmayan yuva haritasından çizilir.
  it('görsel yoksa haritalı yuva çizilir; görsel her zaman çizimden önce', () => {
    const harita = new Set<GorunumId>(['on', 'sol_on', 'sol', 'sol_arka', 'arka', 'sag_arka', 'sag_on', 'ust']);
    expect(halka(() => false, (y) => harita.has(y)).map((x) => [x.yuva, x.kaynak, x.ayna, x.cizim])).toEqual([
      ['on', 'on', false, true], ['sol_on', 'sol_on', false, true], ['sol', 'sol', false, true],
      ['sol_arka', 'sol_arka', false, true], ['arka', 'arka', false, true], ['sag_arka', 'sag_arka', false, true],
      ['sag', 'sol', true, true], ['sag_on', 'sag_on', false, true],
    ]);
    // Sol yanın görseli varsa sağ yan onun aynası (görsel); öteki yuvalar çizim.
    const h = halka((y) => y === 'sol', (y) => harita.has(y));
    expect(h.find((x) => x.yuva === 'sol')).toMatchObject({ kaynak: 'sol', ayna: false, cizim: false });
    expect(h.find((x) => x.yuva === 'sag')).toMatchObject({ kaynak: 'sol', ayna: true, cizim: false });
    expect(h.find((x) => x.yuva === 'on')).toMatchObject({ kaynak: 'on', cizim: true });
    // Kendi haritası olan yuvada da eşin görseli (aynalı) çizimden önce gelir.
    const h2 = halka((y) => y === 'sol_on', (y) => harita.has(y));
    expect(h2.find((x) => x.yuva === 'sag_on')).toMatchObject({ kaynak: 'sol_on', ayna: true, cizim: false });
    // Haritası ve görseli olmayan araçta halka boş (şematik harita kalır).
    expect(halka(() => false, () => false)).toEqual([]);
  });

  it('IONIQ 3 görselsiz çizilir; haritası olmayan araç çizilmez', () => {
    expect(aracHaritasiVar('ioniq3')).toBe(true);
    expect(aracHaritasiVar('i20')).toBe(false);
    expect(aracHaritasiVar('yok-boyle')).toBe(false);
  });

  it('çizim rolleri: cam, lastik, siyah kaplama, gümüş garniş, far, DRL, stop, plaka, gövde', () => {
    expect(['on_cam', 'sol_on_kapi_cam', 'cam_tavan', 'sag_qtr_cam'].map(cizimRolu)).toEqual(['cam', 'cam', 'cam', 'cam']);
    expect(cizimRolu('sag_on_jant')).toBe('lastik');
    expect(['sol_camurluk_garnis', 'sag_b_diregi', 'sol_marspiyel', 'spoyler'].map(cizimRolu)).toEqual(['siyah', 'siyah', 'siyah', 'siyah']);
    expect(cizimRolu('on_tampon_alt_garnis')).toBe('gumus');
    expect([cizimRolu('sol_stop'), cizimRolu('sag_far'), cizimRolu('sol_drl'), cizimRolu('arka_plaka')]).toEqual(['stop', 'far', 'drl', 'plaka']);
    expect(['kaput', 'sol_on_kapi', 'sag_ayna', 'bagaj_kapagi'].map(cizimRolu)).toEqual(['govde', 'govde', 'govde', 'govde']);
  });

  it('kendi görseli olan yuva aynalanmaz', () => {
    const h = halka((y) => y === 'sol' || y === 'sag');
    expect(h.map((x) => [x.yuva, x.ayna])).toEqual([['sol', false], ['sag', false]]);
  });

  it('sürükleme: sağa çeyrek en bir yuva geri, sola yarım en iki yuva ileri', () => {
    expect(kaydirmaIndeksi(1, 0.25, 5)).toBe(0);
    expect(kaydirmaIndeksi(1, -0.5, 5)).toBe(3);
    expect(kaydirmaIndeksi(0, 0.25, 5)).toBe(4);
    expect(sar(-1, 5)).toBe(4);
    expect(sar(3, 0)).toBe(0);
  });
});

describe('yüz (haritasız görünüm)', () => {
  it('önden yalnız ön, yandan yalnız yan; köşeden iki yüz enin tamamını paylaşır', () => {
    expect(gorunenYuzler(0, olcu).map((y) => y.yuz)).toEqual(['on']);
    expect(gorunenYuzler(90, olcu).map((y) => y.yuz)).toEqual(['sol']);
    expect(gorunenYuzler(45, olcu).map((y) => y.yuz)).toEqual(['on', 'sol']);
    expect(gorunenYuzler(315, olcu).map((y) => y.yuz)).toEqual(['sag', 'on']);
    for (const aci of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const y = gorunenYuzler(aci, olcu);
      expect(y[0]!.bas).toBeCloseTo(0, 9);
      expect(y[y.length - 1]!.son).toBeCloseTo(1, 9);
    }
  });

  it('sol önden: solda ön, sağda sol yan; sağ önden tersi', () => {
    expect(dokunulanYuz(45, 0.1, olcu)).toBe('on');
    expect(dokunulanYuz(45, 0.8, olcu)).toBe('sol');
    expect(dokunulanYuz(315, 0.2, olcu)).toBe('sag');
    expect(dokunulanYuz(315, 0.9, olcu)).toBe('on');
    expect(dokunulanYuz(180, 0.5, olcu)).toBe('arka');
    expect(dokunulanYuz(0, 1.2, olcu)).toBeNull();
  });

  it('her yüz var olan bir dış bölgeye gider', () => {
    const bolgeler = new Set(BOLGELER.map((b) => b.id));
    for (const id of [...Object.values(YUZ_BOLGESI), UST_BOLGESI]) expect(bolgeler.has(id)).toBe(true);
  });
});

describe('görselin kaptaki yeri (contain)', () => {
  it('kap görselden genişse yanlarda, darsa üstte/altta boşluk', () => {
    expect(goruntuKutusu(400, 100, 2)).toEqual({ x: 100, y: 0, en: 200, boy: 100 });
    expect(goruntuKutusu(300, 300, 2)).toEqual({ x: 0, y: 75, en: 300, boy: 150 });
  });

  it('dokunuş görsel koordinatına; boşluğa dokunuş null', () => {
    expect(goruntuNoktasi(200, 150, 300, 300, 2)).toEqual({ x: 200 / 300, y: 0.5 });
    expect(goruntuNoktasi(150, 30, 300, 300, 2)).toBeNull();
    expect(goruntuNoktasi(50, 50, 400, 100, 2)).toBeNull();
    expect(goruntuNoktasi(300, 50, 400, 100, 2)).toEqual({ x: 1, y: 0.5 });
  });

  it('oran %2 içinde uyar', () => {
    expect(oranUyar(2.03, 2)).toBe(true);
    expect(oranUyar(1.96, 2)).toBe(true);
    expect(oranUyar(2.1, 2)).toBe(false);
    expect(oranUyar(0, 2)).toBe(false);
  });
});

describe('parça haritası ve dokunuş', () => {
  afterEach(() => { delete PARCA_HARITALARI.sinav; });
  const parcaVar = (id: string) => !!PARCA_INDEKS[id];

  it('harita yoksa ya da oran uymuyorsa null; varsa katalogda olmayan parça elenir', () => {
    expect(gorunumHaritasi('sinav', 'sol', false, 2, parcaVar)).toBeNull();
    PARCA_HARITALARI.sinav = {
      sol: {
        oran: 2,
        alanlar: [
          { parcaId: 'sol_on_kapi', nokta: [[0.3, 0.3], [0.5, 0.3], [0.5, 0.7], [0.3, 0.7]] },
          { parcaId: 'sol_yok_boyle', nokta: [[0.35, 0.35], [0.45, 0.35], [0.45, 0.45], [0.35, 0.45]] },
        ],
      },
    };
    expect(gorunumHaritasi('sinav', 'sol', false, 2.5, parcaVar)).toBeNull();
    const h = gorunumHaritasi('sinav', 'sol', false, 2.02, parcaVar)!;
    expect(h.alanlar.map((a) => a.parcaId)).toEqual(['sol_on_kapi']);
    // Bilinmeyen küçük çokgen elendiği için kapı gölgelenmez.
    expect(dokunusSonucu({ x: 0.4, y: 0.4 }, { aci: 90 }, h, olcu)).toEqual({ tur: 'parca', parcaId: 'sol_on_kapi' });
    expect(dokunusSonucu({ x: 0.9, y: 0.4 }, { aci: 90 }, h, olcu)).toEqual({ tur: 'bos' });
  });

  it('aynalanmış görünüm kaynağın aynalanmış haritasını kullanır', () => {
    PARCA_HARITALARI.sinav = {
      sol: { oran: 2, alanlar: [{ parcaId: 'sol_on_kapi', nokta: [[0.3, 0.3], [0.5, 0.3], [0.5, 0.7], [0.3, 0.7]] }] },
    };
    const h = gorunumHaritasi('sinav', 'sol', true, 2, parcaVar)!;
    expect(dokunusSonucu({ x: 0.6, y: 0.5 }, { aci: 270 }, h, olcu)).toEqual({ tur: 'parca', parcaId: 'sag_on_kapi' });
  });

  it('haritasız: halka görünümünde yüzün bölgesi, üst görünümde tavan', () => {
    expect(dokunusSonucu({ x: 0.1, y: 0.5 }, { aci: 45 }, null, olcu)).toEqual({ tur: 'bolge', bolgeId: 'dis_on' });
    expect(dokunusSonucu({ x: 0.5, y: 0.5 }, { aci: 270 }, null, olcu)).toEqual({ tur: 'bolge', bolgeId: 'dis_sag' });
    expect(dokunusSonucu({ x: 0.5, y: 0.5 }, { aci: null }, null, olcu)).toEqual({ tur: 'bolge', bolgeId: 'dis_ust' });
  });
});

// 26.10.2026 — ürün sahibi: "bu araba silueti neden boktan". Çizimde kenarlar
// kavislenir, sivri köşe kalır. Beklentileri ben yazdım.
describe('çizimde yumuşak kenar (yumusakYol)', () => {
  /** Yolu sayılara çevir: başlangıç noktası ve her kübik parçanın [c1x, c1y, c2x, c2y, x, y] altılısı. */
  const coz = (d: string) => {
    const s = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    const kup: number[][] = [];
    for (let i = 2; i < s.length; i += 6) kup.push(s.slice(i, i + 6));
    return { bas: [s[0]!, s[1]!], kup };
  };

  it('kare: dört köşe de sivri kalır, kenarlar düz', () => {
    expect(yumusakYol([[0, 0], [1, 0], [1, 1], [0, 1]], 10, 10))
      .toBe('M0,0C0,0 10,0 10,0C10,0 10,10 10,10C10,10 0,10 0,10C0,10 0,0 0,0Z');
  });

  it('düzgün 12-gen (her köşede 30°): eğri her köşeden geçer, kontrol noktası köşede değil ve kenarın %40\'ını aşmıyor', () => {
    const k = 12;
    const n = Array.from({ length: k }, (_, i) => [0.5 + 0.4 * Math.cos((2 * Math.PI * i) / k), 0.5 + 0.4 * Math.sin((2 * Math.PI * i) / k)] as const);
    const { bas, kup } = coz(yumusakYol(n, 100, 100));
    expect(kup).toHaveLength(k);
    const kenar = 2 * 40 * Math.sin(Math.PI / k);
    kup.forEach((c, i) => {
      expect(c[4]).toBeCloseTo(n[(i + 1) % k]![0] * 100, 0);
      expect(c[5]).toBeCloseTo(n[(i + 1) % k]![1] * 100, 0);
      const p = i === 0 ? bas : kup[i - 1]!.slice(4);
      const d = Math.hypot(c[0]! - p[0]!, c[1]! - p[1]!);
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThanOrEqual(kenar * 0.4 + 0.1);
    });
  });

  it('D biçimi: düz kenarın iki ucu sivri (90°), kavisli taraf yumuşak; kose=20 ile 46°lik köşe de sivrileşir', () => {
    const D = ([[0, 0], [5, 0], [8, 1.5], [9.5, 5], [8, 8.5], [5, 10], [0, 10]] as const).map(([x, y]) => [x / 10, y / 10] as const);
    const { kup } = coz(yumusakYol(D, 10, 10));
    // Son parça G(0,10) → A(0,0): iki ucu da sivri → düz çizgi.
    expect(kup[6]).toEqual([0, 10, 0, 0, 0, 0]);
    // A → B: A sivri (c1 = A), B yumuşak (c2 ≠ B).
    expect(kup[0]!.slice(0, 2)).toEqual([0, 0]);
    expect(kup[0]!.slice(2, 4)).not.toEqual([5, 0]);
    // C(8,1.5) → D(9.5,5): D'de dönüş ≈46° → yumuşak; kose=20 verilince sivri.
    expect(coz(yumusakYol(D, 10, 10)).kup[2]!.slice(2, 4)).not.toEqual([9.5, 5]);
    expect(coz(yumusakYol(D, 10, 10, 20)).kup[2]!.slice(2, 4)).toEqual([9.5, 5]);
  });

  it('uzun kenarın yanındaki kısa kenarda taşmaz (kontrol noktası kısa kenarın %40\'ı içinde)', () => {
    // P1'de dönüş 45° (yumuşak); P1→P2 kenarı ≈1,41, P0→P1 kenarı 100.
    const n = ([[0, 0], [100, 0], [101, 1], [101, 50], [0, 50]] as const).map(([x, y]) => [x / 200, y / 100] as const);
    const { kup } = coz(yumusakYol(n, 200, 100));
    const c1 = kup[1]!.slice(0, 2); // P1 → P2 parçasının ilk kontrol noktası
    expect(Math.hypot(c1[0]! - 100, c1[1]! - 0)).toBeLessThanOrEqual(0.4 * Math.SQRT2 + 0.1);
  });

  it('üçten az köşe: boş yol', () => {
    expect(yumusakYol([[0, 0], [1, 1]], 10, 10)).toBe('');
  });

  it('IONIQ 3 haritasının 273 çokgeni: her biri köşe sayısı kadar kübik parçalı, sayısal bir yol verir', () => {
    let sayi = 0;
    for (const h of Object.values(PARCA_HARITALARI.ioniq3!)) {
      for (const a of h!.alanlar) {
        const d = yumusakYol(a.nokta, 1000, 500);
        expect(d.startsWith('M') && d.endsWith('Z')).toBe(true);
        expect(d).not.toMatch(/NaN|Infinity/);
        expect(d.split('C')).toHaveLength(a.nokta.length + 1);
        sayi++;
      }
    }
    expect(sayi).toBe(273);
  });
});

// 26.10.2026 — ürün sahibi: "aracı seçtiğinde büyüsün". Büyük görünümde görsel
// aracın sınır kutusuna kırpılıp büyütülür; dokunuş aynı kutuya göre okunur.
describe('büyük görünüm: odak kutusu', () => {
  const harita = { oran: 2, alanlar: [
    { parcaId: 'kaput', nokta: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.5], [0.1, 0.5]] as const },
    { parcaId: 'sol_on_kapi', nokta: [[0.5, 0.3], [0.9, 0.3], [0.9, 0.8], [0.5, 0.8]] as const },
  ] };

  it('odak: çokgenlerin sınır kutusu + pay, 0–1 içinde kırpılır; harita yoksa tüm görsel', () => {
    expect(haritaOdagi(harita)).toEqual({ x0: 0.1 - 0.03, y0: 0.2 - 0.03, x1: 0.9 + 0.03, y1: 0.8 + 0.03 });
    expect(haritaOdagi(harita, 0.2)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(haritaOdagi(null)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(haritaOdagi({ oran: 2, alanlar: [] })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it('tüm görsel odakken kutu "contain" ile aynı', () => {
    expect(odakKutusu(400, 300, 2, { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual(goruntuKutusu(400, 300, 2));
    expect(odakKutusu(400, 100, 2, { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual(goruntuKutusu(400, 100, 2));
  });

  it('ortadaki yarım bölge odakken görsel iki kat büyür ve kabın dışına taşar; dokunuş görsele göre doğru okunur', () => {
    const k = odakKutusu(400, 200, 2, { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 });
    expect(k).toEqual({ x: -200, y: -100, en: 800, boy: 400 });
    // Kabın ortası görselin ortası; kabın sol üst köşesi odağın sol üst köşesi.
    expect(kutudakiNokta(200, 100, k)).toEqual({ x: 0.5, y: 0.5 });
    expect(kutudakiNokta(0, 0, k)).toEqual({ x: 0.25, y: 0.25 });
    expect(kutudakiNokta(400, 200, k)).toEqual({ x: 0.75, y: 0.75 });
  });

  it('geniş odak dar kapta: ölçek dar kenara göre, odak ortalanır', () => {
    // Odak 0,5×0,5 (görsel biriminde 1,0×0,5); kap 100×100 → ölçek min(100/1, 100/0,5) = 100.
    const k = odakKutusu(100, 100, 2, { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 });
    expect(k).toEqual({ x: -50, y: 25 - 25, en: 200, boy: 100 });
    expect(kutudakiNokta(50, 50, k)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('kutunun dışındaki dokunuş null; boş kap boş kutu', () => {
    const k = odakKutusu(400, 200, 2, { x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(kutudakiNokta(-1, 50, k)).toBeNull();
    expect(kutudakiNokta(50, 201, k)).toBeNull();
    expect(odakKutusu(0, 0, 2, { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual({ x: 0, y: 0, en: 0, boy: 0 });
    expect(kutudakiNokta(0, 0, { x: 0, y: 0, en: 0, boy: 0 })).toBeNull();
  });
});

// 26.10.2026 — ürün sahibi: "iki parça seçebilsek, arasında boşluk vs. yazabilmek için".
describe('ikinci parça (boşluk / kademe)', () => {
  it('ad: ikinci parça varsa "A ↔ B", iki dilde; yoksa tek ad', () => {
    expect(parcaCiftiAdi({ parcaId: 'kaput', ikinciParcaId: 'sol_on_camurluk' })).toBe('Kaput ↔ Sol ön çamurluk');
    expect(parcaCiftiAdi({ parcaId: 'kaput', ikinciParcaId: 'sol_on_camurluk' }, 'en')).toBe('Hood ↔ LH front fender');
    expect(parcaCiftiAdi({ parcaId: 'kaput' })).toBe('Kaput');
    expect(parcaCiftiAdi({ parcaId: 'kaput', ikinciParcaId: null })).toBe('Kaput');
    expect(parcaCiftiAdi({ parcaId: 'kaput', ikinciParcaId: '' })).toBe('Kaput');
  });

  it('rapor metni iki parçayı da taşır', () => {
    const h = { parcaId: 'kaput', ikinciParcaId: 'sol_on_camurluk', hataTipiId: 'bosluk_fazla', konum: '', aciklama: '', adet: 1 };
    expect(sorunMetni(h, 'tr')).toBe('Kaput ↔ Sol ön çamurluk — Boşluk fazla');
    expect(sorunMetni(h, 'en')).toBe('Hood ↔ LH front fender over gap');
    expect(sorunMetni({ ...h, ikinciParcaId: undefined }, 'tr')).toBe('Kaput — Boşluk fazla');
  });
});

// 26.10.2026 — dış değerlendirme: araç üzerinde demerit 1, 2, 3 aynı kırmızıydı.
describe('araç görünümünde boya: parçanın en yüksek demerit\'i', () => {
  const h = (parcaId: string, derece: string, ek: { ikinciParcaId?: string; kabulEdilebilir?: boolean } = {}) =>
    ({ parcaId, derece, kabulEdilebilir: false, ...ek });

  it('aynı parçada birden çok kayıt: en yükseği', () => {
    const m = parcaDemeritleri([h('kaput', '1'), h('kaput', '3'), h('kaput', '2')]);
    expect(m.get('kaput')).toBe(3);
  });

  it('demerit 0 ve kabul edilmiş kayıt da işaretler (0 olarak)', () => {
    const m = parcaDemeritleri([h('tavan', '0'), h('bagaj', '3', { kabulEdilebilir: true })]);
    expect(m.get('tavan')).toBe(0);
    expect(m.get('bagaj')).toBe(0);
    expect(m.has('kaput')).toBe(false);
  });

  it('iki parça arası kayıt iki parçayı da boyar', () => {
    const m = parcaDemeritleri([h('sol_on_kapi', '2', { ikinciParcaId: 'sol_on_camurluk' }), h('sol_on_camurluk', '1')]);
    expect(m.get('sol_on_kapi')).toBe(2);
    expect(m.get('sol_on_camurluk')).toBe(2);
  });

  it('bozuk derece 0 sayılır, çökmez', () => {
    expect(parcaDemeritleri([h('kaput', 'x')]).get('kaput')).toBe(0);
  });
});

// 26.10.2026 — yan yatırma kalkınca dikey telefonda büyük görünüm karttan büyük değildi.
describe('büyük görünümde yakınlaştırma', () => {
  const k = { x: -20, y: 10, en: 400, boy: 200 };
  const odak = { x0: 0.05, y0: 0.2, x1: 0.95, y1: 0.8 };

  it('1×: kutu aynen, kayma sıfır', () => {
    expect(yakinKutu(k, 360, 240, 1, { x: 50, y: 50 })).toEqual(k);
    expect(kaymaSinirla(k, 360, 240, 1, odak, { x: 50, y: 50 })).toEqual({ x: 0, y: 0 });
  });

  it('yakınken kabın ortası sabit: ortadaki görsel noktası ortada kalır', () => {
    const z = yakinKutu(k, 360, 240, 2, { x: 0, y: 0 });
    expect(z.en).toBe(800);
    expect(z.boy).toBe(400);
    // Kabın ortası (180,120) yakınlaşmadan önce görselin şu noktasındaydı:
    const once = { x: (180 - k.x) / k.en, y: (120 - k.y) / k.boy };
    expect(kutudakiNokta(180, 120, z)!.x).toBeCloseTo(once.x, 9);
    expect(kutudakiNokta(180, 120, z)!.y).toBeCloseTo(once.y, 9);
  });

  it('kayma sınırlı: araç kabın kenarından içeri çekilemez', () => {
    const s = kaymaSinirla(k, 360, 240, 2, odak, { x: 5000, y: -5000 });
    const z = yakinKutu(k, 360, 240, 2, s);
    expect(z.x + odak.x0 * z.en).toBeCloseTo(0, 6); // sola dayalı: aracın sol kenarı kabın sol kenarında
    expect(z.y + odak.y1 * z.boy).toBeCloseTo(240, 6); // aracın alt kenarı kabın altında
  });

  it('araç kabdan küçük kalan eksende ortalanır', () => {
    const kucuk = { x: 100, y: 60, en: 100, boy: 50 };
    const s = kaymaSinirla(kucuk, 360, 240, 1.6, odak, { x: 999, y: 999 });
    const z = yakinKutu(kucuk, 360, 240, 1.6, s);
    expect((z.x + odak.x0 * z.en + z.x + odak.x1 * z.en) / 2).toBeCloseTo(180, 6);
  });

  it('kademeler artan, ilki 1', () => {
    expect(YAKINLIKLAR[0]).toBe(1);
    for (let i = 1; i < YAKINLIKLAR.length; i++) expect(YAKINLIKLAR[i]!).toBeGreaterThan(YAKINLIKLAR[i - 1]!);
  });
});

// 26.10.2026 — Analiz'deki yoğunluk haritası.
describe('yoğunluk kademesi', () => {
  it('en çok kayıtlı parçaya göre üç kademe; 0 boyanmaz', () => {
    expect(yogunlukKademesi(0, 9)).toBeNull();
    expect(yogunlukKademesi(3, 9)).toBe('1');
    expect(yogunlukKademesi(4, 9)).toBe('2');
    expect(yogunlukKademesi(6, 9)).toBe('2');
    expect(yogunlukKademesi(7, 9)).toBe('3');
    expect(yogunlukKademesi(9, 9)).toBe('3');
  });
  it('tek parça kayıtlıysa o parça en koyu; en çok 0 verilse de bölmez', () => {
    expect(yogunlukKademesi(1, 1)).toBe('3');
    expect(yogunlukKademesi(1, 0)).toBe('3');
  });
});
