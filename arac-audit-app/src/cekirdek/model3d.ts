// 3B ARAÇ MODELİ — dış kütüphane YOK (three.js vb. yok).
//
// NE OLDUĞU KONUSUNDA DÜRÜST OLALIM: bunlar üreticinin CAD verisi değildir.
// Araçların dış ölçülerinden (uzunluk/genişlik/yükseklik/dingil mesafesi)
// türetilmiş ŞEMATİK modellerdir. Amaç güzel bir render değil, denetçinin
// "sol arka kapı" yerine dokunup hatayı oraya yazabilmesidir. Her yüzeyin bir
// `mesh` kimliği vardır ve bu kimlik katalog.js'teki parça kimliğiyle birebir
// eşleşir.
//
// BU DOSYA YALNIZ GEOMETRİ ÜRETİR — çizim yapmaz.
// Çizici (perspektif izdüşüm + ressam algoritması + dokunma isabeti) bir
// WebView içinde çalışır; bkz. `modelWebView.ts`. Ayrım bilinçli: geometri
// React Native tarafında tek kaynakta kalsın, tuval çizimi ise her iki
// platformda da aynı kodla yapılsın diye.

import { Arac, HatNoktasi, ModelKipi, Nokta3, Taraf, Yuzey } from './tipler';
/**
 * Araç ölçüleri.
 *
 * ÖLÇÜ KAYNAĞI — bu ayrım önemli:
 *  - i20 ve BAYON: kamuya açık teknik veriden alınan YAKLAŞIK değerlerdir,
 *    üretici belgesinden doğrulanmadı. Şematik model için yeterli.
 *  - IONIQ 3: piyasaya çıkmamış bir araç. Buradaki ölçüler YER TUTUCUDUR,
 *    hiçbir kaynaktan ölçülmemiştir. Fotoğrafları/ölçüleri iletince
 *    düzeltilecek. `olcuDogrulandi: false` bunu uygulamada da görünür kılar.
 */
