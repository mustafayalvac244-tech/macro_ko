// STRIPE OLAYININ KİPİ (canlı / test) — stripe-webhook için (10.10.2026,
// 50 denetçi → ajan 26).
// ---------------------------------------------------------------------------
// stripe-webhook KONTÖR YÜKLER. Olayın `livemode` alanına bakılmıyordu:
// canlı anahtarla çalışan uca TEST modunda üretilmiş (sahte kartlı, bedava)
// bir `payment_intent.succeeded` ulaşırsa gerçek kontör yüklenirdi. İmza
// doğrulaması bunu tek başına engellemez — test ve canlı uç noktalarının
// imza sırları ayrıdır, ama ortam değişkenine yanlış olanı konabilir ya da iki
// uç noktası aynı sırla kurulabilir.
//
// KURAL: olayın kipi, STRIPE_SECRET_KEY'in kipiyle AYNI olmalı. Canlı anahtar
// (`sk_live_…`, kısıtlı `rk_live_…`) → yalnız `livemode: true`; test anahtarı
// → yalnız `livemode: false`. Alan yok ya da boolean değilse reddedilir
// (kapalı kal).
// ---------------------------------------------------------------------------
export function livemodeUygunMu(secretKey: string, livemode: unknown): boolean {
  if (typeof livemode !== 'boolean') return false;
  const canliAnahtar = secretKey.includes('_live_');
  return livemode === canliAnahtar;
}
