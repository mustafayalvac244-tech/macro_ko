// AVUKATLIK ASGARİ ÜCRET TARİFESİ (AAÜT) — TEK KAYNAK VE TARİH DAMGASI.
// ---------------------------------------------------------------------------
// NEDEN BU DOSYA VAR. Tarife dilimleri hesaplayıcı ekranının içine, tarihsiz ve
// kaynaksız gömülüydü. Hukuk aracında bunun adı sessiz eskimedir: sayı
// güncelken de eskimişken de ekranda AYNI görünür. Avukat, gördüğü rakamın
// hangi yılın tarifesinden geldiğini bilemiyordu — ve tarife her yıl değişiyor.
//
// Yanlış vekalet ücreti iki yönde de pahalı: eksik hesaplarsan müvekkilden az
// istersin, fazla hesaplarsan tarifenin altında/üstünde bir sözleşme kurarsın.
// İkisi de sessizdir; fatura kesildiğinde değil, iş bittiğinde anlaşılır.
//
// Buradaki kural: HER SAYI, NEREDEN GELDİĞİNİ SÖYLER. Doğrulananlar resmî
// metinden alındı; doğrulanamayanlar açıkça öyle işaretlendi ve ekranda da
// öyle gösteriliyor. "Bilmiyoruz" demek, bilmediğini bilmeden sayı vermekten
// iyidir.

/**
 * Yürürlükteki tarifenin kimliği.
 *
 * DOĞRULANDI: Türkiye Barolar Birliği'nin yayımladığı resmî metinden okundu
 * (2025-2026 Yılı Avukatlık Asgari Ücret Tarifesi). Tarifenin kendi başlığı
 * "4 Kasım 2025 SALI, Resmî Gazete Sayı: 33067" diyor ve metin içinde
 * 08.01.2026 tarihli 33131 sayılı Resmî Gazete ile MADDE 13/2'nin
 * yürürlükten kaldırıldığı dipnotu yer alıyor.
 */
export const TARIFE = {
  ad: '2025-2026 Yılı Avukatlık Asgari Ücret Tarifesi',
  resmiGazete: '4.11.2025 — Sayı 33067',
  sonDegisiklik: '8.1.2026 — Sayı 33131',
  /** Resmî metnin adresi; ekranda gösterilir ki avukat kendi teyit edebilsin. */
  kaynak: 'https://www.barobirlik.org.tr/Ucret-Tarifeleri',
  /**
   * Tarifenin yayımlandığı tarih. Eskime uyarısı buna göre veriliyor: tarife
   * her yıl (genellikle sonbaharda) yenileniyor, yani bir yılı geçmişse büyük
   * ihtimalle yenisi çıkmıştır.
   */
  yayim: '2025-11-04',
} as const;

/**
 * Kademeli (nispi) tarife dilimleri — ÜÇÜNCÜ KISIM.
 *
 * ⚠️ DOĞRULANMADI. Resmî PDF'teki tablolar metne dönüşmüyor (tablo içeriği
 * çizim olarak gömülü; hem kendi belge çıkarıcımız hem pdftotext boş döndü).
 * Aşağıdaki dilimler uygulamada ZATEN VARDI ve hangi yılın tarifesinden
 * geldikleri bilinmiyor. Doğrulanmadan silmek de yanlış olurdu: elde bir
 * hesap olması, hiç hesap olmamasından iyi — ama avukatın bunu BİLEREK
 * kullanması şart. Bu yüzden ekranda "doğrulanmadı" uyarısı gösteriliyor.
 *
 * Tablolar okunabilir bir kaynaktan alındığında burası tek satırda güncellenir
 * ve `dilimlerDogrulandi` true yapılır — ekrandaki uyarı kendiliğinden kalkar.
 */
export const DILIMLER_DOGRULANDI = false;

