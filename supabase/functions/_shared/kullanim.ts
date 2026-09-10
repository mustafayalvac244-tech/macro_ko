// KULLANIM DÖNEMLERİ — aylık ve günlük sayaç anahtarları. Saf mantık, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Bu iki işlev iki uçta ayrı ayrı yazılmıştı ve tam da bu
// yüzden ictihat ucu günlük sayacı hiç bilmiyordu: ai-chat'te günlük adil
// kullanım hakkı varken içtihat ekranından yapılan AI çağrıları o haktan
// düşmüyordu. Kullanıcı, günlük hakkı hiç azalmadan ortak Groq kotasını
// yakabiliyordu — yani sınır, sınırlaması gereken şeyi sınırlamıyordu.
//
// Bugün aynı sınıftan üç arıza daha çıktı (katman tablosu iki uçta ayrışmıştı,
// hata metni üç ekranda ayrı yazılmıştı, tarih ayıklayıcı iki betikte
// kopyalanmıştı). Kopyalanan mantık, sessizce ayrışan mantıktır.

/** Aylık dönem anahtarı: YYYY-AA. */
export function aiPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * GÜNLÜK dönem anahtarı: YYYY-AA-GG.
 *
 * Ücretsiz sağlayıcının günlük token tavanı TÜM kullanıcılar için ORTAK
 * (200.000 token; bir dilekçe ~7.000-8.000). Aylık çağrı sınırı bunu korumaz:
 * tek bir üye sabah otuz istek gönderip havuzu bitirebilir ve o gün diğer
 * herkes "kota doldu" görür. Günlük sınır, ücretsiz katmanı satılabilir yapan
 * şeydir: "günde şu kadar" diye söz verip tutabiliyoruz.
 */
export function aiGun(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