export const ARACLAR: Arac[] = [
  {
    id: 'ioniq3', ad: 'IONIQ 3', tam: 'Hyundai IONIQ 3', tip: 'ev',
    renk: '#8FA6C4', olcuDogrulandi: false,
    not: 'Ölçüler yer tutucudur — araç fotoğrafları/teknik verisi gelince güncellenecek.',
    uzunluk: 4300, genislik: 1820, yukseklik: 1560, dingil: 2700, tekerR: 340,
    onSarkma: 800, arkaSarkma: 800,
    // Yüksek gövdeli, dik burunlu elektrikli crossover oranı
    ustHat: [
      { x: 2150, y: 480, parca: 'on_tampon',    z: 0.44 },
      { x: 2120, y: 800, parca: 'on_tampon',    z: 0.46 },
      { x: 2020, y: 980, parca: 'on_izgara',    z: 0.46 },
      { x: 1820, y: 1080, parca: 'kaput',       z: 0.47 },
      { x: 1180, y: 1120, parca: 'kaput',       z: 0.47 },
      { x: 560,  y: 1500, parca: 'on_cam',      z: 0.43 },
      { x: 330,  y: 1560, parca: 'tavan',       z: 0.42 },
      { x: -960, y: 1545, parca: 'tavan',       z: 0.42 },
      { x: -1420, y: 1400, parca: 'arka_cam',   z: 0.43 },
      { x: -1750, y: 1120, parca: 'bagaj_kapagi', z: 0.45 },
      { x: -2080, y: 830, parca: 'bagaj_kapagi', z: 0.46 },
      { x: -2150, y: 480, parca: 'arka_tampon', z: 0.44 },
    ],
    belY: 1010, esikY: 430,
    kapiX: { onBas: 1120, orta: -140, arkaSon: -1250 },
  },
  {
    id: 'i20', ad: 'i20', tam: 'Hyundai i20', tip: 'ice',
    renk: '#C9CED6', olcuDogrulandi: false,
    not: 'Ölçüler kamuya açık teknik veriden yaklaşık alındı; üretici belgesinden doğrulanmadı.',
    uzunluk: 4040, genislik: 1775, yukseklik: 1450, dingil: 2580, tekerR: 315,
    onSarkma: 830, arkaSarkma: 630,
    ustHat: [
      { x: 2020, y: 430, parca: 'on_tampon',    z: 0.43 },
      { x: 1990, y: 720, parca: 'on_tampon',    z: 0.45 },
      { x: 1900, y: 850, parca: 'on_izgara',    z: 0.45 },
      { x: 1700, y: 950, parca: 'kaput',        z: 0.46 },
      { x: 1080, y: 1030, parca: 'kaput',       z: 0.46 },
      { x: 400,  y: 1400, parca: 'on_cam',      z: 0.42 },
      { x: 180,  y: 1450, parca: 'tavan',       z: 0.41 },
      { x: -820, y: 1430, parca: 'tavan',       z: 0.41 },
      { x: -1280, y: 1300, parca: 'arka_cam',   z: 0.42 },
      { x: -1660, y: 1020, parca: 'bagaj_kapagi', z: 0.44 },
      { x: -1900, y: 760, parca: 'bagaj_kapagi', z: 0.45 },
      { x: -1960, y: 430, parca: 'arka_tampon', z: 0.43 },
    ],
    belY: 930, esikY: 390,
    kapiX: { onBas: 1000, orta: -180, arkaSon: -1150 },
  },
  {
    id: 'bayon', ad: 'BAYON', tam: 'Hyundai BAYON', tip: 'ice',
    renk: '#B7C3CE', olcuDogrulandi: false,
    not: 'Ölçüler kamuya açık teknik veriden yaklaşık alındı; üretici belgesinden doğrulanmadı.',
    uzunluk: 4180, genislik: 1775, yukseklik: 1500, dingil: 2580, tekerR: 325,
    onSarkma: 830, arkaSarkma: 770,
    ustHat: [
      { x: 2090, y: 470, parca: 'on_tampon',    z: 0.43 },
      { x: 2060, y: 760, parca: 'on_tampon',    z: 0.45 },
      { x: 1960, y: 900, parca: 'on_izgara',    z: 0.45 },
      { x: 1760, y: 1010, parca: 'kaput',       z: 0.46 },
      { x: 1120, y: 1080, parca: 'kaput',       z: 0.46 },
      { x: 440,  y: 1450, parca: 'on_cam',      z: 0.42 },
      { x: 210,  y: 1500, parca: 'tavan',       z: 0.41 },
      { x: -880, y: 1475, parca: 'tavan',       z: 0.41 },
      { x: -1340, y: 1330, parca: 'arka_cam',   z: 0.42 },
      { x: -1740, y: 1060, parca: 'bagaj_kapagi', z: 0.44 },
      { x: -2030, y: 790, parca: 'bagaj_kapagi', z: 0.45 },
      { x: -2090, y: 470, parca: 'arka_tampon', z: 0.43 },
    ],
    belY: 960, esikY: 410,
    kapiX: { onBas: 1040, orta: -170, arkaSon: -1180 },
  },
];

export const ARAC_INDEKS: Record<string, Arac> = Object.fromEntries(ARACLAR.map((a) => [a.id, a]));

// --- GEOMETRİ YARDIMCILARI -------------------------------------------------

const CAM_RENK = '#334155B3';  // yarı saydam: kabin sezilsin ama araç "içi görünür" olmasın
const LASTIK = '#23262B';
const JANT = '#9AA3AE';
const LAMBA_ON = '#E8EEF5';
const LAMBA_ARKA = '#C0392B';
const KARA_PLASTIK = '#3A4049';

function yuz(mesh: string, noktalar: Nokta3[], renk: string, ustunluk = 0): Yuzey {
  return { mesh, p: noktalar, renk, ustunluk };
}

