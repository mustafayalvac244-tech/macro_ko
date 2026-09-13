/**
 * Türk ilaç kutusundaki GS1 DataMatrix karekodunu ayrıştırır.
 *
 * Kutudaki kod QR DEĞİL, GS1 DataMatrix'tir. Tarayıcıyı buna göre ayarla
 * (Expo: barcodeScannerSettings.barcodeTypes içine 'datamatrix').
 *
 * Bağımlılığı yok; herhangi bir projeye olduğu gibi kopyalanabilir.
 * Testi: node --experimental-strip-types --test ilac-karekod/karekod.test.ts
 */

/** Değişken uzunluklu alanları bitiren ayıraç. GS1'de FNC1, metinde ASCII 29. */
export const GS = '\u001d';

/** Sabit uzunluklu AI'lar: ayıraç beklenmez (yine de varsa hoş görülür). */
const SABIT_UZUNLUK: Readonly<Record<string, number>> = {
  '00': 18, '01': 14, '02': 14,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
  '20': 2,
};

/** Değişken uzunluklu AI'lar: GS ile ya da dizginin sonuyla biter. */
const DEGISKEN = new Set([
  '10', '21', '22', '30', '37',
  '240', '241', '242', '250', '251',
  '710', '711', '712', '713', '714',
  '8200',
]);

export type KarekodHata =
  | 'bos'
  | 'gs1-degil'
  | 'gtin-yok'
  | 'gtin-bicim'
  | 'gtin-kontrol-hanesi';

export type KarekodBasarili = {
  gecerli: true;
  /** 14 haneye tamamlanmış GTIN. Kontrol hanesi doğrulanmıştır. */
  gtin: string;
  /** (21) Bu tek kutuyu ayırt eden numara. Mükerrer sayımı bu engeller. */
  seri: string | null;
  /** (10) Parti/lot. Geri çağırmada kritik. */
  parti: string | null;
  /** (17) Son kullanma tarihi, UTC gün başı. Gün 00 ise ayın son günü. */
  skt: Date | null;
  /** (17) ham YYMMDD — tarih çözülemezse de elde kalsın diye. */
  sktHam: string | null;
  /** Beklenen ama bulunamayan alanlar. Sessiz undefined yerine açık liste. */
  eksik: Array<'seri' | 'parti' | 'skt'>;
  /** Tanınan ama bu ürünle doğrudan ilgisiz AI'lar. */
  digerAlanlar: Record<string, string>;
  /** Tanınmayan AI'dan sonrası. Boş değilse kodu gözden geçir. */
  kalan: string;
};

export type KarekodSonuc =
  | KarekodBasarili
  | { gecerli: false; sebep: KarekodHata; ayrinti: string };

/** GS1 mod-10 kontrol hanesi. GTIN-8/12/13/14 için geçerli. */
export function kontrolHanesiDogruMu(gtin: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) return false;
  const h = gtin.split('').map(Number);
  const kontrol = h.pop() as number;
  let toplam = 0;
  let agirlik = 3;
  for (let i = h.length - 1; i >= 0; i--) {
    toplam += (h[i] ?? 0) * agirlik;
    agirlik = agirlik === 3 ? 1 : 3;
  }
  return (10 - (toplam % 10)) % 10 === kontrol;
}

/** YYMMDD → UTC gün başı Date. Gün 00 ise ayın son günü. Geçersizse null. */
export function sktCevir(ham: string | null | undefined): Date | null {
  if (!ham || !/^\d{6}$/.test(ham)) return null;
  const yil = 2000 + Number(ham.slice(0, 2));
  const ay = Number(ham.slice(2, 4));
  const gun = Number(ham.slice(4, 6));
  if (ay < 1 || ay > 12 || gun < 0 || gun > 31) return null;

  // Gün 00: "ayın son günü". Date.UTC(yil, ay, 0) bir sonraki ayın 0. günü =
  // bu ayın son günü. Artık yılı da kendisi halleder.
  if (gun === 0) return new Date(Date.UTC(yil, ay, 0));

  const d = new Date(Date.UTC(yil, ay - 1, gun));
  // 30 Şubat gibi taşan tarihleri yakala: Date sessizce sonraki aya kaydırır.
  if (d.getUTCMonth() !== ay - 1 || d.getUTCDate() !== gun) return null;
  return d;
}

/** Dizginin başındaki AI'yı bulur (2, 3 ya da 4 hane). Tanımazsa null. */
function aiBul(s: string): string | null {
  for (const n of [2, 3, 4]) {
    if (s.length < n) break;
    const ai = s.slice(0, n);
    if (ai in SABIT_UZUNLUK || DEGISKEN.has(ai)) return ai;
  }
  return null;
}

