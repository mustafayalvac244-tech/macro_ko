import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * TAKVİM — GÜNDEM UFKU, HAFTA BAŞI, GÜN KAYMASI (09.10.2026 denetimi).
 *
 * Türkiye saatinde koşar: makine UTC'de; TZ verilmezse gün kayması görünmez.
 */
const ESKI_TZ = process.env.TZ;
process.env.TZ = 'Europe/Istanbul';
afterAll(() => {
  if (ESKI_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ESKI_TZ;
});

const { gundemGruplari, gundemUfku, GUNDEM_UFKU_GUN, HAFTA_BASLANGICI } = await import('@/utils/gundem');
const { yerelGunISO } = await import('@/lib/yerelGun');

const KOK = join(__dirname, '..');
const kayit = (dateKey: string, done = false) => ({ dateKey, done });

describe('Gündem ufku (90 gün) kullanıcıya söylenir', () => {
  // Bulgu: Gündem yalnız 90 gün gösteriyordu ve bunu hiçbir yerde söylemiyordu.
  // 91. gündeki duruşma listede yoktu; 90 gün içinde kayıt yoksa ekran
  // "Önümüzdeki günlerde planlı işlem yok" diyordu.
  const bugun = '2026-10-09';

  it('ufuk 90 gün: 09.10.2026 → 07.01.2027 (yerel gün)', () => {
    expect(GUNDEM_UFKU_GUN).toBe(90);
    expect(gundemUfku(bugun)).toBe('2027-01-07');
  });

  it('ufuk sonrasındaki açık kayıtlar sayılır (gizlenmez)', () => {
    const r = gundemGruplari(
      [
        kayit('2026-10-19'),
        kayit('2027-01-06'),
        kayit('2027-01-07'),
        kayit('2027-01-08'),
        kayit('2027-04-27'),
        kayit('2027-05-01', true), // tamamlanmış: sayılmaz
      ],
      bugun,
      gundemUfku(bugun),
    );
    expect(r.gruplar.map((g) => g.dateKey)).toEqual(['2026-10-19', '2027-01-06', '2027-01-07']);
    expect(r.ufukSonrasi).toBe(2);
  });

  it('90 gün içinde kayıt yokken bile ileri tarihli kayıt sayılır', () => {
    const r = gundemGruplari([kayit('2027-02-15')], bugun, gundemUfku(bugun));
    expect(r.gruplar).toEqual([]);
    expect(r.ufukSonrasi).toBe(1);
  });

  it('"Tümünü göster" (ufuk yok): hepsi listelenir, geçmiş ve tamamlanan yine yok', () => {
    const r = gundemGruplari(
      [kayit('2026-10-08'), kayit('2026-10-09'), kayit('2027-04-27'), kayit('2027-04-27'), kayit('2027-05-01', true)],
      bugun,
      null,
    );
    expect(r.gruplar.map((g) => [g.dateKey, g.items.length])).toEqual([
      ['2026-10-09', 1],
      ['2027-04-27', 2],
    ]);
    expect(r.ufukSonrasi).toBe(0);
  });
});

describe('Hafta pazartesi başlar (ay görünümü ve hafta şeridi aynı)', () => {
  // Bulgu: hafta şeridi pazartesiden (weekStartsOn: 1), ay görünümü
  // react-native-calendars varsayılanıyla PAZAR'dan başlıyordu.
  const kaynak = readFileSync(join(KOK, 'app/(app)/calendar.tsx'), 'utf8');

  it('sabit pazartesi (1)', () => {
    expect(HAFTA_BASLANGICI).toBe(1);
  });

  it('ay takvimi firstDay, hafta şeridi weekStartsOn ile aynı sabiti kullanır', () => {
    expect(kaynak).toMatch(/firstDay=\{HAFTA_BASLANGICI\}/);
    expect(kaynak).toMatch(/weekStartsOn:\s*HAFTA_BASLANGICI/);
  });
});

describe('Gün kayması (toISOString) — dava ekranında 08.10’da düzeltildi', () => {
  // Denetçinin gösterdiği satırlar (135, 445, 693, 766) dava ekranındaydı:
  // `toISOString().slice(0, 10)` Türkiye'de 00:00–03:00 arası bir önceki günü
  // yazıyordu. 9e71173 ile yerelGunISO'ya geçildi; bu test onu sabitler.
  it('gece 01:30’da UTC günü bir gün geride, yerel gün doğru', () => {
    const d = new Date(2026, 9, 9, 1, 30);
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-08');
    expect(yerelGunISO(d)).toBe('2026-10-09');
  });

  it.each(['app/(app)/cases/[id].tsx', 'app/(app)/calendar.tsx'])('%s gün anahtarını UTC’den kesmiyor', (yol) => {
    expect(readFileSync(join(KOK, yol), 'utf8')).not.toMatch(/toISOString\(\)\.(slice|substring)\(0,\s*10\)|toISOString\(\)\.split\('T'\)/);
  });
});
