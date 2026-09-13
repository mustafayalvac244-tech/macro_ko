import { Platform } from 'react-native';

/**
 * GENİŞ EKRAN DÜZENİ (yalnız web).
 *
 * BULUNAN KUSUR: uygulama telefon düzeniyle yazıldı ve web'de o düzen ekranın
 * TAMAMINA esnetiliyordu. 1900 px'lik bir masaüstünde tek bir kart 1870 px
 * genişliyor, "Gelir ₺0" yazısı boş bir tarlanın ortasında kalıyor, göz satır
 * başını bulamıyordu. Bu bir renk/görsel sorunu değil, ÖLÇÜ sorunudur:
 * okunabilir bir metin sütunu ~60-75 karakterdir, kart ızgarası da benzer bir
 * üst sınıra ihtiyaç duyar.
 *
 * ÇÖZÜM: içerik sabit bir üst genişlikte ORTALANIR. Üst çubuk (marka, zil,
 * avatar) tam genişlikte kalır — masaüstü uygulamalarında başlık çubuğu
 * kenardan kenara uzanır, içerik ortalanır.
 *
 * NATİFTE HİÇBİR ŞEY DEĞİŞMEZ: telefonda ekran genişliği zaten bu sınırın
 * altında ve Platform.OS kontrolü natifte devre dışı bırakır.
 */

/**
 * Sütun genişlikleri. Üçe ayrılmasının sebebi: bir dava listesi ile bir giriş
 * formu aynı genişliği İSTEMEZ. 1180 px'lik bir giriş formunda e-posta kutusu
 * ekranın bir ucundan diğerine uzanır ve amatör durur.
 */
export const SUTUN_GENISLIKLERI = {
  /** Liste, ızgara, pano — birden çok sütun taşıyabilen ekranlar. */
  genis: 1180,
  /**
   * GÖSTERGE PANELİ — yalnız ana ekran, yalnız web.
   *
   * NEDEN AYRI VE NEDEN DAHA GENİŞ. `genis` (1180) bir OKUMA sütunudur: tek
   * sütun hâlinde akan listeler için doğru üst sınır. Ana ekran ise okunmuyor,
   * TARANIYOR — avukat sabah açıp "bugün ne var" diye bakıyor. O bakışta
   * istenen şey, kartların alt alta dizilip üçüncü kartın ekranın altında
   * kalması değil, hepsinin AYNI ANDA görünmesi.
   *
   * 1180'de 1920 px'lik bir ekranın %39'u boş kalıyordu: solda kalıcı menü,
   * ortada dar bir şerit, sağda ve solda iki geniş boşluk. 1560, üç sütunu
   * (3 × ~490 px) rahat taşıyan ve kartların içindeki metnin satır uzunluğunu
   * bozmayan genişlik. Daha genişi kart içi metni yayar, dar sütun mantığını
   * bozar.
   */
  pano: 1560,
  /** Okuma ve uzun metin (kanun maddesi, sözleşme) — satır uzunluğu sınırlı. */
  dar: 860,
  /** Tek sütunlu form (giriş, kayıt, şifre) — tek bir kart gibi durmalı. */
  form: 480,
} as const;

export type SutunTuru = keyof typeof SUTUN_GENISLIKLERI;

/** Geriye dönük ad — dış kodda kullanılıyorsa kırılmasın. */
export const ICERIK_MAX_GENISLIK = SUTUN_GENISLIKLERI.genis;

/** Bu genişliğin üstünde "masaüstü" sayılır (tablet yatay ve üstü). */
export const GENIS_ESIK = 1024;

export function genisEkranMi(pencereGenisligi: number): boolean {
  return Platform.OS === 'web' && pencereGenisligi >= GENIS_ESIK;
}

/**
 * KALICI YAN MENÜ.
 *
 * Uygulamanın menüsü hamburger düğmesinin arkasında duruyor — telefon deseni.
 * Nielsen Norman Group'un dikey gezinme incelemesi bunun masaüstünde bir kusur
 * olduğunu söylüyor: kullanıcı zamanın ~%80'inde ekranın SOL yarısına bakıyor,
 * dikey liste yatay listeden daha hızlı taranıyor (tek bakışta daha çok öge)
 * ve öneri açıkça "gezinmeyi görünür tut, hamburger menünün arkasına saklama".
 * Kaynak: nngroup.com/articles/vertical-nav/
 * Material 3 de aynı yönde: "expanded" (≥840dp) genişlikte kalıcı (standard)
 * navigation drawer öneriliyor.
 *
 * EŞİK NEDEN 1280: menü 272 px. 1180 px'lik içerik sütunu + menü = 1452 px.
 * 1280'in altında menüyü kalıcı yapmak içeriği ezerdi; orada hamburger daha
 * doğru. Natifte her zaman false — telefonda kalıcı menü yeri yok.
 */
