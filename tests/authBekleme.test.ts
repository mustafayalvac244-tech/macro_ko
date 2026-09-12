import { describe, expect, it } from 'vitest';
import { beklemeSaniyesi } from '../src/lib/authBekleme';

/**
 * Bu işlev, kullanıcının "güvenlik nedeniyle bekle diyor ama ne kadar
 * bekleyeceğimi söylemiyor" şikâyetini çözmek için var. Testlerin çoğu,
 * yanlış bir sayı üretip ekranda BİTMEYEN bir geri sayım bırakmamayı
 * kontrol ediyor: hiç geri sayım olmaması, yanlış geri sayımdan iyidir.
 */
describe('beklemeSaniyesi', () => {
  it('Supabase mesajından saniyeyi okur', () => {
    expect(
      beklemeSaniyesi('For security purposes, you can only request this after 17 seconds.')
    ).toBe(17);
  });

  it('tekil "second" yazılışını da okur', () => {
    expect(beklemeSaniyesi('you can only request this after 1 second')).toBe(1);
  });

  it('büyük/küçük harfe takılmaz', () => {
    expect(beklemeSaniyesi('You Can Only Request This After 42 Seconds')).toBe(42);
  });

  it('alakasız hata mesajında null döner', () => {
    expect(beklemeSaniyesi('Invalid login credentials')).toBeNull();
  });

  it('boş/tanımsız girdi null döner', () => {
    expect(beklemeSaniyesi('')).toBeNull();
    expect(beklemeSaniyesi(null)).toBeNull();
    expect(beklemeSaniyesi(undefined)).toBeNull();
  });

  it('sıfır saniyeyi geri sayıma koymaz', () => {
    // 0 saniyelik geri sayım düğmeyi bir kare kapatıp açar; gürültüdür.
    expect(beklemeSaniyesi('you can only request this after 0 seconds')).toBeNull();
  });

  it('makul olmayan uzun süreyi reddeder', () => {
    // 10 dakikadan uzun bir geri sayım ekranda kilitli bir düğme bırakır;
    // kullanıcı uygulamayı kapatır ve bir daha denemez.
    expect(beklemeSaniyesi('you can only request this after 99999 seconds')).toBeNull();
  });
});
