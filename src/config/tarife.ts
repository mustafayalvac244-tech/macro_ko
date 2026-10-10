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
 * "4 Kasım 2025 SALI, Resmî Gazete Sayı: 33067" diyor.
 *
 * DÜZELTME (10.10.2026): bu yorum "08.01.2026 tarihli 33131 sayılı RG ile
 * MADDE 13/2 yürürlükten kaldırıldı" diyordu. Resmî Gazete metni (RG 8.1.2026
 * sayı 33131, "Avukatlık Asgari Ücret Tarifesinde Değişiklik Yapılmasına Dair
 * Tarife") kaldırılan hükmün 10. maddenin İKİNCİ FIKRASI olduğunu söylüyor ve
 * hiçbir tutar/oran/tabloyu değiştirmiyor. Bu dosyadaki dilim ve maktu
 * tutarlar bu değişiklikten etkilenmez.
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
 * DOĞRULANDI (10.10.2026). Kaynak: Resmî Gazete 4.11.2025 sayı 33067, "Avukatlık
 * Asgari Ücret Tarifesi" EKİ (https://www.resmigazete.gov.tr/eskiler/2025/11/
 * 20251104-9-1.pdf, 4 sayfalık taranmış görüntü; sayfa 4, "Üçüncü Kısım —
 * Yargı Yerleri ile İcra ve İflas Dairelerinde Yapılan ve Konusu Para Olan
 * veya Para ile Değerlendirilebilen Hukuki Yardımlara Ödenecek Ücret"). Tablo
 * metne dönüşmediği için PDF'in içindeki görüntü çıkarılıp GÖZLE okundu:
 *
 *   1. ilk 600.000 TL için %16        6. sonra gelen 2.400.000 TL için %8
 *   2. sonra gelen 600.000 TL için %15  7. sonra gelen 3.000.000 TL için %5
 *   3. sonra gelen 1.200.000 TL için %14 8. sonra gelen 3.600.000 TL için %3
 *   4. sonra gelen 1.200.000 TL için %13 9. sonra gelen 4.200.000 TL için %2
 *   5. sonra gelen 1.800.000 TL için %11 10. 18.600.000 TL'dan yukarısı için %1
 *
 * (Kümülatif sınırlar: 600.000 · 1.200.000 · 2.400.000 · 3.600.000 · 5.400.000 ·
 * 7.800.000 · 10.800.000 · 14.400.000 · 18.600.000; son sınır tablodaki
 * "18.600.000 TL'dan yukarısı" satırıyla tutuyor.)
 *
 * ESKİ KUSUR: burada 400.000/800.000/1.600.000… sınırlı, hangi yıldan geldiği
 * bilinmeyen bir tablo duruyordu; 1.000.000 TL için 152.000 TL (resmî: 156.000).
 * 8.1.2026 değişikliği (RG 33131) tabloya dokunmuyor. Tarife her Kasım'da
 * yenilenir: `tarifeEskiMi` 4.11.2026'da uyarı verir.
 */
export const DILIMLER_DOGRULANDI = true;

export const AAUT_DILIMLER: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 600_000, rate: 0.16 },
  { upTo: 1_200_000, rate: 0.15 },
  { upTo: 2_400_000, rate: 0.14 },
  { upTo: 3_600_000, rate: 0.13 },
  { upTo: 5_400_000, rate: 0.11 },
  { upTo: 7_800_000, rate: 0.08 },
  { upTo: 10_800_000, rate: 0.05 },
  { upTo: 14_400_000, rate: 0.03 },
  { upTo: 18_600_000, rate: 0.02 },
  { upTo: Infinity, rate: 0.01 },
];

/**
 * İKİNCİ KISIM, İKİNCİ BÖLÜM — konusu para olmayan işlerde MAKTU ücretler.
 * Konusu para olan işte nispi ücret, ilgili mahkemenin maktu ücretinin ALTINDA
 * kalamaz (m.13/1, "altında kalmamak kaydıyla"); hesaplayıcının "asgari ücret"
 * alanı bu tutarlardan seçilir. KAYNAK: aynı ek, sayfa 3 (RG 4.11.2025 sayı
 * 33067), 10.10.2026'da görüntüden okundu. Yalnız hesaplayıcıda kullanılan
 * mahkemeler yazıldı; tablonun kalanı için resmî metne bakın.
 * İcra takibinde ayrıca m.11 vardır (56.250 TL'ye kadar takipte maktu ücret
 * asıl alacağı geçemez; borçlu süresinde öderse 3/4'ü) — hesaplayıcı bunu
 * uygulamaz.
 */
export const AAUT_MAKTU = {
  icraDairesi: 9_000,
  sulhHukuk: 30_000,
  tuketici: 22_500,
  asliye: 45_000,
  fikriSinai: 55_000,
} as const;

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
 * açmanın gerçek maliyeti DEĞİL.
 *
 * DENETİM NOTU (10.10.2026) — HÂLÂ DOĞRULANMADI, KARAR GEREKİYOR. Resmî kaynak:
 * Harçlar Kanunu Genel Tebliği Seri No: 98, RG 31.12.2025 sayı 33124 (5.
 * mükerrer), https://www.resmigazete.gov.tr/eskiler/2025/12/20251231M5-28.pdf —
 * dosya JBIG2 ile taranmış görüntü; bu denetimde çözülemedi. Tebliğin metni
 * (alomaliye.com) maktu harçların 1.1.2026'dan itibaren %18,95 artırıldığını
 * söylüyor. İKİNCİL kaynaklar (kpmgvergi.com 2026 tablosu ve bir arama sonucu)
 * aynı değerleri veriyor: nispi karar ve ilam harcı binde 68,31; maktu karar ve
 * ilam harcı 732,00 TL; başvurma harcı 335,20 TL (sulh) / 732,00 TL (asliye);
 * vekalet suret harcı 104,00 TL. Aynı kaynak, "nispi harç maktudan az olamaz"
 * kuralının tarifede YALNIZ III.1.g bendinde (ihalenin feshi) açıkça yazıldığını
 * not ediyor; genel bir maktu taban kuralı resmî metinden teyit edilmedi, bu
 * yüzden hesaplayıcıya maktu taban EKLENMEDİ. Resmî metin okunana (ör. OCR) ya
 * da avukat teyit edene kadar HARC_DOGRULANDI false kalır.
 *
 * NOT (düzeltildi): bu yorum bir süre "hesaplayıcı bunu artık açıkça söylüyor"
 * diyordu ama SÖYLEMİYORDU — aşağıdaki üç sabit hiçbir yerde kullanılmıyor,
 * hesaplayıcı 0.06831'i satır içine kopyalamış durumdaydı ve HARC_DOGRULANDI
 * bayrağı ekrana hiç ulaşmıyordu. Kaynak dosyanın var olmayan bir güvenceyi
 * beyan etmesi, güvencenin hiç olmamasından daha kötüdür. Bağlantı kuruldu:
 * CourtFeeCalc artık bu sabitleri kullanıyor ve bayrak ekranda görünüyor.
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
