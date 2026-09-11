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
