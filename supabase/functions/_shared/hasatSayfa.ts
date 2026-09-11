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
  return {
    sonrakiSayfa: sonSayfa ? 1 : g.sayfa + 1,
    bitti: sonSayfa,
  };
}
