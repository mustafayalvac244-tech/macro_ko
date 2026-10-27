// Küçük ZIP yazıcı — dış bağımlılık YOK.
// XLSX aslında içinde XML dosyaları olan bir ZIP arşividir. Excel, sıkıştırılmamış
// ("store", yöntem 0) girdileri sorunsuz açar; bu yüzden deflate uygulamıyoruz.
// Fotoğraflar zaten JPEG olarak sıkıştırılmış geldiği için kayıp da yok.
//
// OKUMA deflate'i de açar (27.10.2026, ekibin NAS dosyası: Excel'in yazdığı
// her girdi deflate'li). Dokunulmayan girdi AÇILMADAN, sıkıştırılmış baytıyla
// aynen geri yazılabilir (HamZipGirdisi) — makro (vbaProject.bin) dahil.

import { inflate } from './inflate';

export interface ZipGirdisi { ad: string; veri: Uint8Array | string }

/** Arşivdeki bir girdi, AÇILMAMIŞ hâliyle: sıkıştırılmış bayt + başlık bilgisi. */
export interface HamZipGirdisi {
  ad: string;
  /** Adın arşivdeki baytları — yeniden yazarken birebir korunur. */
  adBayt: Uint8Array;
  /** 0 = store, 8 = deflate. */
  yontem: number;
  bayrak: number;
  crc: number;
  /** Açık (sıkıştırılmamış) boyut. */
  boyut: number;
  /** Sıkıştırılmış veri. */
  ham: Uint8Array;
  zaman: number;
  tarih: number;
}