/** ustHat üzerinde verilen x için y ve yarı-genişlik oranını lineer bulur. */
function hatUzerinde(ustHat: HatNoktasi[], x: number): { y: number; z: number } {
  for (let i = 0; i < ustHat.length - 1; i++) {
    const a = ustHat[i]; const b = ustHat[i + 1];
    const [ileri, geri] = a.x >= b.x ? [a, b] : [b, a];
    if (x <= ileri.x && x >= geri.x) {
      const t = ileri.x === geri.x ? 0 : (x - geri.x) / (ileri.x - geri.x);
      return { y: geri.y + (ileri.y - geri.y) * t, z: geri.z + (ileri.z - geri.z) * t };
    }
  }
  const son = x > ustHat[0].x ? ustHat[0] : ustHat[ustHat.length - 1];
  return { y: son.y, z: son.z };
}

/**
 * Verilen x'te yan gövdenin üst kenarı: kapı bölgesinde cam düzlemi (camlar
 * gövdeden bir tık içeride), dışında ise sac panelin bel hattı.
 */
function yanNokta(arac: Arac, x: number): { y: number; z: number } {
  const W = arac.genislik / 2;
  const kapiIcinde = x <= arac.kapiX.onBas && x >= arac.kapiX.arkaSon;
  const hat = hatUzerinde(arac.ustHat, x);
  return kapiIcinde
    ? { y: Math.max(arac.belY, hat.y - 45), z: W * 0.97 }
    : { y: Math.min(hat.y, arac.belY), z: W };
}

/**
 * Silüette belirli bir parçanın ilk (ya da sondan) noktasını bulur.
 *
 * BULAMAZSA HATA ATAR. Gerekçe: eksik bir silüet noktası, aracın bozuk
 * çizilmesi demek — ve bozuk çizim sessizce yanlış parça seçtirir. Bir araç
 * tanımı eksikse bunu ilk denetim sırasında değil, tanım eklendiği anda
 * öğrenmek isteriz.
 */
function hatNoktasi(arac: Arac, parca: string, sondan = false): HatNoktasi {
  const liste = sondan ? [...arac.ustHat].reverse() : arac.ustHat;
  const n = liste.find((p) => p.parca === parca);
  if (!n) throw new Error(`${arac.id}: silüette "${parca}" noktası tanımlı değil.`);
  return n;
}

/** Silindir (tekerlek) yüzeyleri. */
function tekerlek(meshId: string, x: number, r: number, z: number, kalinlik: number, dilim = 16): Yuzey[] {
  const yuzler: Yuzey[] = [];
  // İç yüz HER ZAMAN gövde merkezine doğru gitmeli. İşareti z'den alırsak
  // sağ taraf (z<0) için kalınlık dışa taşar ve tekerlek gövdenin dışında
  // havada durur — 15.09.2026 ekran incelemesinde bu görüldü.
  const dis = z;
  const ic = z - Math.sign(z) * Math.abs(kalinlik);
  const halka: [number, number][] = [];
  for (let i = 0; i < dilim; i++) {
    const a = (i / dilim) * Math.PI * 2;
    halka.push([x + Math.cos(a) * r, r + Math.sin(a) * r]);
  }
  // Dış yüz (jant görünümü) — ustunluk VERME: sıralamayı bozup gövdenin
  // üstüne biner. Derinlik doğal sırasına bırakılır.
  yuzler.push(yuz(meshId, halka.map(([px, py]) => [px, py, dis]), JANT));
  // Sırt (lastik bandı)
  for (let i = 0; i < dilim; i++) {
    const [x1, y1] = halka[i]; const [x2, y2] = halka[(i + 1) % dilim];
    yuzler.push(yuz(meshId, [[x1, y1, dis], [x2, y2, dis], [x2, y2, ic], [x1, y1, ic]], LASTIK));
  }
  // Küçük göbek
  const gobek: Nokta3[] = halka.filter((_, i) => i % 2 === 0)
    .map(([px, py]) => [x + (px - x) * 0.38, r + (py - r) * 0.38, dis + Math.sign(z) * 10]);
  yuzler.push(yuz(meshId, gobek, '#6B7280'));
  return yuzler;
}

function kutu(meshId: string, [x0, y0, z0]: Nokta3, [dx, dy, dz]: Nokta3, renk: string): Yuzey[] {
  const x1 = x0 + dx, y1 = y0 + dy, z1 = z0 + dz;
  const k = (a: Nokta3, b: Nokta3, c: Nokta3, d: Nokta3) => yuz(meshId, [a, b, c, d], renk);
  return [
    k([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]), // üst
    k([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]), // alt
    k([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]), // ön
    k([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]), // arka
    k([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]), // sol
    k([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]), // sağ
  ];
}

