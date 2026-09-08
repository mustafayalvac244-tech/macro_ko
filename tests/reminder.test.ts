import { describe, expect, it } from 'vitest';
import { normalizePhoneForWa } from '../src/utils/telefon';

/**
 * Müvekkile hatırlatma — telefon numarası normalleştirme.
 *
 * Bu dosyanın hiç testi yoktu. Yanlış normalleştirilen bir numara, hatırlatmanın
 * YANLIŞ KİŞİYE gitmesi ya da hiç gitmemesi demektir; ikisi de bir duruşma
 * hatırlatmasında ağır sonuç doğurur.
 *
 * Not: sendClientReminder burada test EDİLMİYOR — react-native'in Linking
 * modülüne bağlı ve bu test koşucusunda o modül yok. Test edilen, saf olan ve
 * hatanın gerçekten oluştuğu kısım.
 */
describe('normalizePhoneForWa', () => {
  it('yerel biçimi (0 ile) ülke koduna çevirir', () => {
    expect(normalizePhoneForWa('0532 123 45 67')).toBe('905321234567');
  });

  it('+90 ile yazılmışı olduğu gibi bırakır', () => {
    expect(normalizePhoneForWa('+90 532 123 4567')).toBe('905321234567');
  });

  it('sıfırsız 10 haneyi ülke koduyla tamamlar', () => {
    expect(normalizePhoneForWa('532 123 4567')).toBe('905321234567');
  });

  it('uluslararası "00" önekini doğru ayıklar', () => {
    // Düzeltilen kusur: eskiden yalnız TEK sıfır atılıyor ve geriye
    // "0905321234567" kalıyordu — numara WhatsApp'a hatalı gidiyordu.
    expect(normalizePhoneForWa('0090 532 123 45 67')).toBe('905321234567');
    expect(normalizePhoneForWa('00905321234567')).toBe('905321234567');
  });

  it('parantez, tire ve boşlukları temizler', () => {
    expect(normalizePhoneForWa('(0532) 123-45-67')).toBe('905321234567');
  });

  it('boş girdide boş döner', () => {
    expect(normalizePhoneForWa('')).toBe('');
    expect(normalizePhoneForWa('   ')).toBe('');
    expect(normalizePhoneForWa('abc')).toBe('');
  });

  it('tanımadığı yabancı numarayı bozmadan bırakır', () => {
    // 10 hane değil ve TR öneki yok: uydurmak yerine olduğu gibi bırakılır.
    expect(normalizePhoneForWa('+1 415 555 2671')).toBe('14155552671');
  });
});