export function karekoduAyristir(ham: string): KarekodSonuc {
  if (typeof ham !== 'string' || ham.trim() === '') {
    return { gecerli: false, sebep: 'bos', ayrinti: 'Okunan içerik boş.' };
  }

  // Bazı tarayıcılar sembol ön ekini verir, bazıları vermez.
  // Bazı el terminalleri de FNC1'i "<GS>" metni olarak yazar.
  let s = ham
    .replace(/^\]d2/, '')
    .replace(/^\]C1/, '')
    .split('<GS>')
    .join(GS);

  // Kutunun üstündeki ESKİ ÇİZGİLİ BARKOD (EAN-13) okunmuş olabilir: orada
  // AI yoktur, sadece rakam vardır. Kontrol hanesi tutuyorsa GTIN kabul et —
  // ama seri, parti ve SKT o kodda YOK, uydurma. Raf sayımında kutuyu değil
  // yalnız ürünü tanır; mükerrer sayımı bu kod engelleyemez.
  const sadeceRakam = s.replace(/\s/g, '');
  if (
    /^\d+$/.test(sadeceRakam) &&
    [8, 12, 13, 14].includes(sadeceRakam.length) &&
    kontrolHanesiDogruMu(sadeceRakam)
  ) {
    return {
      gecerli: true,
      gtin: sadeceRakam.padStart(14, '0'),
      seri: null,
      parti: null,
      skt: null,
      sktHam: null,
      eksik: ['seri', 'parti', 'skt'],
      digerAlanlar: {},
      kalan: '',
    };
  }

  const alanlar: Record<string, string> = {};
  let kalan = '';

  while (s.length > 0) {
    if (s.startsWith(GS)) { s = s.slice(1); continue; }

    const ai = aiBul(s);
    if (ai === null) { kalan = s; break; }

    s = s.slice(ai.length);
    const sabit = SABIT_UZUNLUK[ai];

    if (sabit !== undefined) {
      if (s.length < sabit) { kalan = ai + s; break; }
      alanlar[ai] = s.slice(0, sabit);
      s = s.slice(sabit);
      if (s.startsWith(GS)) s = s.slice(1); // standart dışı ama sahada oluyor
    } else {
      const i = s.indexOf(GS);
      alanlar[ai] = i < 0 ? s : s.slice(0, i);
      s = i < 0 ? '' : s.slice(i + 1);
    }
  }

  if (Object.keys(alanlar).length === 0) {
    return {
      gecerli: false,
      sebep: 'gs1-degil',
      ayrinti: 'İçerikte tanınan hiçbir GS1 alanı yok; bu bir ilaç karekodu değil.',
    };
  }

  const gtinHam = alanlar['01'] ?? alanlar['02'];
  if (!gtinHam) {
    return { gecerli: false, sebep: 'gtin-yok', ayrinti: 'Kodda (01) GTIN alanı yok.' };
  }
  if (!/^\d+$/.test(gtinHam)) {
    return { gecerli: false, sebep: 'gtin-bicim', ayrinti: `GTIN rakam değil: ${gtinHam}` };
  }

  // Baştaki sıfır kontrol hanesini değiştirmez: ağırlıklar sağdan hizalanır.
  const gtin = gtinHam.padStart(14, '0');
  if (!kontrolHanesiDogruMu(gtin)) {
    return {
      gecerli: false,
      sebep: 'gtin-kontrol-hanesi',
      ayrinti: `GTIN kontrol hanesi tutmuyor: ${gtin}. Büyük olasılıkla hatalı okuma.`,
    };
  }

  const seri = alanlar['21'] ?? null;
  const parti = alanlar['10'] ?? null;
  const sktHam = alanlar['17'] ?? null;
  const skt = sktCevir(sktHam);

  const eksik: KarekodBasarili['eksik'] = [];
  if (!seri) eksik.push('seri');
  if (!parti) eksik.push('parti');
  if (!skt) eksik.push('skt');

  const digerAlanlar: Record<string, string> = {};
  for (const [ai, deger] of Object.entries(alanlar)) {
    if (!['01', '02', '10', '17', '21'].includes(ai)) digerAlanlar[ai] = deger;
  }

  return { gecerli: true, gtin, seri, parti, skt, sktHam, eksik, digerAlanlar, kalan };
}

/**
 * SKT'ye kalan gün. Bugün son kullanma günüyse 0, geçmişse negatif.
 * Miat Radarı'nın sayacı buradan beslenir.
 */
export function kalanGun(skt: Date, bugun: Date = new Date()): number {
  const g = Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate());
  return Math.round((skt.getTime() - g) / 86_400_000);
}
