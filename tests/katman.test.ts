import { describe, expect, it } from 'vitest';
import { DENEME_SORU_LIMIT, overLimit, tierConfig } from '../supabase/functions/_shared/katman';

/**
 * Bu tablonun iki kopyası vardı ve birbirinden ayrılmıştı: ai-chat'te ücretli
 * katman Claude'a taşınmışken ictihat hâlâ Gemini'ye yolluyordu. Aynı üye,
 * hangi ekranı açtığına göre başka modelle konuşuyordu. Tek kaynak artık
 * burası; sınanmadığı sürece aynı sessiz ayrışma tekrar olur.
 */
const secenek = {
  groqModel: 'openai/gpt-oss-120b',
  // ÜCRETLİ MODEL TEK ALANDA. Eskiden `claudeModel` (yedek) ve
  // `claudeOpusModel` (asıl) diye iki alan vardı; hangisinin gerçekten
  // kullanıldığı kod okunmadan anlaşılmıyordu ve ictihat ucu bir dönem
  // ikincisini hiç almıyordu. 12.09.2026'da tek alana indirildi.
  claudeModel: 'claude-sonnet-5',
  claudeAnahtariVar: true,
};

describe('tierConfig', () => {
  it('taban katmanlar (free/baslangic) artık Groq değil, deneme hakkıyla ücretli modeli kullanır', () => {
    for (const t of ['free', 'baslangic']) {
      const { cfg } = tierConfig(t, false, secenek);
      expect(cfg.provider, t).toBe('claude');
      expect(cfg.model, t).toBe('claude-sonnet-5');
      expect(cfg.denemeLimit, t).toBe(DENEME_SORU_LIMIT);
    }
  });

  it('"ai" katmanı ücretli Claude modelini kullanır — tek ücretli katman', () => {
    const { cfg } = tierConfig('ai', false, secenek);
    expect(cfg.provider).toBe('claude');
    expect(cfg.model).toBe('claude-sonnet-5');
    expect(cfg.billable).toBe(true);
    expect(cfg.denemeLimit).toBeUndefined();
  });

  it('model DIŞARIDAN gelir — env değişince tier tablosu peşinden gelir', () => {
    // Opus'a dönmek tek env değişikliği olmalı (VEKIL_CLAUDE_MODEL); kod
    // içinde model adı sabitlenirse "dönüş" bir deploy'a bağlanır.
    const { cfg } = tierConfig('ai', false, { ...secenek, claudeModel: 'claude-opus-5' });
    expect(cfg.model).toBe('claude-opus-5');
  });

  it('hiçbir katmanın birincil sağlayıcısı Gemini ya da Groq değildir (yalnız yedek)', () => {
    for (const t of ['free', 'baslangic', 'ai', 'bilinmeyen']) {
      const { cfg } = tierConfig(t, false, secenek);
      expect(cfg.provider, t).not.toBe('gemini');
      expect(cfg.provider, t).not.toBe('groq');
    }
  });

  it('Claude anahtarı yoksa ücretli/deneme katmanı ücretsiz hatta düşer', () => {
    // Ödeyen üye ya da deneme hakkını kullanan aday boş ekran görmesin;
    // anahtar eklenince deploy gerekmeden döner.
    const ai = tierConfig('ai', false, { ...secenek, claudeAnahtariVar: false }).cfg;
    expect(ai.provider).toBe('groq');
    expect(ai.billable).toBe(false);
    expect(ai.denemeLimit).toBeUndefined();
    expect(ai.modLimits).toBeUndefined();

    const deneme = tierConfig('baslangic', false, { ...secenek, claudeAnahtariVar: false }).cfg;
    expect(deneme.provider).toBe('groq');
    expect(deneme.denemeLimit).toBeUndefined();
  });

  it('deneme katmanında günlük hak yok — yaşam boyu sınır denemeLimit ile korunur', () => {
    expect(tierConfig('baslangic', false, secenek).cfg.gunluk ?? 0).toBe(0);
    expect(tierConfig('ai', false, secenek).cfg.gunluk ?? 0).toBe(0);
  });

  it('tanınmayan katman deneme hakkına (baslangic ile aynı) düşer', () => {
    expect(tierConfig('yok-boyle-bir-sey', false, secenek).cfg).toEqual(tierConfig('baslangic', false, secenek).cfg);
  });

  it('yalnız "ai" katmanının aylık soru/mütalaa kotası vardır; free/baslangic yaşam boyu deneme hakkı taşır', () => {
    // Sayılar 12.09.2026'da 250/12'den yükseltildi: paket Opus varsayımıyla
    // kurulmuştu (₺2,67/istek), Sonnet'te ölçülen birim maliyet ₺1,07.
    // Gerekçe ve hesap: _shared/katman.ts (AI_SORU_LIMIT).
    expect(tierConfig('ai', false, secenek).cfg.modLimits).toEqual({ soru: 750, mutalaa: 25 });
    expect(tierConfig('free', false, secenek).cfg.modLimits).toBeUndefined();
    expect(tierConfig('baslangic', false, secenek).cfg.denemeLimit).toBe(DENEME_SORU_LIMIT);
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
    const cfg = tierConfig('baslangic', false, secenek).cfg;
    expect(overLimit(cfg, { calls: cfg.limit, cost: 0 })).toBe(true);
    expect(overLimit(cfg, { calls: cfg.limit - 1, cost: 999 })).toBe(false);
  });
});
