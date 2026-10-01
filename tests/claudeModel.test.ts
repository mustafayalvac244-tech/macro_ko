// Uyarlamalı düşünme yalnız destekleyen modele gönderilir (bkz. _shared/claudeModel.ts).
// 01.10.2026'da canlıda ölçüldü: Haiku 4.5'e gönderilince 400 "adaptive thinking
// is not supported on this model" — ücretsiz deneme soruları hiç Claude'a ulaşmıyordu.
import { describe, expect, it } from 'vitest';
import { uyarlamaliDusunmeVar } from '../supabase/functions/_shared/claudeModel';
import { AI_TASMA_MODEL } from '../supabase/functions/_shared/katman';

describe('uyarlamaliDusunmeVar', () => {
  it.each([
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-1-20250805',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-7-sonnet-20250219',
  ])('%s → yok', (m) => expect(uyarlamaliDusunmeVar(m)).toBe(false));

  it.each(['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-sonnet-5', 'claude-opus-5-5'])(
    '%s → var',
    (m) => expect(uyarlamaliDusunmeVar(m)).toBe(true)
  );

  it('ücretsiz denemenin modeli (AI_TASMA_MODEL) uyarlamalı düşünme almaz', () => {
    expect(uyarlamaliDusunmeVar(AI_TASMA_MODEL)).toBe(false);
  });
});
