// HASAT SAYFA İLERLETME KARARI — ayrı dosyada, çünkü burada bir kayıp vardı.
// ---------------------------------------------------------------------------
// BULUNAN KAYIP. harvest-tick bir sayfada PAGE_SIZE (20) sonuç çekiyor ama en
// çok `enFazla` (10) YENİ kaydı alıp döngüyü kırıyordu. Ardından sayfa
// KOŞULSUZ ilerletiliyordu:
//
//     next_page: sonSayfa ? 1 : page + 1
//
// Yani bir sayfada 20 yeni karar varsa 10'u alınıp KALAN 10'U BİR DAHA HİÇ
// GÖRÜLMÜYORDU. Sayfa başına en çok %50 kalıcı kayıp.
//
// ÖLÇÜM BUNU DOĞRULADI: 404 terimin TAMAMI 2-5. sayfada, hiçbiri bitmemiş
// (bitmis_terim = 0). Yani "listenin sonuna varıp başa dönünce atlananları
// yakalarız" diye bir telafi yolu pratikte hiç işlemiyordu.
//
// Karar mantığı buraya taşındı ki tek başına sınanabilsin; edge çalışma
// zamanında koşan kodun içinde kalsaydı yalnız canlıda fark edilebilirdi —
// nitekim aylarca öyle oldu.

export type SayfaGirdi = {
  /** Bu turda işlenen sayfa numarası. */
  sayfa: number;
  /** Kaynaktan dönen satır sayısı. */
  satir: number;
  /** Bir sayfanın tam boyu (kaynağa gönderilen pageSize). */
  sayfaBoyu: number;
  /** Kotaya takılıp sayfa BİTİRİLEMEDİ mi? */
  yarimKaldi: boolean;
  /**
   * BİR TERİMDE EN FAZLA KAÇ SAYFA GEZİLİR (varsayılan: sınırsız).
   *
   * NEDEN EKLENDİ — 15.09.2026'da ÖLÇÜLDÜ. Kaynak, popüler bir terim için
   * yarım milyondan fazla sonuç döndürüyor ("işçilik alacakları davası":
   * total = 539.776). Sayfa yalnız EKSİK döndüğünde bitmiş sayıldığı için
   * böyle bir terim ancak ~54.000 turda biter; pratikte HİÇ bitmez. Ölçüm:
   * 970 terimin **sıfırı** bitmiş, iki terim 78. ve 534. sayfadaydı.
   *
   * Sonuç yalnız yavaşlık değil, KAPSAM ÇARPIKLIĞI: havuz birkaç terimin
   * konusuyla doluyor, "zina nedeniyle boşanma" gibi 322 terim hiç
   * çalışmıyordu. Tavan, terimin sırayı bırakıp başa dönmesini sağlar.
   */
  enFazlaSayfa?: number;
};

export type SayfaKarari = {
  /** Bir sonraki turda işlenecek sayfa. */
  sonrakiSayfa: number;
  /** Terim tarandı, bitti mi? */
  bitti: boolean;
};

/**
 * Bir turdan sonra sayfa imlecinin nereye gideceğini söyler.
 *
 * ÜÇ HÂL:
 *  1. Kotaya takıldık (yarimKaldi) → AYNI SAYFADA KAL. Sonraki tur sayfayı
 *     yeniden çeker; alınmış kayıtlar yinelenen diye elenir, kalanlar alınır.
 *     Sonsuz döngü olmaz: sayfada yeni kalmayınca kotaya takılmayız ve imleç
 *     kendiliğinden ilerler.
 *  2. Sayfa tam dolu döndü ve bitirdik → BİR SONRAKİ SAYFA.
 *  3. Sayfa eksik döndü (kaynakta daha fazlası yok) → BAŞA DÖN ve bitti işaretle.
 *     Başa dönmek bilinçli: aynı terimde ileride YENİ kararlar yayımlanır.
 *
 * `bitti` yarım sayfada ASLA işaretlenmez; yoksa terim tarandı sayılıp
 * sıradan düşer ve atlanan kararlar kalıcı olarak kaybolurdu.
 */
export function sonrakiSayfa(g: SayfaGirdi): SayfaKarari {
  if (g.yarimKaldi) {
    return { sonrakiSayfa: g.sayfa, bitti: false };
  }
  const sonSayfa = g.satir < g.sayfaBoyu;
  if (sonSayfa) return { sonrakiSayfa: 1, bitti: true };

  // TAVANA GELDİYSE: BAŞA DÖN **VE** BİTTİ İŞARETLE.
  //
  // ── BU SATIR 15.09.2026 AKŞAMI DEĞİŞTİ. ÖNCEKİ HÂLİ SONSUZ DÖNGÜYDÜ. ──
  //
  // Önce `{ sonrakiSayfa: 1, bitti: false }` dönüyordu ve gerekçesi şuydu:
  // "tavanda bitti demek, taranmamış yüzbinlerce kararı tarandı saymaktır."
  // Gerekçe doğruydu, SONUCU yanlıştı: imleç 1'e düşüp `done` false kalınca
  // terim SONSUZA KADAR AYNI İLK 50 SAYFAYI yürüyor. Yeni hiçbir şey
  // getirmeyen, ama her turda HTTP isteği ve veritabanı yazması üreten bir
  // döngü. "Bir daha hiç bakılmaz" korkusundan kaçarken "hep aynı yere
  // bakılır" durumuna düşülmüştü.
  //
  // CANLIDA ÖLÇÜLDÜ (15.09.2026 19:16): dört terim tavanın çok ötesindeydi —
  // `işçilik alacakları davası` 535. sayfada (total 539.785),
  // `yargitay:işçilik alacakları davası` 332. sayfada (total 1.218.395).
  // Bu terimler 20'şerlik sayfalarla ASLA bitmez: 1,2 milyon sonuç 60.000
  // sayfa demek. Onları "bitmemiş" tutmak kapsamı düzeltmiyor, yalnız
  // bütçeyi yiyor.
  //
  // YENİ ANLAM: `bitti` artık "bu terimden alacağımızı aldık" demek —
  // ya kaynak tükendi ya da KENDİ derinlik sınırımıza vardık. İkisi de
  // "şimdilik sırayı bırak" sonucunu verir ve fark, terimin nerede
  // durduğunda değil, ne zaman geri döneceğinde.
  //
  // TARANMAMIŞ KARARLAR KAYBOLMUYOR: seçici RPC (migration 0141) bitmiş bir
  // terimi 7 gün sonra yeniden uygun sayıyor ve imleç 1'de olduğu için
  // terim EN YENİ kararlardan başlıyor. Yani derin sayfalar yerine yeni
  // kararlar yakalanıyor — 1,2 milyonluk bir terimde zaten istediğimiz bu.
  if (g.enFazlaSayfa && g.sayfa >= g.enFazlaSayfa) {
    return { sonrakiSayfa: 1, bitti: true };
  }
  return { sonrakiSayfa: g.sayfa + 1, bitti: false };
}