// --- DIŞ GÖVDE -------------------------------------------------------------

/** Aracın dış yüzeylerini üretir. */
export function disGeometri(arac: Arac): Yuzey[] {
  const { ustHat, belY, esikY, kapiX, renk, genislik, tekerR, dingil } = arac;
  const W = genislik / 2;
  const yuzler: Yuzey[] = [];

  // 1) ÜST KABUK — silüetin her parçası kendi mesh'i olarak genişliğe yayılır
  // Bir noktanın `parca` alanı, O NOKTADA BİTEN dilimi adlandırır. Yani dilimin
  // adı b.parca'dır, a.parca değil — aksi hâlde ön cam "kaput" diye, arka
  // tampon ise hiç etiketlenmez.
  for (let i = 0; i < ustHat.length - 1; i++) {
    const a = ustHat[i], b = ustHat[i + 1];
    if (!a || !b) continue;
    const za = a.z * genislik, zb = b.z * genislik;
    const camMi = b.parca === 'on_cam' || b.parca === 'arka_cam';
    yuzler.push(yuz(b.parca,
      [[a.x, a.y, za], [b.x, b.y, zb], [b.x, b.y, -zb], [a.x, a.y, -za]],
      camMi ? CAM_RENK : renk));

    // OMUZ: üst kabuk gövdeden dardır (tavan 0.42, gövde 0.50 genişlik). Aradaki
    // şeridi doldurmazsak paneller havada yüzer gibi görünür — çamurluk üstü,
    // tavan yağmur oluğu ve bagaj omzu tam olarak bu şerittir.
    if (!camMi) {
      for (const yon of [1, -1]) {
        const ka = yanNokta(arac, a.x), kb = yanNokta(arac, b.x);
        yuzler.push(yuz(b.parca, [
          [a.x, a.y, yon * za], [b.x, b.y, yon * zb],
          [b.x, kb.y, yon * kb.z], [a.x, ka.y, yon * ka.z],
        ], renk));
      }
    }
  }

  // 2) YAN PANELLER — sol (+Z) ve sağ (-Z)
  const yanlar: [Taraf, 1 | -1][] = [['sol', 1], ['sag', -1]];
  const ilkNokta = ustHat[0];
  const sonNokta = ustHat[ustHat.length - 1];
  if (!ilkNokta || !sonNokta) throw new Error(`${arac.id}: silüet boş.`);
  const onUc = ilkNokta.x, arkaUc = sonNokta.x;
  const camTabanX = hatNoktasi(arac, 'on_cam').x;      // ön cam tabanı
  const tavanOnX = hatNoktasi(arac, 'tavan').x;
  const tavanArka = hatNoktasi(arac, 'tavan', true);
  const arkaCamAltX = hatNoktasi(arac, 'bagaj_kapagi').x;

  for (const [taraf, yon] of yanlar) {
    const zd = yon * W;
    const p = (x: number, y: number): Nokta3 => [x, y, zd];

    // Bel hattı altındaki gövde: çamurluk / kapılar / arka çamurluk.
    // DİKKAT: çamurlukları aracın en uç noktasına kadar uzatMA. Uçta silüetin
    // tepesi eşik hizasına iner, panel sivri bir dilime dönüşür ve araç "kar
    // küreği" gibi görünür (15.09.2026 görsel incelemesi). Gövde, tampon
    // başlangıcında biter; tamponun yana sarması ayrı bir yüzeydir.
    const onGovdeX = ustHat[2].x;
    const arkaGovdeX = ustHat[ustHat.length - 2].x;
    // `tarafli: false` olanlar sol/sağ ayrımı OLMAYAN parçalardır: tampon tek
    // parçadır, katalogda "sol_on_tampon" diye bir parça yoktur. Ön ek koyarsak
    // dokunma "bilinmeyen parça" verir.
    const dilimler: [string, number, number, boolean][] = [
      ['on_tampon', onUc, onGovdeX, false],
      ['on_camurluk', onGovdeX, kapiX.onBas, true],
      ['on_kapi', kapiX.onBas, kapiX.orta, true],
      ['arka_kapi', kapiX.orta, kapiX.arkaSon, true],
      ['arka_camurluk', kapiX.arkaSon, arkaGovdeX, true],
      ['arka_tampon', arkaGovdeX, arkaUc, false],
    ];
    for (const [ad, xIleri, xGeri, tarafli] of dilimler) {
      const ustIleri = Math.min(hatUzerinde(ustHat, xIleri).y, belY);
      const ustGeri = Math.min(hatUzerinde(ustHat, xGeri).y, belY);
      yuzler.push(yuz(tarafli ? `${taraf}_${ad}` : ad,
        [p(xIleri, esikY), p(xIleri, ustIleri), p(xGeri, ustGeri), p(xGeri, esikY)], renk));
    }

    // Marşpiyel (eşik altı)
    yuzler.push(yuz(`${taraf}_marspiyel`,
      [p(kapiX.onBas + 120, esikY - 150), p(kapiX.onBas + 120, esikY),
       p(kapiX.arkaSon - 120, esikY), p(kapiX.arkaSon - 120, esikY - 150)], KARA_PLASTIK));

    // Bel hattı üstü: A direği / ön cam / B direği / arka cam / C direği
    const zc = zd * 0.97; // camlar gövdeden bir tık içeride
    const pc = (x: number, y: number): Nokta3 => [x, y, zc];
    const direkKalin = 150;

    const tavanOnY = hatUzerinde(ustHat, tavanOnX).y;
    const tavanArkaY = tavanArka.y;

    yuzler.push(yuz(`${taraf}_a_diregi`, [
      pc(camTabanX, belY), pc(tavanOnX, tavanOnY),
      pc(tavanOnX - direkKalin, tavanOnY), pc(camTabanX - direkKalin * 1.6, belY)], KARA_PLASTIK));

    yuzler.push(yuz(`${taraf}_on_kapi_cam`, [
      pc(camTabanX - direkKalin * 1.6, belY), pc(tavanOnX - direkKalin, tavanOnY),
      pc(kapiX.orta + direkKalin / 2, hatUzerinde(ustHat, kapiX.orta).y), pc(kapiX.orta + direkKalin / 2, belY)], CAM_RENK));

    yuzler.push(yuz(`${taraf}_b_diregi`, [
      pc(kapiX.orta + direkKalin / 2, belY), pc(kapiX.orta + direkKalin / 2, hatUzerinde(ustHat, kapiX.orta).y),
      pc(kapiX.orta - direkKalin / 2, hatUzerinde(ustHat, kapiX.orta).y), pc(kapiX.orta - direkKalin / 2, belY)], KARA_PLASTIK));

    yuzler.push(yuz(`${taraf}_arka_kapi_cam`, [
      pc(kapiX.orta - direkKalin / 2, belY), pc(kapiX.orta - direkKalin / 2, hatUzerinde(ustHat, kapiX.orta).y),
      pc(tavanArka.x + direkKalin, tavanArkaY), pc(kapiX.arkaSon + direkKalin, belY)], CAM_RENK));

    yuzler.push(yuz(`${taraf}_c_diregi`, [
      pc(kapiX.arkaSon + direkKalin, belY), pc(tavanArka.x + direkKalin, tavanArkaY),
      pc(tavanArka.x - direkKalin, tavanArkaY - 30), pc(arkaCamAltX + 120, belY)], KARA_PLASTIK));

    // Ayna
    const aynaX = camTabanX - 120;
    yuzler.push(...kutu(`${taraf}_ayna`,
      [aynaX, belY + 30, yon > 0 ? zd : zd - 90], [220, 120, 90], KARA_PLASTIK));

    // Tekerlekler
    const onX = dingil / 2, arkaX = -dingil / 2;
    yuzler.push(...tekerlek(`${taraf}_jant_on`, onX, tekerR, yon > 0 ? W - 10 : -W + 10, yon > 0 ? 190 : -190));
    yuzler.push(...tekerlek(`${taraf}_jant_arka`, arkaX, tekerR, yon > 0 ? W - 10 : -W + 10, yon > 0 ? 190 : -190));

    // Farlar ve stoplar
    const farX = ustHat[2].x - 30;
    yuzler.push(yuz(`${taraf}_far`, [
      [farX + 40, 820, yon * W * 0.86], [farX + 40, 960, yon * W * 0.86],
      [farX - 150, 985, yon * W * 0.55], [farX - 150, 845, yon * W * 0.55]], LAMBA_ON, 1));
    const stopX = arkaCamAltX - 60;
    yuzler.push(yuz(`${taraf}_stop`, [
      [stopX + 60, belY - 90, yon * W * 0.9], [stopX + 60, belY + 60, yon * W * 0.9],
      [stopX - 140, belY + 40, yon * W * 0.62], [stopX - 140, belY - 110, yon * W * 0.62]], LAMBA_ARKA, 1));
  }

  // 3) IZGARA — ön yüze bindirilmiş panel
  const izgara = ustHat[1];
  yuzler.push(yuz('on_izgara', [
    [izgara.x + 25, 760, W * 0.38], [izgara.x + 25, 960, W * 0.38],
    [izgara.x + 25, 960, -W * 0.38], [izgara.x + 25, 760, -W * 0.38]], '#2B3038', 1));

  return yuzler;
}

