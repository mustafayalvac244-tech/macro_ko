// Yönetici ekranındaki "ücretsiz hakkı bitiren" eşiği — 03.10.2026.
// 0159 bu eşiği 5 diye SABİT yazmıştı; deneme 10'a çıkınca kart yanlış
// saymaya başlayacaktı. En son admin_deneme_takibi tanımı sunucudaki
// UCRETSIZ_DENEME_LIMIT ile aynı eşiği kullanmalı.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UCRETSIZ_DENEME_LIMIT } from '../supabase/functions/_shared/katman';

const DIZIN = join(__dirname, '..', 'supabase', 'migrations');

describe('admin_deneme_takibi eşiği', () => {
  it('en son tanım ücretsiz deneme sınırıyla aynı ve yönetici/demo kaydını satış saymıyor', () => {
    const son = readdirSync(DIZIN)
      .filter((d) => d.endsWith('.sql'))
      .sort()
      .filter((d) => readFileSync(join(DIZIN, d), 'utf8').includes('function public.admin_deneme_takibi'))
      .pop()!;
    const sql = readFileSync(join(DIZIN, son), 'utf8');
    expect(sql).toContain(`kullanilan >= ${UCRETSIZ_DENEME_LIMIT})`);
    expect(sql).toMatch(/not coalesce\(p\.is_admin, false\)[\s\S]*revenuecat_event_id is not null/);
  });
});
