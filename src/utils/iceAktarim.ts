// İÇE AKTARIM — tablo dosyasını okuma ve sütun eşleme.
// ---------------------------------------------------------------------------
// NEDEN VAR. Rakip taramasında (RAKIP-OZELLIK-ANALIZI.md) geçiş engelinin
// kendisi buydu: Sinerji/KolayOfis kullanan bir avukat 300 dosyasını elle
// girmeyi göze almadan bize geçmez. Dışa aktarımımız vardı, içe aktarımımız
// yoktu.
//
// NEDEN SÜTUN EŞLEMELİ. Bir ara "önce rakip programın çıktı biçimini görmek
// lazım" diye beklendi. Gereksiz: gerçek içe aktarma araçları biçimi ÖNCEDEN
// BİLMEZ. Dosyanın kendi başlıklarını okuyup kullanıcıya "bu sütun ne?" diye
// sorarlar. Böylece aynı kod UYAP'ın Excel çıktısını da, Sinerji'yi de,
// KolayOfis'i de, elle yapılmış bir listeyi de alır.
//
// Bu dosya SAF tutuldu (react-native yok) — vitest doğrudan okusun diye.
// Dosya seçme ve okuma işi src/lib/girdi.ts'te.

/* ---------------- CSV ayrıştırma ---------------- */

/**
 * Ayırıcıyı tahmin eder.
 *
 * ⚠️ TÜRKÇE EXCEL NOKTALI VİRGÜL YAZAR. Türkçe Windows'ta ondalık ayırıcı
 * virgül olduğu için Excel, CSV'yi `;` ile ayırır. Ayırıcıyı virgüle
 * sabitleyen bir okuyucu, Türkiye'den gelen dosyaların neredeyse tamamını
 * TEK SÜTUN olarak okur ve kullanıcı sebebini anlamaz.
 *
 * Sayma yalnız ilk satırda ve tırnak DIŞINDA yapılıyor: "Ahmet, Mehmet" gibi
 * bir hücre virgül sayısını şişirip yanlış ayırıcı seçtirebilirdi.
 */
export function ayiriciTahmin(metin: string): string {
  const ilkSatir = metin.split(/\r?\n/, 1)[0] ?? '';
  const adaylar = [';', ',', '\t', '|'];
  let enIyi = ';';
  let enCok = -1;
  for (const a of adaylar) {
    let sayi = 0;
    let tirnakta = false;
    for (let i = 0; i < ilkSatir.length; i += 1) {
      const k = ilkSatir[i];
      if (k === '"') tirnakta = !tirnakta;
      else if (k === a && !tirnakta) sayi += 1;
    }
    if (sayi > enCok) {
      enCok = sayi;
      enIyi = a;
    }
  }
  return enIyi;
}

/**
 * CSV metnini satır/hücre dizisine çevirir.
 *
 * Elle yazıldı çünkü `split(',')` üç yerde birden kırılır ve üçü de gerçek
 * dosyalarda sık: tırnak içindeki ayırıcı, tırnak içindeki SATIR SONU, ve
 * çift tırnakla kaçırılmış tırnak ("" → ").
 *
 * BOM ATILIR. Excel UTF-8 CSV'yi BOM ile yazar; atılmazsa ilk başlık
 * "﻿Esas No" olur ve hiçbir eşleşme tutmaz — hata da vermez, sessizce
 * eşleşmez. Bu tür sessiz kusurlar en pahalı olanlar.
 */