export const AAUT_DILIMLER: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 400_000, rate: 0.16 },
  { upTo: 800_000, rate: 0.15 },
  { upTo: 1_600_000, rate: 0.14 },
  { upTo: 2_800_000, rate: 0.11 },
  { upTo: 4_400_000, rate: 0.08 },
  { upTo: 6_400_000, rate: 0.05 },
  { upTo: 8_800_000, rate: 0.03 },
  { upTo: 11_600_000, rate: 0.02 },
  { upTo: Infinity, rate: 0.01 },
];

/**
 * Resmî metinden DOĞRULANAN eşikler. Bunlar tablo değil, madde metni içinde
 * yazıyla geçtiği için okunabildi.
 */
export const TARIFE_ESIK = {
  /** İcra takiplerinde: bu tutara kadarki takiplerde ayrı kural işler (m.11). */
  icraTakibiTry: 56_250,
  /** Arabuluculuk faaliyetlerinde alt sınır kuralının eşiği (m.16). */
  arabuluculukTry: 50_000,
} as const;

/** Seri davalarda tam ücrete uygulanan oranlar (m.22) — DOĞRULANDI. */
export const SERI_DAVA_ORANI = {
  ilk10: 1.0,
  '11_50': 0.5,
  '51_100': 0.4,
  yuzUstu: 0.25,
} as const;

/**
 * Nispi karar ve ilam harcı oranı (binde 68,31).
 *
 * ⚠️ DOĞRULANMADI. Harçlar Kanunu (1) sayılı tarifeden gelir ve her yıl yeniden
 * değerleme oranıyla güncellenir. Uygulamada tarihsiz gömülüydü; buraya taşındı
 * ki hiç değilse tek yerde dursun ve doğrulanmadığı görünsün.
 *
 * EKSİK KALEMLER de var: başvurma harcı, vekalet suret harcı, gider avansı ve
 * nispi harcın MAKTU TABANI burada yok. Yani ekrandaki peşin harç, davayı
 * açmanın gerçek maliyeti DEĞİL — hesaplayıcı bunu artık açıkça söylüyor.
 */
export const KARAR_HARCI_ORANI = 0.06831;
export const PESIN_HARC_PAYI = 1 / 4;
export const HARC_DOGRULANDI = false;

/**
 * Tarife bir yıldan eskiyse muhtemelen yenisi çıkmıştır.
 *
 * Eşiğin bir yıl olmasının sebebi tarifenin yıllık yenilenmesi; "kesin
 * eskimiş" demiyoruz, "bak ve teyit et" diyoruz. Kesin konuşmak için
 * yürürlükten kalkma tarihini bilmemiz gerekirdi, bilmiyoruz.
 */
export function tarifeEskiMi(bugun: Date = new Date()): boolean {
  const yayim = new Date(TARIFE.yayim);
  const birYilSonra = new Date(yayim);
  birYilSonra.setFullYear(birYilSonra.getFullYear() + 1);
  return bugun >= birYilSonra;
}

/** Kademeli tarifeye göre vekalet ücreti; maktu taban ayrıca uygulanır. */
export function aautHesapla(tutar: number): {
  ucret: number;
  satirlar: Array<{ ustSinir: number; dilim: number; oran: number; ucret: number }>;
} {
  const satirlar: Array<{ ustSinir: number; dilim: number; oran: number; ucret: number }> = [];
  if (!(tutar > 0)) return { ucret: 0, satirlar };
  let kalan = tutar;
  let oncekiTavan = 0;
  let ucret = 0;
  for (const d of AAUT_DILIMLER) {
    const dilimBoyu = d.upTo - oncekiTavan;
    const pay = Math.min(kalan, dilimBoyu);
    if (pay <= 0) break;
    const dilimUcreti = pay * d.rate;
    ucret += dilimUcreti;
    satirlar.push({ ustSinir: d.upTo, dilim: pay, oran: d.rate, ucret: dilimUcreti });
    kalan -= pay;
    oncekiTavan = d.upTo;
  }
  return { ucret, satirlar };
}
