// Küçük ZIP yazıcı — dış bağımlılık YOK.
// XLSX aslında içinde XML dosyaları olan bir ZIP arşividir. Excel, sıkıştırılmamış
// ("store", yöntem 0) girdileri sorunsuz açar; bu yüzden deflate uygulamıyoruz.
// Fotoğraflar zaten JPEG olarak sıkıştırılmış geldiği için kayıp da yok.

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

export function crc32(bayt) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bayt.length; i++) c = CRC_TABLO[(c ^ bayt[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const KODLAYICI = new TextEncoder();

/** Tarihi DOS zaman/tarih ikilisine çevirir (ZIP başlığı böyle ister). */
function dosTarih(d) {
  const yil = Math.max(1980, d.getFullYear());
  return {
    zaman: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
    tarih: ((yil - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

class Yazici {
  constructor() { this.parcalar = []; this.uzunluk = 0; }
  ekle(u8) { this.parcalar.push(u8); this.uzunluk += u8.length; }
  u16(v) { const b = new Uint8Array(2); b[0] = v & 0xFF; b[1] = (v >>> 8) & 0xFF; this.ekle(b); }
  u32(v) { const b = new Uint8Array(4); b[0] = v & 0xFF; b[1] = (v >>> 8) & 0xFF; b[2] = (v >>> 16) & 0xFF; b[3] = (v >>> 24) & 0xFF; this.ekle(b); }
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
export function zipOlustur(dosyalar, tarih = new Date()) {
  const { zaman, tarih: dtarih } = dosTarih(tarih);
  const z = new Yazici();
  const merkez = [];

  for (const d of dosyalar) {
    const ad = KODLAYICI.encode(d.ad);
    const veri = typeof d.veri === 'string' ? KODLAYICI.encode(d.veri) : d.veri;
    const kontrol = crc32(veri);
    const konum = z.uzunluk;

    // Yerel dosya başlığı
    z.u32(0x04034b50);
    z.u16(20);      // çıkarmak için gereken sürüm
    z.u16(0x0800);  // bayrak: dosya adı UTF-8
    z.u16(0);       // yöntem: store
    z.u16(zaman); z.u16(dtarih);
    z.u32(kontrol); z.u32(veri.length); z.u32(veri.length);
    z.u16(ad.length); z.u16(0);
    z.ekle(ad);
    z.ekle(veri);

    merkez.push({ ad, kontrol, boyut: veri.length, konum });
  }

  const merkezBasi = z.uzunluk;
  for (const m of merkez) {
    z.u32(0x02014b50);
    z.u16(20); z.u16(20);
    z.u16(0x0800); z.u16(0);
    z.u16(zaman); z.u16(dtarih);
    z.u32(m.kontrol); z.u32(m.boyut); z.u32(m.boyut);
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
