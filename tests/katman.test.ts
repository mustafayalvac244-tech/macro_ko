import { describe, expect, it } from 'vitest';
import { overLimit, tierConfig } from '../supabase/functions/_shared/katman';

/**
 * Bu tablonun iki kopyası vardı ve birbirinden ayrılmıştı: ai-chat'te ücretli
 * katman Claude'a taşınmışken ictihat hâlâ Gemini'ye yolluyordu. Aynı üye,
 * hangi ekranı açtığına göre başka modelle konuşuyordu. Tek kaynak artık
 * burası; sınanmadığı sürece aynı sessiz ayrışma tekrar olur.
 */
const secenek = {
  groqModel: 'openai/gpt-oss-120b',
  claudeModel: 'claude-sonnet-5',
  claudeAnahtariVar: true,
};

describe('tierConfig', () => {
  it('taban katmanlar Groq', () => {
    for (const t of ['free', 'baslangic']) {
      expect(tierConfig(t, false, secenek).cfg.provider, t).toBe('groq');
    }
  });

  it('ücretli katmanların hepsi aynı modelde — para modeli değil kullanımı artırır', () => {
    // "Daha çok para, daha iyi model" demek, ucuz katmandaki avukata bilerek
    // kötü cevap vermek olurdu.
    for (const t of ['pro', 'elit', 'ai']) {
      const { cfg } = tierConfig(t, false, secenek);
      expect(cfg.provider, t).toBe('claude');
      expect(cfg.model, t).toBe('claude-sonnet-5');
      expect(cfg.billable, t).toBe(true);
    }
  });

  it('hiçbir katmanın birincil sağlayıcısı Gemini değildir (yalnız yedek)', () => {
    for (const t of ['free', 'baslangic', 'pro', 'elit', 'ai', 'bilinmeyen']) {
      expect(tierConfig(t, false, secenek).cfg.provider, t).not.toBe('gemini');
    }
  });

  it('Claude anahtarı yoksa ücretli katman ücretsiz hatta düşer', () => {
    // Ödeyen üye boş ekran görmesin; anahtar eklenince deploy gerekmeden döner.
    const { cfg } = tierConfig('ai', false, { ...secenek, claudeAnahtariVar: false });
    expect(cfg.provider).toBe('groq');
    expect(cfg.billable).toBe(false);
  });

  it('ücretsiz katmanda günlük hak vardır, ücretlide yoktur', () => {
    // Ücretsiz sağlayıcının günlük tavanı TÜM kullanıcılar için ortak; ücretli
    // katmanda sınır zaten kontördür.
    expect(tierConfig('baslangic', false, secenek).cfg.gunluk).toBeGreaterThan(0);
    expect(tierConfig('ai', false, secenek).cfg.gunluk ?? 0).toBe(0);
  });

  it('tanınmayan katman en dar hakka düşer', () => {
    expect(tierConfig('yok-boyle-bir-sey', false, secenek).cfg).toEqual(tierConfig('free', false, secenek).cfg);
  });

  it('ölçüm zorlaması sağlayıcıyı ve modeli geçersiz kılar', () => {
    const { cfg } = tierConfig('baslangic', false, { ...secenek, zorlaSaglayici: 'openai', zorlaModel: 'gpt-5-mini' });
    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('gpt-5-mini');
    // Zorlanan model ücretliyse maliyet sayılmalı: ölçüm yaparken faturayı
    // gözden kaçırmak kolaydır.
    expect(cfg.billable).toBe(true);
  });
});

describe('overLimit', () => {
  it('TL tavanı olan katmanda maliyete bakar', () => {
    expect(overLimit({ ...tierConfig('ai', false, secenek).cfg }, { calls: 99999, cost: 0 })).toBe(false);
    expect(overLimit({ ...tierConfig('ai', false, secenek).cfg }, { calls: 0, cost: 999999 })).toBe(true);
  });

  it('çağrı tavanı olan katmanda sayıya bakar', () => {
    const cfg = tierConfig('free', false, secenek).cfg;
    expect(overLimit(cfg, { calls: cfg.limit, cost: 0 })).toBe(true);
    expect(overLimit(cfg, { calls: cfg.limit - 1, cost: 999 })).toBe(false);
  });
});
