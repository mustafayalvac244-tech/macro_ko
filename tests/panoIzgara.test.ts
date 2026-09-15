import { describe, expect, it, vi } from 'vitest';

/**
 * PANO IZGARASININ ÖLÇÜLERİ (web).
 *
 * Ayrı dosya, çünkü Platform.OS taklidi dosya başına kuruluyor: bu dosya
 * web'i sabitliyor, natif tarafı tests/panoIzgaraNatif.test.ts.
 *
 * NEDEN SINANIYOR. Izgaranın tek gerçek riski TAŞMADIR: sütun genişlikleri ve
 * aralar birbirini tutmazsa satır kaba sığmaz ve pano yatay kaydırma çubuğu
 * üretir — tarayıcıda en çirkin ve en geç fark edilen kusurlardan biri, çünkü
 * yalnız belli pencere genişliklerinde ortaya çıkar. Aritmetiği burada
 * sabitlemek, "benim ekranımda düzgün görünüyordu" ile biten hata sınıfını
 * kapatıyor.
 */
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const { panoOlculeri, PANO_ARALIK, PANO_YAN_BOSLUK, SUTUN_GENISLIKLERI, izgaraDoldur } = await import('@/theme/duzen');

describe('pano ızgarası', () => {
  it('1920 px masaüstünde üç sütuna geçer', () => {
    expect(panoOlculeri(1920, true).sutun).toBe(3);
  });

  it('orta boy tarayıcıda iki sütuna, dar tarayıcıda tek sütuna düşer', () => {
    // 1100 px: kalıcı menü yok (eşik 1280); üç sütun kart başına 337 px
    // bırakırdı, okunabilir sınırın (360) altında — ikiye düşüyor.
    expect(panoOlculeri(1100, false).sutun).toBe(2);
    expect(panoOlculeri(1024, false).sutun).toBe(2);
    // 1366 px'lik dizüstü, kalıcı menüyle: yine iki sütun.
    expect(panoOlculeri(1366, true).sutun).toBe(2);
    // 900 px: geniş eşiğin (1024) altında — tek sütun, telefon düzeni.
    expect(panoOlculeri(900, false).sutun).toBe(1);
  });

  it('hiçbir genişlikte satır kaba taşmıyor (asıl sınanan)', () => {
    for (let w = 320; w <= 2600; w += 7) {
      for (const menu of [true, false]) {
        const o = panoOlculeri(w, menu);
        const pay = 1; // yuvarlama payı
        if (o.sutun === 3) {
          expect(o.ucteBir * 3 + PANO_ARALIK * 2).toBeLessThanOrEqual(o.tam + pay);
          expect(o.ikiUcte + o.ucteBir + PANO_ARALIK).toBeLessThanOrEqual(o.tam + pay);
        }
        if (o.sutun >= 2) {
          expect(o.yarim * 2 + PANO_ARALIK).toBeLessThanOrEqual(o.tam + pay);
        }
        expect(o.tam).toBeLessThanOrEqual(SUTUN_GENISLIKLERI.pano - PANO_YAN_BOSLUK * 2);
        expect(o.tam).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('üçte iki + üçte bir, satırı TAM doldurur — sağda şerit kalmaz', () => {
    // Bu, taşmanın tersi ve gözle görülür bir kusur: iki kart yan yana
    // duruyor ama sağda 30 px'lik boş bir sütun kalıyor, pano "hizasız"
    // görünüyor. Aradaki boşluğun ana sütuna katılmasının sebebi bu.
    const o = panoOlculeri(1920, true);
    expect(o.ikiUcte + PANO_ARALIK + o.ucteBir).toBe(o.tam);
  });

  it('çok geniş ekranda pano genişlemeye devam etmez', () => {
    // 3440 px'lik ultra geniş bir ekranda kartlar yayılırsa metin satırları
    // okunmaz uzunluğa çıkar; üst sınır bu yüzden var.
    // `tam`, kabın İÇ genişliğidir: üst sınır eksi iki yandaki dolgu.
    expect(panoOlculeri(3440, true).tam).toBe(SUTUN_GENISLIKLERI.pano - PANO_YAN_BOSLUK * 2);
  });

  it('kalıcı menü yer kaplar — menü açıkken sütunlar daralır', () => {
    const menuli = panoOlculeri(1500, true);
    const menusuz = panoOlculeri(1500, false);
    expect(menuli.tam).toBeLessThan(menusuz.tam);
  });
});

describe('izgaraDoldur', () => {
  it('tek sütunda hiçbir şey eklemez', () => {
    expect(izgaraDoldur([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('SON SATIRDA TEK ÖĞE KALINCA BOŞLUK EKLER', () => {
    // Bu olmadan üçüncü kart satırın tamamını dolduruyordu — ekranda görüldü.
    expect(izgaraDoldur([1, 2, 3], 2)).toEqual([1, 2, 3, null]);
  });

  it('satır zaten tamsa dokunmaz', () => {
    expect(izgaraDoldur([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
  });

  it('boş listeye boşluk eklemez — boş durum bileşeni görünsün', () => {
    expect(izgaraDoldur([], 2)).toEqual([]);
  });
});