export const YAN_MENU_GENISLIGI = 272;
export const KALICI_MENU_ESIGI = 1280;

export function kaliciMenuMu(pencereGenisligi: number): boolean {
  return Platform.OS === 'web' && pencereGenisligi >= KALICI_MENU_ESIGI;
}

export interface OrtalamaStili {
  width: '100%';
  maxWidth: number;
  alignSelf: 'center';
}

/**
 * Ortalanmış içerik sütununun stili. Geniş ekran değilse `null` döner —
 * çağıran taraf `[styles.x, ortalaStili(w)]` diye dizi verdiğinde null
 * öge React Native tarafından yok sayılır, yani dar ekranda ek stil yok.
 */
export function ortalaStili(pencereGenisligi: number, tur: SutunTuru = 'genis'): OrtalamaStili | null {
  if (!genisEkranMi(pencereGenisligi)) return null;
  return {
    width: '100%',
    maxWidth: SUTUN_GENISLIKLERI[tur],
    alignSelf: 'center',
  };
}

/**
 * Geniş ekranda bir satıra kaç sütun sığdırılacağı.
 * Kart genişliği `enAzKart` px'in altına düşerse sütun sayısı azaltılır.
 */
export function sutunSayisi(pencereGenisligi: number, enAzKart = 340, enFazla = 2): number {
  if (!genisEkranMi(pencereGenisligi)) return 1;
  const kullanilabilir = Math.min(pencereGenisligi, SUTUN_GENISLIKLERI.genis);
  const sigan = Math.floor(kullanilabilir / enAzKart);
  return Math.max(1, Math.min(enFazla, sigan));
}

/**
 * PANO IZGARASI — ana ekranın geniş tarayıcıdaki düzeni.
 * ===========================================================================
 * NEDEN. Ana ekran telefon düzeniyle yazıldı: kartlar tek sütun hâlinde alt
 * alta. Tarayıcıda bu düzen 1180 px'lik bir şeride sıkışıyor, 1920 px'lik bir
 * ekranda sağ ve sol taraf tamamen boş kalıyor ve "Finansal Özet" kartını
 * görmek için kaydırmak gerekiyordu. Oysa ana ekranın tek işi var: avukat
 * sabah açtığında bugünü TEK BAKIŞTA göstermek. Kaydırmak gereken bir pano,
 * işini yapmıyor demektir.
 *
 * NATİFTE HİÇBİR ŞEY DEĞİŞMEZ: `genisEkranMi` zaten Platform.OS kontrolü
 * yapıyor, dar ekranda `sutun` 1 döner ve her blok tam genişlik alır — yani
 * bugünkü tek sütunlu düzenin aynısı.
 *
 * NEDEN PİKSEL HESABI, YÜZDE DEĞİL. React Native Web'de yüzde genişlikler
 * `gap` ile birlikte kolayca taşma üretiyor (yüzdeler kabın tamamına göre
 * hesaplanıyor, aralar ise ayrıca ekleniyor). Kullanılabilir genişliği bir
 * kez hesaplayıp bölmek hem taşmayı imkânsız kılıyor hem de SINANABİLİR
 * oluyor — bkz. tests/panoIzgara.test.ts.
 */

/** Pano ızgarasında bloklar arası boşluk (px). */
export const PANO_ARALIK = 20;

/**
 * Panonun yatay iç boşluğu (ScrollView içeriğinin sol+sağ payı, px).
 *
 * BU SAYI EKRANDAKİ DOLGUYLA AYNI OLMAK ZORUNDA. İlk denemede burası 24,
 * ekranın dolgusu ise 20'ydi ve `panoOlculeri` dış genişlikten 48 düşerken
 * bloklar 40 dolgulu bir kabın içine yerleşiyordu. Sonuç ölçüldü (1920 px'lik
 * ekran görüntüsü): iki blok toplamı kabın iç genişliğini 40 px aşıyor, ikinci
 * blok alt satıra düşüyor ve panonun sağ tarafı — düzeltilmek istenen boşluğun
 * ta kendisi — yine boş kalıyordu. Bu yüzden ekran, dolgusunu artık bu
 * sabitten alıyor; iki sayı ayrışamaz.
 */
