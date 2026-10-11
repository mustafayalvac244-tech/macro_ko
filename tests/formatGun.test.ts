import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatDate, formatGun } from '@/utils/format';

/**
 * TAKVİM GÜNÜ (DATE sütunu) BİR GÜN ERKEN GÖRÜNÜYORDU — UTC'nin batısında.
 *
 * Yazma tarafı 08.10'da düzeldi (toISOString().slice(0,10) → yerelGunISO,
 * 9e71173). Okuma tarafında dava detayı açılış/kapanış, karar ve tebliğ
 * tarihlerini ve taksit vadesini `formatDate('2026-10-09')` ile yazıyordu.
 * JS tarih-yalnız metni UTC gece yarısı okur: Türkiye'de (UTC+3) aynı gün,
 * ama UTC'nin batısındaki bir cihazda (ör. New York) bir ÖNCEKİ gün.
 *
 * Ölçüldü (node, 09.10.2026): new Date('2026-10-09').getDate() →
 * Europe/Istanbul 9, UTC 9, America/New_York 8, America/Los_Angeles 8.
 */
const onceki = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  process.env.TZ = onceki;
});

describe('formatGun — takvim günü her saat diliminde aynı gün', () => {
  it('saat dilimi gerçekten UTC−: düz formatDate bir gün erken yazıyor (kusurun kendisi)', () => {
    expect(new Date('2026-10-09').getDate()).toBe(8);
    expect(formatDate('2026-10-09')).toBe('8 Eki 2026');
  });

  it('DATE sütunu yerel gün olarak yazılır', () => {
    expect(formatGun('2026-10-09')).toBe('9 Eki 2026');
    expect(formatGun('2026-01-01')).toBe('1 Oca 2026');
  });

  it('tarih-saat (timestamptz) değeri olduğu gibi formatDate yolundan geçer', () => {
    expect(formatGun('2026-10-09T15:00:00Z')).toBe(formatDate('2026-10-09T15:00:00Z'));
  });
});
