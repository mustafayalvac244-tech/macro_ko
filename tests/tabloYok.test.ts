import { describe, expect, it } from 'vitest';
import { tabloYokMu } from '../src/utils/tabloYok';

/**
 * "TABLO YOK" TEŞHİSİ — her hata "kurulum gerekli" sayılmasın (10.10.2026).
 *
 * Bulunan kusur: isMissingTimeTable / isMissingFinanceTable, hata MESAJINDA
 * tablo adı geçiyorsa "tablo kurulmamış" diyordu. Postgres kısıt ve RLS
 * hataları da tablo adını taşır ("new row for relation "time_entries"
 * violates check constraint …"): kayıt reddedildiğinde avukata "tablo henüz
 * kurulmamış" yazılıyordu. Reddedilen kayıt, yanlış teşhisle gizleniyordu.
 *
 * Mesajlar Postgres/PostgREST'in metin kalıplarıdır; tablo adı dışında
 * uydurma yok. BU SINAVI BEN YAZDIM.
 */
describe('tabloYokMu', () => {
  it('Postgres 42P01 (tablo yok) → true', () => {
    expect(tabloYokMu({ code: '42P01', message: 'relation "public.time_entries" does not exist' }, 'time_entries')).toBe(true);
  });

  it('PostgREST PGRST205 (şema önbelleğinde tablo yok) → true', () => {
    expect(
      tabloYokMu(
        { code: 'PGRST205', message: "Could not find the table 'public.finance_entries' in the schema cache" },
        'finance_entries',
      ),
    ).toBe(true);
  });

  it('kod gelmese de mesaj "yok" diyorsa → true', () => {
    expect(tabloYokMu({ message: 'relation "time_entries" does not exist' }, 'time_entries')).toBe(true);
  });

  it('CHECK kısıtı ihlali tablo adını taşısa da "tablo yok" DEĞİL', () => {
    expect(
      tabloYokMu(
        {
          code: '23514',
          message: 'new row for relation "time_entries" violates check constraint "time_entries_minutes_check"',
        },
        'time_entries',
      ),
    ).toBe(false);
    expect(
      tabloYokMu(
        {
          code: '23514',
          message: 'new row for relation "finance_entries" violates check constraint "finance_entries_vat_rate_check"',
        },
        'finance_entries',
      ),
    ).toBe(false);
  });

  it('RLS reddi tablo adını taşısa da "tablo yok" DEĞİL', () => {
    expect(
      tabloYokMu(
        { code: '42501', message: 'new row violates row-level security policy for table "time_entries"' },
        'time_entries',
      ),
    ).toBe(false);
  });

  it('BAŞKA tablonun yokluğu bu tabloyu "yok" göstermez', () => {
    expect(tabloYokMu({ code: '42P01', message: 'relation "public.cases" does not exist' }, 'time_entries')).toBe(false);
  });

  it('ağ hatası, boş ve tuhaf girdiler → false', () => {
    expect(tabloYokMu(new Error('Network request failed'), 'time_entries')).toBe(false);
    expect(tabloYokMu(null, 'time_entries')).toBe(false);
    expect(tabloYokMu(undefined, 'time_entries')).toBe(false);
    expect(tabloYokMu('time_entries does not exist', 'time_entries')).toBe(false);
    expect(tabloYokMu({ code: 42, message: 7 }, 'time_entries')).toBe(false);
  });
});
