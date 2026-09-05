import { describe, expect, it } from 'vitest';
import { aiHataMetni } from '../src/lib/aiHata';

/**
 * Kota mesajı, kullanıcının o gün ürünü kullanıp kullanamayacağını belirliyor.
 * Ücretsiz sağlayıcının kotası KAYAN pencereyle yenileniyor ("try again in
 * 22m36s") ama mesajımız "yarın tekrar deneyin" diyordu: avukatı 23 dakika
 * beklemesi gerekirken ertesi güne yolluyorduk.
 */
const t = ((anahtar: string, p?: Record<string, string | number>) =>
  p ? `${anahtar}:${JSON.stringify(p)}` : anahtar) as unknown as Parameters<typeof aiHataMetni>[1];

describe('aiHataMetni', () => {
  it('kısa bekleme varsa dakikayı söyler', () => {
    expect(aiHataMetni({ error: 'daily_quota', yeniden: 1356 }, t)).toBe('ai.errQuotaWait:{"dk":"23"}');
  });

  it('bekleme yoksa günlük kota mesajına düşer', () => {
    expect(aiHataMetni({ error: 'daily_quota' }, t)).toBe('ai.errDailyQuota');
  });

  it('çok uzun beklemede dakika saymaz', () => {
    // "9 saat sonra" demek, o gün için kapalı demektir; dakika saymak yardımcı olmaz.
    expect(aiHataMetni({ error: 'daily_quota', yeniden: 9 * 3600 }, t)).toBe('ai.errDailyQuota');
  });

  it('bir dakikadan kısa beklemeyi sıfır dakika göstermez', () => {
    expect(aiHataMetni({ error: 'rate_limit', yeniden: 20 }, t)).toBe('ai.errQuotaWait:{"dk":"1"}');
  });

  it('aylık tavan aşımını kota mesajıyla karıştırmaz', () => {
    expect(aiHataMetni({ error: 'quota_exceeded' }, t)).toBe('ai.errQuota');
  });

  it('kontör bitmesini kotayla karıştırmaz', () => {
    // Kontör beklemekle gelmez, yükleme gerektirir; "biraz sonra tekrar
    // deneyin" demek kullanıcıyı boşuna bekletirdi.
    expect(aiHataMetni({ error: 'kontor_bitti' }, t)).toBe('ai.errKontor');
    expect(aiHataMetni({ error: 'kontor_bitti', yeniden: 600 }, t)).toBe('ai.errKontor');
  });

  it('bizim günlük hakkımızı sağlayıcı kotasıyla karıştırmaz', () => {
    // Sağlayıcı kotası dakikalar içinde açılabilir; günlük adil kullanım hakkı
    // gece yarısı yenilenir. Aynı mesaj, kullanıcıyı yanlış beklentiye sokardı.
    expect(aiHataMetni({ error: 'gunluk_hak_bitti' }, t)).toBe('ai.errDailyCap');
  });

  it('bilinmeyen kodda genel hata verir', () => {
    expect(aiHataMetni({ error: 'upstream' }, t)).toBe('ai.errGeneric');
    expect(aiHataMetni({}, t)).toBe('ai.errGeneric');
  });
});
