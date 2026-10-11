import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { livemodeUygunMu } from '../supabase/functions/_shared/stripeKip';

/**
 * stripe-webhook KONTÖR YÜKLER. Olayın `livemode` alanı denetlenmiyordu:
 * canlı anahtarla çalışan uca TEST modunda üretilmiş (sahte kartla, bedava)
 * bir `payment_intent.succeeded` ulaşırsa gerçek kontör yüklenirdi. İmza
 * doğrulaması bunu tek başına engellemez: test ve canlı uç noktalarının
 * imza sırları ayrıdır ama ortam değişkenine yanlış olanı konabilir ya da
 * iki uç noktası aynı sırla kurulabilir.
 *
 * Kural: olayın kipi, STRIPE_SECRET_KEY'in kipiyle aynı olmalı.
 */
describe('livemodeUygunMu', () => {
  it('canlı anahtar + canlı olay → uygun', () => {
    expect(livemodeUygunMu('sk_live_abc', true)).toBe(true);
    expect(livemodeUygunMu('rk_live_abc', true)).toBe(true);
  });

  it('canlı anahtar + TEST olayı → uygun DEĞİL (bedava kontör yolu)', () => {
    expect(livemodeUygunMu('sk_live_abc', false)).toBe(false);
  });

  it('test anahtarı + test olayı → uygun; test anahtarı + canlı olay → değil', () => {
    expect(livemodeUygunMu('sk_test_abc', false)).toBe(true);
    expect(livemodeUygunMu('sk_test_abc', true)).toBe(false);
  });

  it('livemode alanı yok ya da boolean değil → uygun değil (kapalı kal)', () => {
    expect(livemodeUygunMu('sk_live_abc', undefined)).toBe(false);
    expect(livemodeUygunMu('sk_test_abc', undefined)).toBe(false);
    expect(livemodeUygunMu('sk_live_abc', 'true')).toBe(false);
  });
});

describe('stripe-webhook livemode denetimini GERÇEKTEN çağırıyor', () => {
  const kaynak = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');

  it('imza doğrulandıktan sonra, bakiye yazılmadan ÖNCE', () => {
    const imza = kaynak.indexOf('constructEventAsync');
    const kip = kaynak.indexOf('livemodeUygunMu(');
    const yukle = kaynak.indexOf("db.rpc('ai_odeme_isle'");
    expect(imza).toBeGreaterThan(-1);
    expect(kip).toBeGreaterThan(imza);
    expect(yukle).toBeGreaterThan(kip);
  });

  it('uyumsuz olay 2xx ile atlanır (Stripe saatlerce yeniden denemesin)', () => {
    expect(kaynak).toMatch(/livemode_uyumsuz/);
  });
});