export const PANO_YAN_BOSLUK = 20;

export interface PanoOlculeri {
  /** Bir satıra kaç sütun sığıyor (1, 2 ya da 3). */
  sutun: 1 | 2 | 3;
  /** Tam genişlik blok (başlık, uyarı şeridi). */
  tam: number;
  /** Yarım genişlik blok. */
  yarim: number;
  /** Üçte bir genişlik blok. */
  ucteBir: number;
  /** Üçte iki genişlik blok (ana sütun). */
  ikiUcte: number;
}

/**
 * Panodaki blok genişliklerini hesaplar.
 *
 * @param pencereGenisligi `useWindowDimensions().width`
 * @param kaliciMenu solda kalıcı menü duruyor mu (yer kaplar)
 */
export function panoOlculeri(pencereGenisligi: number, kaliciMenu: boolean): PanoOlculeri {
  // ÖNCE ÜST SINIR, SONRA DOLGU — sıra önemli.
  // Üst sınır (1560) kabın DIŞ genişliğidir; bloklar ise kabın dolgusunun
  // İÇİNE yerleşir. Dolguyu üst sınırdan önce düşmek, geniş ekranda blokların
  // toplamının kabı aşmasına ve son bloğun alt satıra düşmesine yol açıyordu.
  const disGenislik = Math.min(
    Math.max(0, pencereGenisligi - (kaliciMenu ? YAN_MENU_GENISLIGI : 0)),
    SUTUN_GENISLIKLERI.pano,
  );
  const kullanilabilir = Math.max(0, disGenislik - PANO_YAN_BOSLUK * 2);

  // Dar ekran ve natif: tek sütun, bugünkü düzenin aynısı.
  if (!genisEkranMi(pencereGenisligi)) {
    return { sutun: 1, tam: kullanilabilir, yarim: kullanilabilir, ucteBir: kullanilabilir, ikiUcte: kullanilabilir };
  }

  // EŞİKLER KART GENİŞLİĞİNDEN TÜRETİLDİ, EKRAN BOYUTUNDAN DEĞİL.
  // Bir kartın içinde tarih rozeti, başlık ve bir ok yan yana duruyor; bunun
  // altında başlık ikinci satıra taşıyor ve kart bozuluyor. Yani "kaç sütun"
  // sorusunun cevabı "kaç tane okunabilir kart sığıyor" — ekranın kaç inç
  // olduğu değil. Bu yüzden 1366 px'lik bir dizüstünde iki, 1920 px'lik bir
  // masaüstünde üç sütun çıkıyor; eşik listesi tutmak gerekmiyor.
  const EN_AZ_KART = 360;
  const ucSigar = (kullanilabilir - PANO_ARALIK * 2) / 3 >= EN_AZ_KART;
  const ikiSigar = (kullanilabilir - PANO_ARALIK) / 2 >= EN_AZ_KART;
  const sutun: 1 | 2 | 3 = ucSigar ? 3 : ikiSigar ? 2 : 1;

  if (sutun === 1) {
    return { sutun, tam: kullanilabilir, yarim: kullanilabilir, ucteBir: kullanilabilir, ikiUcte: kullanilabilir };
  }

  const yarim = Math.floor((kullanilabilir - PANO_ARALIK) / 2);
  if (sutun === 2) {
    // İki sütunda "üçte bir" diye bir yer yok; en yakın anlamlı karşılık yarım.
    return { sutun, tam: kullanilabilir, yarim, ucteBir: yarim, ikiUcte: kullanilabilir };
  }

  const ucteBir = Math.floor((kullanilabilir - PANO_ARALIK * 2) / 3);
  return {
    sutun,
    tam: kullanilabilir,
    yarim,
    ucteBir,
    // Aradaki boşluk da ana sütuna katılıyor; aksi hâlde üçte iki + üçte bir
    // toplamı kabı doldurmaz ve sağda bir piksel şeridi kalırdı.
    ikiUcte: kullanilabilir - ucteBir - PANO_ARALIK,
  };
}
