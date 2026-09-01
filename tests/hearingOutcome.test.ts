import { describe, expect, it } from 'vitest';
import {
  OUTCOMES,
  needsServiceWatch,
  pendingOutcomeHearings,
  planDeadline,
} from '@/utils/hearingOutcome';

const d = (iso: string) => new Date(`${iso}T00:00:00`);
const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('planDeadline — tebliğden işleyen süreler (HMK 345)', () => {
  /**
   * EN KRİTİK KURAL: istinaf süresi kararın TEBLİĞİNDEN işler, duruşma/karar
   * tarihinden değil. Tebligat tarihi yoksa süre hesaplanmamalı — hesaplansaydı
   * avukat yanlış bir son güne güvenir ve kanun yolu hakkı düşerdi.
   */
  it('karar açıklandı + tebligat YOKSA süre üretmez', () => {
    expect(planDeadline('karar_aciklandi', d('2026-03-10'))).toBeNull();
    expect(planDeadline('karar_aciklandi', d('2026-03-10'), null)).toBeNull();
  });

  it('karar açıklandı + tebligat VARSA süre tebligattan işler', () => {
    const p = planDeadline('karar_aciklandi', d('2026-03-10'), d('2026-04-01'));
    expect(p).not.toBeNull();
    expect(ymd(p!.dueAt)).toBe('2026-04-15'); // tebligat + 14 gün
    expect(p!.fromService).toBe(true);
    expect(p!.basis).toBe('HMK 345');
  });

  it('süre duruşma tarihinden DEĞİL tebligattan sayılır', () => {
    const p = planDeadline('karar_aciklandi', d('2026-03-10'), d('2026-04-01'));
    expect(ymd(p!.dueAt)).not.toBe('2026-03-24'); // duruşma + 14 olsaydı
  });
});

describe('planDeadline — duruşmadan işleyen süreler', () => {
  it('hâkimin verdiği süre duruşma tarihinden işler (HMK 94)', () => {
    const p = planDeadline('sure_verildi', d('2026-03-10'));
    expect(ymd(p!.dueAt)).toBe('2026-03-24');
    expect(p!.fromService).toBe(false);
    expect(p!.basis).toBe('HMK 94');
  });

  it('bilirkişi raporuna itiraz 2 haftadır (HMK 281)', () => {
    const p = planDeadline('bilirkisi_itiraz', d('2026-03-10'));
    expect(ymd(p!.dueAt)).toBe('2026-03-24');
    expect(p!.basis).toBe('HMK 281');
  });

  it('elle girilen süre varsayılanın yerine geçer', () => {
    const p = planDeadline('sure_verildi', d('2026-03-10'), null, 30);
    expect(ymd(p!.dueAt)).toBe('2026-04-09');
  });

  it('geçersiz elle süre (0/negatif) varsayılanı bozmaz', () => {
    expect(ymd(planDeadline('sure_verildi', d('2026-03-10'), null, 0)!.dueAt)).toBe('2026-03-24');
    expect(ymd(planDeadline('sure_verildi', d('2026-03-10'), null, -5)!.dueAt)).toBe('2026-03-24');
  });

  it('süre doğurmayan sonuçlar null döner', () => {
    expect(planDeadline('ertelendi', d('2026-03-10'))).toBeNull();
    expect(planDeadline('bilirkisi_bekleniyor', d('2026-03-10'))).toBeNull();
    expect(planDeadline('yapilamadi', d('2026-03-10'))).toBeNull();
  });
});

describe('needsServiceWatch', () => {
  it('tebliğden işleyen süre + tebligat yoksa takip gerekir', () => {
    expect(needsServiceWatch('karar_aciklandi')).toBe(true);
    expect(needsServiceWatch('karar_aciklandi', d('2026-04-01'))).toBe(false);
  });

  it('duruşmadan işleyen sürelerde takip gerekmez', () => {
    expect(needsServiceWatch('sure_verildi')).toBe(false);
    expect(needsServiceWatch('ertelendi')).toBe(false);
  });
});

describe('OUTCOMES tanımları', () => {
  it('yeni duruşma gerektiren sonuçlar süre üretmez', () => {
    for (const id of ['ertelendi', 'bilirkisi_bekleniyor', 'yapilamadi'] as const) {
      expect(OUTCOMES[id].needsNextHearing).toBe(true);
      expect(OUTCOMES[id].deadlineDays).toBeUndefined();
    }
  });

  it('süre üreten her sonucun kanuni dayanağı ve başlığı vardır', () => {
    for (const def of Object.values(OUTCOMES)) {
      if (def.deadlineDays) {
        expect(def.basis, `${def.id} dayanaksız`).toBeTruthy();
        expect(def.deadlineKey, `${def.id} başlıksız`).toBeTruthy();
      }
    }
  });
});

describe('pendingOutcomeHearings', () => {
  const now = d('2026-03-15');

  it('yalnız geçmiş ve tamamlanmamış duruşmaları döner', () => {
    const rows = [
      { scheduled_at: '2026-03-10T09:00:00', is_completed: false }, // geçmiş, açık
      { scheduled_at: '2026-03-12T09:00:00', is_completed: true }, // geçmiş, kapalı
      { scheduled_at: '2026-03-20T09:00:00', is_completed: false }, // gelecek
    ];
    const out = pendingOutcomeHearings(rows, now);
    expect(out).toHaveLength(1);
    expect(out[0]!.scheduled_at).toBe('2026-03-10T09:00:00');
  });

  it('en yeni duruşma başa gelir', () => {
    const rows = [
      { scheduled_at: '2026-03-01T09:00:00', is_completed: false },
      { scheduled_at: '2026-03-12T09:00:00', is_completed: false },
      { scheduled_at: '2026-03-05T09:00:00', is_completed: false },
    ];
    expect(pendingOutcomeHearings(rows, now).map((h) => h.scheduled_at)).toEqual([
      '2026-03-12T09:00:00',
      '2026-03-05T09:00:00',
      '2026-03-01T09:00:00',
    ]);
  });

  it('boş listede çökmez', () => {
    expect(pendingOutcomeHearings([], now)).toEqual([]);
  });
});
