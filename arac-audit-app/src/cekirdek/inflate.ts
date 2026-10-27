// HAM DEFLATE ÇÖZÜCÜ (RFC 1951) — dış bağımlılık YOK (27.10.2026).
//
// Neden: ekibin NAS dosyası (.xlsm) bir ZIP; içindeki XML'ler deflate ile
// sıkıştırılmış. Uygulama o dosyaya satır ekleyebilsin diye okuması gerekiyor.
// Yeni paket native modül sayılmasa da package.json'u değiştirir ve OTA
// bekçisine takılır; çözücü küçük ve standart olduğu için burada yazıldı.
// Yöntem zlib'in "puff" başvuru çözücüsüyle aynı (kanonik Huffman, kod kod
// çözme); doğruluğu Node'un zlib'iyle sıkıştırılmış verilerle sınanıyor.

const UZ_TABAN = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const UZ_EK = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const MES_TABAN = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const MES_EK = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
/** Dinamik blokta kod uzunluğu kodlarının sırası. */
const KOD_SIRASI = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Kanonik Huffman: her uzunlukta kaç kod var ve semboller koda göre sıralı. */
interface Huffman { sayac: Uint16Array; sembol: Uint16Array }

function huffmanKur(uzunluk: ArrayLike<number>, n: number): Huffman {
  const sayac = new Uint16Array(16);
  for (let i = 0; i < n; i++) sayac[uzunluk[i]!]!++;
  sayac[0] = 0;
  const konum = new Uint16Array(16);
  for (let i = 1; i < 16; i++) konum[i] = konum[i - 1]! + sayac[i - 1]!;
  const sembol = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (uzunluk[i]) sembol[konum[uzunluk[i]!]!++] = i;
  return { sayac, sembol };
}

const SABIT = (() => {
  const u = new Uint8Array(288);
  for (let i = 0; i < 144; i++) u[i] = 8;
  for (let i = 144; i < 256; i++) u[i] = 9;
  for (let i = 256; i < 280; i++) u[i] = 7;
  for (let i = 280; i < 288; i++) u[i] = 8;
  return { uz: huffmanKur(u, 288), mes: huffmanKur(new Uint8Array(30).fill(5), 30) };
})();

/**
 * Ham DEFLATE akışını açar. `boy` biliniyorsa (ZIP başlığındaki açık boyut)
 * çıktı tek seferde ayrılır. Bozuk veri sessizce kesilmez: HATA verir.
 */
export function inflate(girdi: Uint8Array, boy?: number): Uint8Array {
  let cikti = new Uint8Array(boy ?? Math.max(1024, girdi.length * 4));
  let o = 0;
  let p = 0;
  let tampon = 0;
  let bitSay = 0;

  const bitler = (n: number): number => {
    while (bitSay < n) {
      if (p >= girdi.length) throw new Error('DEFLATE: veri beklenmeden bitti');
      tampon |= girdi[p++]! << bitSay;
      bitSay += 8;
    }
    const v = tampon & ((1 << n) - 1);
    tampon >>>= n;
    bitSay -= n;
    return v;
  };
  const yer = (n: number) => {
    if (o + n <= cikti.length) return;
    const yeni = new Uint8Array(Math.max(cikti.length * 2, o + n));
    yeni.set(cikti.subarray(0, o));
    cikti = yeni;
  };
  const coz = (h: Huffman): number => {
    let kod = 0, ilk = 0, indeks = 0;
    for (let uz = 1; uz < 16; uz++) {
      kod |= bitler(1);
      const say = h.sayac[uz]!;
      if (kod - say < ilk) return h.sembol[indeks + (kod - ilk)]!;
      indeks += say;
      ilk = (ilk + say) << 1;
      kod <<= 1;
    }
    throw new Error('DEFLATE: geçersiz Huffman kodu');
  };
  const blok = (uz: Huffman, mes: Huffman) => {
    for (;;) {
      let s = coz(uz);
      if (s < 256) { yer(1); cikti[o++] = s; continue; }
      if (s === 256) return;
      s -= 257;
      if (s >= 29) throw new Error('DEFLATE: geçersiz uzunluk kodu');
      const uzunluk = UZ_TABAN[s]! + bitler(UZ_EK[s]!);
      const d = coz(mes);
      if (d >= 30) throw new Error('DEFLATE: geçersiz mesafe kodu');
      const mesafe = MES_TABAN[d]! + bitler(MES_EK[d]!);
      if (mesafe > o) throw new Error('DEFLATE: mesafe çıktının başından önce');
      yer(uzunluk);
      for (let k = 0; k < uzunluk; k++, o++) cikti[o] = cikti[o - mesafe]!;
    }
  };

  let son = 0;
  do {
    son = bitler(1);
    const tur = bitler(2);
    if (tur === 0) {
      // Sıkıştırılmamış blok: bayt sınırına hizalan (kalan bitler bu baytındı).
      tampon = 0; bitSay = 0;
      if (p + 4 > girdi.length) throw new Error('DEFLATE: veri beklenmeden bitti');
      const n = girdi[p]! | (girdi[p + 1]! << 8);
      const tumleyen = girdi[p + 2]! | (girdi[p + 3]! << 8);
      p += 4;
      if ((n ^ 0xFFFF) !== tumleyen) throw new Error('DEFLATE: saklı blok boyu bozuk');
      if (p + n > girdi.length) throw new Error('DEFLATE: veri beklenmeden bitti');
      yer(n);
      cikti.set(girdi.subarray(p, p + n), o);
      o += n; p += n;
    } else if (tur === 1) {
      blok(SABIT.uz, SABIT.mes);
    } else if (tur === 2) {
      const hlit = bitler(5) + 257, hdist = bitler(5) + 1, hclen = bitler(4) + 4;
      const kodUz = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) kodUz[KOD_SIRASI[i]!] = bitler(3);
      const kodH = huffmanKur(kodUz, 19);
      const uz = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist;) {
        const s = coz(kodH);
        if (s < 16) { uz[i++] = s; continue; }
        let tekrar: number, deger = 0;
        if (s === 16) {
          if (i === 0) throw new Error('DEFLATE: önceki uzunluk yok');
          deger = uz[i - 1]!; tekrar = 3 + bitler(2);
        } else if (s === 17) tekrar = 3 + bitler(3);
        else tekrar = 11 + bitler(7);
        if (i + tekrar > hlit + hdist) throw new Error('DEFLATE: uzunluk tekrarı taşıyor');
        while (tekrar--) uz[i++] = deger;
      }
      blok(huffmanKur(uz.subarray(0, hlit), hlit), huffmanKur(uz.subarray(hlit), hdist));
    } else {
      throw new Error('DEFLATE: geçersiz blok türü');
    }
  } while (!son);

  return o === cikti.length ? cikti : cikti.slice(0, o);
}
