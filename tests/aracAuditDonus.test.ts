import { afterEach, describe, expect, it } from 'vitest';

import {
  dokunulanYuz, dokunusSonucu, gorunenYuzler, gorunumHaritasi, goruntuKutusu, goruntuNoktasi, halka,
  HALKA_YUVALARI, kaydirmaIndeksi, oranUyar, sar, UST_BOLGESI, yuvaAdi, YUVALAR, YUZ_BOLGESI,
} from '../arac-audit-app/src/cekirdek/donusGorunumu';
import { GorunumId, PARCA_HARITALARI } from '../arac-audit-app/src/cekirdek/gorunumParcalari';
import { BOLGELER, PARCA_INDEKS } from '../arac-audit-app/src/cekirdek/katalog';
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