const hamMi = (d: ZipGirdisi | HamZipGirdisi): d is HamZipGirdisi => 'ham' in d;
/** CRC-32 tablosu (IEEE 802.3 polinomu, tersine çevrilmiş 0xEDB88320). */
const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bayt: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bayt.length; i++) c = CRC_TABLO[(c ^ bayt[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const KODLAYICI = new TextEncoder();

/** Tarihi DOS zaman/tarih ikilisine çevirir (ZIP başlığı böyle ister). */
function dosTarih(d: Date) {
  const yil = Math.max(1980, d.getFullYear());
  return {
    zaman: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
    tarih: ((yil - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

class Yazici {
  parcalar: Uint8Array[];
  uzunluk: number;
  constructor() { this.parcalar = []; this.uzunluk = 0; }
  ekle(u8: Uint8Array) { this.parcalar.push(u8); this.uzunluk += u8.length; }
  u16(v: number) { const b = new Uint8Array(2); b[0] = v & 0xFF; b[1] = (v >>> 8) & 0xFF; this.ekle(b); }
  u32(v: number) { const b = new Uint8Array(4); b[0] = v & 0xFF; b[1] = (v >>> 8) & 0xFF; b[2] = (v >>> 16) & 0xFF; b[3] = (v >>> 24) & 0xFF; this.ekle(b); }
  topla() {
    const cikti = new Uint8Array(this.uzunluk);
    let o = 0;
    for (const p of this.parcalar) { cikti.set(p, o); o += p.length; }
    return cikti;
  }
}

/**
 * Dosya listesinden ZIP arşivi üretir.
 * @param {{ad:string, veri:Uint8Array|string}[]} dosyalar
 * @param {Date} [tarih]
 * @returns {Uint8Array}
 */
export function zipOlustur(dosyalar: (ZipGirdisi | HamZipGirdisi)[], tarih: Date = new Date()): Uint8Array {
  const simdi = dosTarih(tarih);
  const z = new Yazici();
  const merkez: {
    ad: Uint8Array; bayrak: number; yontem: number; zaman: number; tarih: number;
    kontrol: number; sikisik: number; boyut: number; konum: number;
  }[] = [];

  for (const d of dosyalar) {
    let m: (typeof merkez)[number];
    let veri: Uint8Array;
    if (hamMi(d)) {
      // Açılmadan aynen: sıkıştırılmış bayt, özgün CRC ve boyutlar. Bayrağın
      // 3. biti ("boyutlar veriden sonra") düşer — burada başlıkta yazılıyor.
      veri = d.ham;
      m = {
        ad: d.adBayt, bayrak: d.bayrak & ~0x0008, yontem: d.yontem, zaman: d.zaman, tarih: d.tarih,
        kontrol: d.crc, sikisik: d.ham.length, boyut: d.boyut, konum: z.uzunluk,
      };
    } else {
      veri = typeof d.veri === 'string' ? KODLAYICI.encode(d.veri) : d.veri;
      m = {
        ad: KODLAYICI.encode(d.ad), bayrak: 0x0800, yontem: 0, zaman: simdi.zaman, tarih: simdi.tarih,
        kontrol: crc32(veri), sikisik: veri.length, boyut: veri.length, konum: z.uzunluk,
      };
    }

    // Yerel dosya başlığı
    z.u32(0x04034b50);
    z.u16(20);          // çıkarmak için gereken sürüm
    z.u16(m.bayrak);    // 0x0800: dosya adı UTF-8
    z.u16(m.yontem);    // 0 store, 8 deflate
    z.u16(m.zaman); z.u16(m.tarih);
    z.u32(m.kontrol); z.u32(m.sikisik); z.u32(m.boyut);
    z.u16(m.ad.length); z.u16(0);
    z.ekle(m.ad);
    z.ekle(veri);

    merkez.push(m);
  }

  const merkezBasi = z.uzunluk;
  for (const m of merkez) {
    z.u32(0x02014b50);
    z.u16(20); z.u16(20);
    z.u16(m.bayrak); z.u16(m.yontem);
    z.u16(m.zaman); z.u16(m.tarih);
    z.u32(m.kontrol); z.u32(m.sikisik); z.u32(m.boyut);
    z.u16(m.ad.length); z.u16(0); z.u16(0);
    z.u16(0); z.u16(0); z.u32(0);
    z.u32(m.konum);
    z.ekle(m.ad);
  }
  const merkezBoyu = z.uzunluk - merkezBasi;

  // Merkezî dizin sonu kaydı
  z.u32(0x06054b50);
  z.u16(0); z.u16(0);
  z.u16(merkez.length); z.u16(merkez.length);
  z.u32(merkezBoyu); z.u32(merkezBasi);
  z.u16(0);

  return z.topla();
}

/**
 * ZIP OKUYUCU (26.10.2026, yedekten geri yükleme; 27.10.2026 deflate). Merkezi
 * dizinden okunur; girdiler AÇILMADAN döner (`girdiyiAc` açar). ZIP64 ve
 * store/deflate dışındaki yöntemler sessizce bozuk okunmasın diye HATA verir.
 */
export function zipHamOku(bayt: Uint8Array): HamZipGirdisi[] {
  const g = new DataView(bayt.buffer, bayt.byteOffset, bayt.byteLength);
  // Dizin sonu kaydı (EOCD) sondan geriye aranır (yorum alanı en çok 65535 bayt).
  let son = -1;
  for (let i = bayt.length - 22; i >= Math.max(0, bayt.length - 22 - 65535); i--) {
    if (g.getUint32(i, true) === 0x06054B50) { son = i; break; }
  }
  if (son < 0) throw new Error('ZIP değil: dizin sonu bulunamadı');
  const adet = g.getUint16(son + 10, true);
  let p = g.getUint32(son + 16, true);
  if (adet === 0xFFFF || p === 0xFFFFFFFF) throw new Error('ZIP64 arşivi desteklenmiyor');
  const cozucu = new TextDecoder();
  const sonuc: HamZipGirdisi[] = [];
  for (let n = 0; n < adet; n++) {
    if (p + 46 > bayt.length || g.getUint32(p, true) !== 0x02014B50) throw new Error('ZIP bozuk: merkezi dizin girdisi yok');
    const bayrak = g.getUint16(p + 8, true);
    const yontem = g.getUint16(p + 10, true);
    const zaman = g.getUint16(p + 12, true);
    const tarih = g.getUint16(p + 14, true);
    const crc = g.getUint32(p + 16, true);
    const sikisik = g.getUint32(p + 20, true);
    const boyut = g.getUint32(p + 24, true);
    const adUz = g.getUint16(p + 28, true);
    const ekUz = g.getUint16(p + 30, true);
    const yorumUz = g.getUint16(p + 32, true);
    const yerel = g.getUint32(p + 42, true);
    const adBayt = bayt.subarray(p + 46, p + 46 + adUz);
    const ad = cozucu.decode(adBayt);
    if (sikisik === 0xFFFFFFFF || boyut === 0xFFFFFFFF || yerel === 0xFFFFFFFF) throw new Error(`ZIP64 girdisi desteklenmiyor: ${ad}`);
    if (bayrak & 0x0001) throw new Error(`ZIP girdisi şifreli, okunamaz: ${ad}`);
    if (yerel + 30 > bayt.length || g.getUint32(yerel, true) !== 0x04034B50) throw new Error(`ZIP bozuk: yerel başlık yok (${ad})`);
    const veriBas = yerel + 30 + g.getUint16(yerel + 26, true) + g.getUint16(yerel + 28, true);
    if (veriBas + sikisik > bayt.length) throw new Error(`ZIP bozuk: girdi dosyanın dışına taşıyor (${ad})`);
    sonuc.push({ ad, adBayt, yontem, bayrak, crc, boyut, ham: bayt.subarray(veriBas, veriBas + sikisik), zaman, tarih });
    p += 46 + adUz + ekUz + yorumUz;
  }
  return sonuc;
}

/** Girdiyi açar ve CRC'sini denetler. */
export function girdiyiAc(h: HamZipGirdisi): Uint8Array {
  let veri: Uint8Array;
  if (h.yontem === 0) veri = h.ham;
  else if (h.yontem === 8) veri = inflate(h.ham, h.boyut);
  else throw new Error(`ZIP girdisi desteklenmeyen yöntemle sıkıştırılmış (${h.yontem}), okunamaz: ${h.ad}`);
  if (veri.length !== h.boyut || crc32(veri) !== h.crc) throw new Error(`ZIP bozuk: CRC uymuyor (${h.ad})`);
  return veri;
}

/** Bütün dosya girdilerini açarak okur (klasör girdileri atlanır). */
export function zipOku(bayt: Uint8Array): { ad: string; veri: Uint8Array }[] {
  return zipHamOku(bayt).filter((h) => !h.ad.endsWith('/')).map((h) => ({ ad: h.ad, veri: girdiyiAc(h) }));
}
