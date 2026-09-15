import { describe, expect, it } from 'vitest';
import { sonrakiSayfa } from '../supabase/functions/_shared/hasatSayfa';

/**
 * HASAT SAYFA İMLECİ.
 *
 * BULUNAN KAYIP (2026-09-11): harvest-tick sayfa başına 20 sonuç çekiyor ama
 * en çok 10 YENİ kayıt alıp döngüyü kırıyordu; ardından sayfayı KOŞULSUZ
 * ilerletiyordu. Bir sayfada 20 yeni karar varsa 10'u alınıp kalan 10'u bir
 * daha hiç görülmüyordu — sayfa başına %50'ye varan KALICI kayıp.
 *
 * Ölçüm doğruladı: 404 terimin tamamı 2-5. sayfada ve hiçbiri bitmemişti,
 * yani "başa dönünce telafi olur" diye bir yol fiilen işlemiyordu.
 *
 * EN KRİTİK DAVRANIŞ: kotaya takılınca sayfa İLERLEMEMELİ ve terim BİTTİ
 * sayılmamalı. İkisinden biri bozulursa kayıp sessizce geri gelir.
 */
describe('sonrakiSayfa', () => {
  const BOY = 20;

  it('kotaya takılınca AYNI SAYFADA kalır — atlanan kayıtlar kaybolmasın', () => {
    const k = sonrakiSayfa({ sayfa: 3, satir: BOY, sayfaBoyu: BOY, yarimKaldi: true });
    expect(k.sonrakiSayfa).toBe(3);
  });

  it('kotaya takılınca terimi BİTTİ saymaz — yoksa sıradan düşerdi', () => {
    const k = sonrakiSayfa({ sayfa: 3, satir: BOY, sayfaBoyu: BOY, yarimKaldi: true });
    expect(k.bitti).toBe(false);
  });

  it('sayfa eksik dönse bile kotaya takıldıysak yine aynı sayfada kalır', () => {
    // Kaynak 12 satır döndü ve biz 10'unu alıp takıldık: kalan 2 hâlâ alınmalı.
    // Eski kod burada hem sayfayı 1'e atar hem terimi bitmiş sayardı.
    const k = sonrakiSayfa({ sayfa: 7, satir: 12, sayfaBoyu: BOY, yarimKaldi: true });
    expect(k).toEqual({ sonrakiSayfa: 7, bitti: false });
  });

  it('sayfa tam dolu ve bitirildiyse bir sonraki sayfaya geçer', () => {
    const k = sonrakiSayfa({ sayfa: 3, satir: BOY, sayfaBoyu: BOY, yarimKaldi: false });
    expect(k).toEqual({ sonrakiSayfa: 4, bitti: false });
  });

  it('sayfa eksik döndüyse başa döner ve bitti işaretlenir', () => {
    // Başa dönmek bilinçli: aynı terimde ileride YENİ kararlar yayımlanır.
    const k = sonrakiSayfa({ sayfa: 9, satir: 4, sayfaBoyu: BOY, yarimKaldi: false });
    expect(k).toEqual({ sonrakiSayfa: 1, bitti: true });
  });

  it('boş sayfa da bitmiş sayılır', () => {
    const k = sonrakiSayfa({ sayfa: 9, satir: 0, sayfaBoyu: BOY, yarimKaldi: false });
    expect(k).toEqual({ sonrakiSayfa: 1, bitti: true });
  });

  it('yakınsar: kotaya takılan sayfa sonunda ilerler, sonsuz döngü olmaz', () => {
    // 1. tur: 20 yeni var, 10 alındı, takıldık → sayfa 5'te kal
    let k = sonrakiSayfa({ sayfa: 5, satir: BOY, sayfaBoyu: BOY, yarimKaldi: true });
    expect(k.sonrakiSayfa).toBe(5);
    // 2. tur: kalan 10 alındı, yine takıldık → hâlâ 5
    k = sonrakiSayfa({ sayfa: 5, satir: BOY, sayfaBoyu: BOY, yarimKaldi: true });
    expect(k.sonrakiSayfa).toBe(5);
    // 3. tur: sayfada yeni kalmadı, kotaya takılmadık → ilerler
    k = sonrakiSayfa({ sayfa: 5, satir: BOY, sayfaBoyu: BOY, yarimKaldi: false });
    expect(k.sonrakiSayfa).toBe(6);
  });
});

/**
 * SAYFA TAVANI — 15.09.2026'da ÖLÇÜLEN arızanın testi.
 *
 * Canlıda: 970 terimin SIFIRI bitmiş, iki terim 78. ve 534. sayfada, kaynağın
 * bildirdiği toplam sonuç 539.776. Sayfa yalnız EKSİK döndüğünde bitmiş
 * sayıldığı için böyle bir terim pratikte hiç sıradan düşmüyor ve havuz
 * birkaç terimin konusuyla doluyordu (322 terim hiç çalışmamıştı).
 */
describe('sayfa tavanı', () => {
  const tam = { satir: 20, sayfaBoyu: 20, yarimKaldi: false };

  it('tavan yoksa eskisi gibi ilerler', () => {
    expect(sonrakiSayfa({ ...tam, sayfa: 900 })).toEqual({ sonrakiSayfa: 901, bitti: false });
  });

  it('tavanın altında normal ilerler', () => {
    expect(sonrakiSayfa({ ...tam, sayfa: 4, enFazlaSayfa: 50 })).toEqual({ sonrakiSayfa: 5, bitti: false });
  });

  it('tavana gelince BAŞA döner', () => {
    expect(sonrakiSayfa({ ...tam, sayfa: 50, enFazlaSayfa: 50 })).toEqual({ sonrakiSayfa: 1, bitti: false });
  });

  it('tavanda BİTTİ İŞARETLEMEZ — taranmamışı taranmış saymak olurdu', () => {
    // `bitti` "kaynakta başka karar yok" demek. Tavan bizim sıra kuralımız;
    // ikisini karıştırmak yüzbinlerce kararı kalıcı olarak gözden düşürür.
    expect(sonrakiSayfa({ ...tam, sayfa: 50, enFazlaSayfa: 50 }).bitti).toBe(false);
    expect(sonrakiSayfa({ ...tam, sayfa: 99, enFazlaSayfa: 50 }).bitti).toBe(false);
  });

  it('gerçekten biten terim tavandan ETKİLENMEZ', () => {
    // Sayfa eksik döndü = kaynakta daha fazlası yok. Bu hâlâ bitti.
    expect(sonrakiSayfa({ satir: 3, sayfaBoyu: 20, yarimKaldi: false, sayfa: 7, enFazlaSayfa: 50 }))
      .toEqual({ sonrakiSayfa: 1, bitti: true });
  });

  it('kota yarım bıraktıysa tavan devreye girmez', () => {
    // Yarım sayfa aynı sayfada kalmalı; tavan onu başa atarsa kalan kayıtlar kaybolur.
    expect(sonrakiSayfa({ ...tam, sayfa: 50, enFazlaSayfa: 50, yarimKaldi: true }))
      .toEqual({ sonrakiSayfa: 50, bitti: false });
  });
});