export function csvAyristir(metin: string, ayirici?: string): string[][] {
  const temiz = metin.replace(/^﻿/, '');
  const ayr = ayirici ?? ayiriciTahmin(temiz);

  const satirlar: string[][] = [];
  let satir: string[] = [];
  let hucre = '';
  let tirnakta = false;

  for (let i = 0; i < temiz.length; i += 1) {
    const k = temiz[i];

    if (tirnakta) {
      if (k === '"') {
        if (temiz[i + 1] === '"') {
          hucre += '"';
          i += 1;
        } else {
          tirnakta = false;
        }
      } else {
        hucre += k;
      }
      continue;
    }

    if (k === '"') {
      tirnakta = true;
    } else if (k === ayr) {
      satir.push(hucre);
      hucre = '';
    } else if (k === '\n') {
      satir.push(hucre);
      satirlar.push(satir);
      satir = [];
      hucre = '';
    } else if (k === '\r') {
      // \r\n'in \r'ı yutulur; tek başına \r (eski Mac) satır sonu sayılır.
      if (temiz[i + 1] !== '\n') {
        satir.push(hucre);
        satirlar.push(satir);
        satir = [];
        hucre = '';
      }
    } else {
      hucre += k;
    }
  }

  if (hucre !== '' || satir.length > 0) {
    satir.push(hucre);
    satirlar.push(satir);
  }

  // Tamamen boş satırları at (dosya sonundaki boş satırlar sık).
  return satirlar.filter((s) => s.some((h) => h.trim() !== ''));
}

/* ---------------- Sütun eşleme ---------------- */

/** İçe aktarılabilen alanlar. */
export type Alan =
  | 'baslik'
  | 'esasNo'
  | 'mahkeme'
  | 'muvekkil'
  | 'karsiTaraf'
  | 'davaTuru'
  | 'acilisTarihi'
  | 'durum';

export const ALAN_ADLARI: Record<Alan, string> = {
  baslik: 'Dosya başlığı',
  esasNo: 'Esas no',
  mahkeme: 'Mahkeme / birim',
  muvekkil: 'Müvekkil',
  karsiTaraf: 'Karşı taraf',
  davaTuru: 'Dava türü',
  acilisTarihi: 'Açılış tarihi',
  durum: 'Durum',
};

/**
 * Başlık adından alan tahmini.
 *
 * Bu bir KOLAYLIK, karar değil: tahmin ekranda gösteriliyor ve kullanıcı
 * değiştirebiliyor. Yanlış tahmin sessizce uygulanmaz.
 *
 * Küçük harfe çevirirken `toLocaleLowerCase('tr')` KULLANILMIYOR ve bu
 * bilinçli: Türkçe kipte "I" → "ı" olur, "İ" → "i" olur; başlıklar karışık
 * geldiğinde iki yönlü kayma yapar. Onun yerine Türkçe harfler açıkça
 * sadeleştiriliyor (ı→i, ş→s ...), böylece "MÜVEKKİL", "Müvekkil" ve
 * "muvekkil" aynı anahtara iner.
 */