// --- İÇ MEKÂN --------------------------------------------------------------

/** Kabin içi şematik: IP, konsol, direksiyon, koltuklar, kapı döşemeleri, garnişler. */
export function icGeometri(arac: Arac): Yuzey[] {
  const { genislik, belY, esikY, kapiX, ustHat } = arac;
  const W = genislik / 2 - 60;
  const yuzler: Yuzey[] = [];
  const camTabanX = hatNoktasi(arac, 'on_cam').x;
  const tabanY = esikY + 40;

  // İç mekân paleti: hepsi koyu griyse ekranda tek bir kütle görünür ve
  // denetçi parçayı ayırt edemez. Garnişler bilerek AÇIK tondadır — en sık
  // hata alan bölgelerden biri onlar.
  // Taban
  yuzler.push(yuz('ayak_bolge', [
    [camTabanX, tabanY, W], [kapiX.arkaSon - 300, tabanY, W],
    [kapiX.arkaSon - 300, tabanY, -W], [camTabanX, tabanY, -W]], '#3B424C'));

  // Gösterge paneli (IP)
  yuzler.push(...kutu('ic_ip', [camTabanX - 40, belY - 180, -W], [420, 200, W * 2], '#6E7783'));
  yuzler.push(yuz('ic_gosterge', [
    [camTabanX - 50, belY - 20, W * 0.62], [camTabanX - 50, belY + 90, W * 0.62],
    [camTabanX - 50, belY + 90, W * 0.18], [camTabanX - 50, belY - 20, W * 0.18]], '#12161C', 1));
  yuzler.push(yuz('ic_ekran', [
    [camTabanX - 60, belY - 20, W * 0.12], [camTabanX - 60, belY + 95, W * 0.12],
    [camTabanX - 60, belY + 95, -W * 0.42], [camTabanX - 60, belY - 20, -W * 0.42]], '#0B1220', 1));

  // Direksiyon (basit halka)
  const dHalka: Nokta3[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    dHalka.push([camTabanX - 330 + Math.sin(a) * 40, belY + 20 + Math.cos(a) * 170, W * 0.42 + Math.sin(a) * 170]);
  }
  yuzler.push(yuz('ic_direksiyon', dHalka, '#20252C', 2));

  // Orta konsol
  yuzler.push(...kutu('ic_konsol', [camTabanX - 900, tabanY, -W * 0.22], [900, 320, W * 0.44], '#5A626D'));

  // Koltuklar
  const koltuk = (mesh: string, x: number, z: number) => {
    yuzler.push(...kutu(mesh, [x - 260, tabanY, z - 260], [520, 140, 520], '#8892A0'));      // oturma
    yuzler.push(...kutu(mesh, [x - 300, tabanY + 140, z - 250], [180, 620, 500], '#8892A0')); // sırtlık
    yuzler.push(...kutu(mesh, [x - 280, tabanY + 790, z - 160], [130, 230, 320], '#6B7482')); // başlık
  };
  koltuk('koltuk_sol_on', camTabanX - 800, W * 0.5);
  koltuk('koltuk_sag_on', camTabanX - 800, -W * 0.5);
  yuzler.push(...kutu('koltuk_arka', [kapiX.arkaSon + 120, tabanY, -W * 0.92], [520, 140, W * 1.84], '#8892A0'));
  yuzler.push(...kutu('koltuk_arka', [kapiX.arkaSon + 80, tabanY + 140, -W * 0.92], [180, 620, W * 1.84], '#8892A0'));

  // Bagaj
  yuzler.push(...kutu('ic_bagaj', [kapiX.arkaSon - 900, tabanY, -W * 0.9], [900, 60, W * 1.8], '#4C535D'));

  // Kapı döşemeleri + garnişler (sol/sağ)
  const icYanlar: [Taraf, 1 | -1][] = [['sol', 1], ['sag', -1]];
  for (const [taraf, yon] of icYanlar) {
    const zd = yon * W;
    const p = (x: number, y: number): Nokta3 => [x, y, zd];
    yuzler.push(yuz(`${taraf}_on_kapi_doseme`, [
      p(kapiX.onBas, tabanY), p(kapiX.onBas, belY + 60), p(kapiX.orta, belY + 60), p(kapiX.orta, tabanY)], '#646D79'));
    yuzler.push(yuz(`${taraf}_arka_kapi_doseme`, [
      p(kapiX.orta, tabanY), p(kapiX.orta, belY + 60), p(kapiX.arkaSon, belY + 60), p(kapiX.arkaSon, tabanY)], '#646D79'));

    const tavanOnX = hatNoktasi(arac, 'tavan').x;
    const tavanArka = hatNoktasi(arac, 'tavan', true);
    yuzler.push(yuz(`${taraf}_a_garnis`, [
      p(camTabanX, belY + 60), p(tavanOnX, hatUzerinde(ustHat, tavanOnX).y - 40),
      p(tavanOnX - 140, hatUzerinde(ustHat, tavanOnX).y - 40), p(camTabanX - 200, belY + 60)], '#B9C2CE', 1));
    yuzler.push(yuz(`${taraf}_b_garnis`, [
      p(kapiX.orta + 80, belY + 60), p(kapiX.orta + 80, hatUzerinde(ustHat, kapiX.orta).y - 40),
      p(kapiX.orta - 80, hatUzerinde(ustHat, kapiX.orta).y - 40), p(kapiX.orta - 80, belY + 60)], '#B9C2CE', 1));
    yuzler.push(yuz(`${taraf}_c_garnis`, [
      p(kapiX.arkaSon + 140, belY + 60), p(tavanArka.x + 140, tavanArka.y - 40),
      p(tavanArka.x - 60, tavanArka.y - 60), p(kapiX.arkaSon - 60, belY + 60)], '#B9C2CE', 1));
  }

  // Tavan döşemesi (yukarıdan bakınca kabin kapanmasın diye yarı saydam)
  const tavanOnX = hatNoktasi(arac, 'tavan').x;
  const tavanArka = hatNoktasi(arac, 'tavan', true);
  yuzler.push(yuz('ic_tavan_doseme', [
    [tavanOnX, tavanArka.y - 60, W * 0.92], [tavanArka.x, tavanArka.y - 60, W * 0.92],
    [tavanArka.x, tavanArka.y - 60, -W * 0.92], [tavanOnX, tavanArka.y - 60, -W * 0.92]], '#9AA3AE33'));

  return yuzler;
}

/** Geometriyi moda göre üretir. */
export function geometriUret(aracId: string, mod: ModelKipi = 'dis'): Yuzey[] {
  const arac = ARAC_INDEKS[aracId];
  if (!arac) return [];
  return mod === 'ic' ? icGeometri(arac) : disGeometri(arac);
}
