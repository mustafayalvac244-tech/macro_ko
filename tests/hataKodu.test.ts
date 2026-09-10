import { describe, expect, it } from 'vitest';
import { dosyaBuyukCoz, dosyaBuyukKodu, sunucuDosyaBuyukMu } from '@/utils/hataKodu';
import { planLimitiCoz, UCRETSIZ_LIMIT } from '@/config/planlar';

/**
 * KULLANICIYA HANGİ CÜMLENİN GÖSTERİLECEĞİNE BU AYRIŞTIRICILAR KARAR VERİYOR.
 *
 * İkisi de "bu bir arıza değil, kuraldır" ayrımını yapıyor: plan limiti dolduysa
 * ya da dosya kovanın sınırını aşıyorsa, "tekrar deneyin" demek yanlıştır —
 * tekrar denemek hiçbir zaman işe yaramaz. Ayrıştırma sessizce bozulursa
 * kullanıcı yanlış cümleyi görür ve HİÇBİR hata çıkmaz; bu yüzden davranış
 * teste bağlandı. (saveError'ın kendisi react-native'e bağlı olduğu için test
 * edilemiyor; ayrıştırıcılar bu yüzden saf modüllerde duruyor.)
 */

describe('dosyaBuyukCoz — üreten ve çözen taraf birbirini tutar', () => {
  it('kendi ürettiği kodu çözer (turlama)', () => {
    expect(dosyaBuyukCoz(dosyaBuyukKodu(25))).toEqual({ mb: 25 });
    expect(dosyaBuyukCoz(dosyaBuyukKodu(100))).toEqual({ mb: 100 });
  });

  it('sınır rakamını mesajın içinden okur — sabit varsaymaz', () => {
    // Kovadaki sınır değişirse kullanıcıya gösterilen sayı da değişmeli.
    expect(dosyaBuyukCoz('dosya_buyuk:50')?.mb).toBe(50);
  });

  it('Error nesnesinin mesajı içinde gömülü olsa da bulur', () => {
    expect(dosyaBuyukCoz(new Error(dosyaBuyukKodu(25)).message)).toEqual({ mb: 25 });
  });

  it('ilgisiz hatalarda null döner', () => {
    expect(dosyaBuyukCoz('network request failed')).toBeNull();
    expect(dosyaBuyukCoz('plan_limiti:belge:5')).toBeNull();
    expect(dosyaBuyukCoz(undefined)).toBeNull();
    expect(dosyaBuyukCoz(null)).toBeNull();
    expect(dosyaBuyukCoz('')).toBeNull();
  });

  it('bozuk/anlamsız sayıda null döner (0 MB diye bir sınır göstermez)', () => {
    expect(dosyaBuyukCoz('dosya_buyuk:0')).toBeNull();
    expect(dosyaBuyukCoz('dosya_buyuk:abc')).toBeNull();
  });
});

describe('sunucuDosyaBuyukMu — sunucunun kendi yanıtları', () => {
  it('bilinen sunucu metinlerini tanır (büyük/küçük harf farketmez)', () => {
    expect(sunucuDosyaBuyukMu('Payload too large')).toBe(true);
    expect(sunucuDosyaBuyukMu('The object exceeded the maximum allowed size')).toBe(true);
  });

  it('başka hataları dosya boyutu sanmaz', () => {
    expect(sunucuDosyaBuyukMu('new row violates row-level security policy')).toBe(false);
    expect(sunucuDosyaBuyukMu(undefined)).toBe(false);
  });
});

describe('planLimitiCoz — plan sınırı mesajı', () => {
  it('tetikleyicinin ürettiği mesajı çözer', () => {
    expect(planLimitiCoz('plan_limiti:dava:5')).toEqual({ tur: 'dava', limit: 5 });
    expect(planLimitiCoz('plan_limiti:finans:0')).toEqual({ tur: 'finans', limit: 0 });
  });

  it('Postgres mesajının içine gömülü hâlde de bulur', () => {
    // Gerçek hata metni yalnız kodu içermez; çevresinde başka şeyler olur.
    expect(planLimitiCoz('new row violates check: plan_limiti:belge:5')).toEqual({ tur: 'belge', limit: 5 });
  });

  it('tanımadığı türü kabul etmez (uydurma bir ekran metni üretmesin)', () => {
    expect(planLimitiCoz('plan_limiti:sarki:3')).toBeNull();
  });

  it('ilgisiz hatalarda null döner', () => {
    expect(planLimitiCoz('network request failed')).toBeNull();
    expect(planLimitiCoz(dosyaBuyukKodu(25))).toBeNull();
    expect(planLimitiCoz(undefined)).toBeNull();
  });

  it('çözülen her tür UCRETSIZ_LIMIT içinde tanımlı olmalı', () => {
    for (const tur of Object.keys(UCRETSIZ_LIMIT)) {
      expect(planLimitiCoz(`plan_limiti:${tur}:1`)?.tur).toBe(tur);
    }
  });
});