export function sadelestir(metin: string): string {
  return metin
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Alan başına aranan başlık kalıpları — en ayırt ediciden genele. */
const KALIPLAR: Array<[Alan, RegExp[]]> = [
  ['esasNo', [/\besas\b/, /\bdosya no\b/, /\besas no\b/, /\bdosya numarasi\b/]],
  ['mahkeme', [/\bmahkeme\b/, /\bbirim\b/, /\badliye\b/, /\bicra (mudurlugu|dairesi)\b/]],
  ['muvekkil', [/\bmuvekkil\b/, /\bmusteri\b/, /\bvekil edilen\b/, /\bdavaci\b/, /\balacakli\b/]],
  ['karsiTaraf', [/\bkarsi taraf\b/, /\bdavali\b/, /\bborclu\b/, /\bsanik\b/]],
  ['davaTuru', [/\bdava turu\b/, /\bdava konusu\b/, /\btur\b/, /\bkonu\b/]],
  ['acilisTarihi', [/\bacilis\b/, /\bacilma\b/, /\bkayit tarihi\b/, /\btarih\b/]],
  ['durum', [/\bdurum\b/, /\bhal\b/, /\bderdest\b/, /\bsafha\b/, /\basama\b/]],
  ['baslik', [/\bbaslik\b/, /\bdosya adi\b/, /\bad\b/, /\bkonu basligi\b/]],
];

/**
 * Başlık satırından alan → sütun indeksi eşlemesi tahmin eder.
 *
 * Bir alan birden çok sütuna uyarsa İLK eşleşen kazanır ve o sütun bir daha
 * kullanılmaz: aynı sütunun iki alana atanması, iki alanın da yanlış
 * dolmasına yol açardı.
 */
export function basliklariEslestir(basliklar: string[]): Partial<Record<Alan, number>> {
  const sade = basliklar.map(sadelestir);
  const eslesme: Partial<Record<Alan, number>> = {};
  const kullanilan = new Set<number>();

  for (const [alan, kaliplar] of KALIPLAR) {
    for (const kalip of kaliplar) {
      const idx = sade.findIndex((b, i) => !kullanilan.has(i) && kalip.test(b));
      if (idx !== -1) {
        eslesme[alan] = idx;
        kullanilan.add(idx);
        break;
      }
    }
  }
  return eslesme;
}

/* ---------------- Satırları kayda çevirme ---------------- */

export interface AktarimSatiri {
  baslik: string;
  esasNo: string | null;
  mahkeme: string | null;
  muvekkil: string | null;
  karsiTaraf: string | null;
  davaTuru: string | null;
  acilisTarihi: string | null;
  durum: string | null;
}

export interface AktarimSonucu {
  /** Yazılmaya hazır satırlar. */
  kayitlar: AktarimSatiri[];
  /** Atlanan satırlar ve sebebi — kullanıcıya GÖSTERİLİR, sessizce atılmaz. */
  atlananlar: Array<{ satirNo: number; sebep: string }>;
}

/**
 * GG.AA.YYYY → YYYY-AA-GG. Tanımadığı biçimi ÇEVİRMEZ, null döner.
 *
 * Tahmin etmiyoruz: 03.04.2026 bazı ülkelerde 4 Mart'tır. Türkçe bir tablo
 * için gün.ay.yıl doğru varsayım ama ISO biçimi (2026-04-03) de geçerli ve
 * ikisi karıştırılamaz. Tanınmayan biçim null kalır ve kayıt yine aktarılır —
 * tarihsiz bir dosya, yanlış tarihli dosyadan iyidir.
 */
export function tarihCevir(ham: string | null | undefined): string | null {
  const s = (ham ?? '').trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const trTarih = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (trTarih) {
    const gun = Number(trTarih[1]);
    const ay = Number(trTarih[2]);
    if (gun < 1 || gun > 31 || ay < 1 || ay > 12) return null;
    return `${trTarih[3]}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
  }
  return null;
}

const deger = (satir: string[], idx: number | undefined): string | null => {
  if (idx == null) return null;
  const v = (satir[idx] ?? '').trim();
  return v === '' ? null : v;
};

/**
 * Satırları kayda çevirir. Başlık satırı ÇAĞIRAN tarafından ayrılmış olmalı.
 *
 * BAŞLIK ZORUNLU ama uydurulabilir: dosya başlığı yoksa esas no + mahkemeden
 * üretilir. İkisi de yoksa satır atlanır — başlıksız dosya listede boş
 * görünür ve avukat onu bir daha bulamaz.
 */
export function satirlariCevir(
  satirlar: string[][],
  eslesme: Partial<Record<Alan, number>>,
): AktarimSonucu {
  const kayitlar: AktarimSatiri[] = [];
  const atlananlar: AktarimSonucu['atlananlar'] = [];

  satirlar.forEach((satir, i) => {
    const esasNo = deger(satir, eslesme.esasNo);
    const mahkeme = deger(satir, eslesme.mahkeme);
    const muvekkil = deger(satir, eslesme.muvekkil);
    let baslik = deger(satir, eslesme.baslik);

    if (!baslik) {
      // Başlık yoksa anlamlı bir tane üret: "2026/418 — İstanbul 9. İş Mah."
      const parcalar = [esasNo, mahkeme ?? muvekkil].filter(Boolean);
      baslik = parcalar.length ? parcalar.join(' — ') : null;
    }

    if (!baslik) {
      atlananlar.push({
        satirNo: i + 1,
        sebep: 'Başlık, esas no ve mahkeme birden boş — dosya adlandırılamıyor',
      });
      return;
    }

    kayitlar.push({
      baslik,
      esasNo,
      mahkeme,
      muvekkil,
      karsiTaraf: deger(satir, eslesme.karsiTaraf),
      davaTuru: deger(satir, eslesme.davaTuru),
      acilisTarihi: tarihCevir(deger(satir, eslesme.acilisTarihi)),
      durum: deger(satir, eslesme.durum),
    });
  });

  return { kayitlar, atlananlar };
}
