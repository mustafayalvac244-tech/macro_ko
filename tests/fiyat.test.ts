import { describe, expect, it } from 'vitest';
import { costTry, enPahaliFiyat, PRICING, USD_TRY } from '../supabase/functions/_shared/fiyat';

/**
 * Fiyat tablosu iki uçta ayrı yazılmıştı ve ayrışmıştı: ai-chat'te Claude ve
 * OpenAI modelleri varken ictihat'te yalnız iki eski Gemini satırı kalmıştı.
 * Para hesabında ayrışma özellikle pahalıdır — yanlış fiyat ya kullanıcıdan
 * fazla alır ya bizi zarara sokar ve ikisi de sessizce olur.
 */
describe('costTry', () => {
  it('ölçülen dilekçe maliyetini Sonnet fiyatından hesaplar', () => {
    // 8.000 girdi + 3.000 çıktı; 2 USD/M girdi, 10 USD/M çıktı, 1 USD = 42 TL.
    const tl = costTry('claude-sonnet-5', 8000, 3000);
    expect(Math.round(tl * 100) / 100).toBe(1.93);
  });

  it('ucuz modelde maliyet düşer', () => {
    expect(costTry('gpt-5-mini', 8000, 3000)).toBeLessThan(costTry('claude-sonnet-5', 8000, 3000));
  });

  it('sıfır token sıfır maliyet', () => {
    expect(costTry('claude-sonnet-5', 0, 0)).toBe(0);
  });
});

describe('enPahaliFiyat', () => {
  it('bilinmeyen model EN PAHALI tarifeden sayılır', () => {
    // Yön bilinçli: eksik saymak tavanı geçersiz kılar ve zararı ancak fatura
    // gelince gösterir. Sağlayıcılar model adlarını haber vermeden emekliye
    // ayırıyor; "bilinmeyen model" beklenen bir durum, istisna değil.
    const bilinmeyen = costTry('yeni-model-2027', 1_000_000, 0);
    const enPahali = enPahaliFiyat();
    expect(bilinmeyen).toBe(enPahali.in * USD_TRY);
    for (const p of Object.values(PRICING)) expect(p.in).toBeLessThanOrEqual(enPahali.in);
  });
});
