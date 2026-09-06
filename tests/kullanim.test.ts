import { describe, expect, it } from 'vitest';
import { aiGun, aiPeriod } from '../supabase/functions/_shared/kullanim';

/**
 * Bu iki işlev iki uçta ayrı yazılmıştı ve tam da bu yüzden ictihat ucu günlük
 * sayacı hiç bilmiyordu: ai-chat'te günlük adil kullanım hakkı varken içtihat
 * ekranından yapılan AI çağrıları o haktan düşmüyordu. Kullanıcı, günlük hakkı
 * hiç azalmadan ortak Groq kotasını yakabiliyordu — sınır, sınırlaması gereken
 * şeyi sınırlamıyordu.
 */
describe('dönem anahtarları', () => {
  it('aylık anahtar UTC ayına göre ve iki haneli', () => {
    expect(aiPeriod(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01');
    expect(aiPeriod(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12');
  });

  it('günlük anahtar tarihi gün başına indirger', () => {
    expect(aiGun(new Date(Date.UTC(2026, 8, 6, 23, 59)))).toBe('2026-09-06');
  });

  it('aylık ve günlük anahtar birbirine karışmaz', () => {
    // İkisi AYNI tabloda tutuluyor; anahtarlar çakışsaydı günlük sayaç aylık
    // satırı ezerdi ve hak hesabı tamamen bozulurdu.
    const d = new Date(Date.UTC(2026, 8, 6));
    expect(aiGun(d)).not.toBe(aiPeriod(d));
    expect(aiGun(d).startsWith(aiPeriod(d))).toBe(true);
  });
});
