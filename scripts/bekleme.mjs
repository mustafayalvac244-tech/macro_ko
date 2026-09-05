// Sağlayıcının "kaç saniye sonra tekrar dene" ipucu.
// ---------------------------------------------------------------------------
// ÖLÇÜLEN GERÇEK. Ücretsiz sağlayıcının günlük tavanı KAYAN pencereyle
// yenileniyor; hata gövdesi bunu yazıyor:
//   "...on tokens per day (TPD): Limit 200000, Used 195246, Requested 7895.
//    Please try again in 22m36.912s."
// Yani "bugün bitti" değil, "yirmi üç dakika sonra devam". Ölçüm koşuları bu
// bilgi okunmadığı için yarıda kesiliyor ve saatler boşa gidiyordu.
//
// Uç, bu süreyi 429 yanıtında 'yeniden' alanıyla veriyor (saniye).

/** 429 gövdesinden bekleme süresini (ms) çıkarır; yoksa 0. */
export function yenidenMs(govde) {
  try {
    const j = typeof govde === 'string' ? JSON.parse(govde) : govde;
    const s = Number(j?.yeniden ?? 0);
    if (Number.isFinite(s) && s > 0) return Math.ceil(s * 1000);
  } catch {
    // gövde JSON değilse ipucu yok sayılır
  }
  return 0;
}

/**
 * Beklenecek süre: sağlayıcının söylediği süre, üst sınırla birlikte.
 * Üst sınır olmadan tek bir "3 saat sonra" cevabı ölçümü kilitlerdi.
 */
export function beklemeSuresi(govde, ustSinirMs = 30 * 60 * 1000) {
  const ms = yenidenMs(govde);
  return ms > 0 ? Math.min(ms + 5000, ustSinirMs) : 0;
}
