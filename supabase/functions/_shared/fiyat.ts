// MODEL FİYATLARI VE MALİYET HESABI — tek kaynak, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Fiyat tablosu iki uçta ayrı yazılmıştı ve ayrışmıştı:
// ai-chat'te Claude, Fable ve OpenAI modelleri varken ictihat'te yalnız iki
// eski Gemini satırı kalmıştı ve bilinmeyen her modeli gemini-2.5-pro
// fiyatından sayıyordu. Bugün aynı sınıftan beş arıza çıktı (katman tablosu,
// hata metni, tarih ayıklayıcı, dönem anahtarları ve şimdi fiyat).
//
// PARA HESABINDA AYRIŞMA ÖZELLİKLE PAHALIDIR: yanlış fiyat ya kullanıcıdan
// fazla alır ya bizi zarara sokar ve ikisi de sessizce olur — kimse fark
// etmeden aylarca sürebilir.

/**
 * USD/TL. Env ile güncellenebilir; kur değişince deploy gerekmesin.
 *
 * Deno globali TEMKİNLİ okunuyor: bu dosya hem uç işlevlerinde (Deno) hem test
 * koşucusunda (Node) içeri alınıyor ve doğrudan `Deno.env` yazmak testte
 * ReferenceError verirdi. Fiyat mantığının sınanabilir olması, kurun env'den
 * gelmesinden daha önemli.
 */
export const USD_TRY = Number(
  (globalThis as { Deno?: { env?: { get(a: string): string | undefined } } }).Deno?.env?.get?.('VEKIL_USD_TRY') || '42'
);

/**
 * USD / 1M token. Kaynak: sağlayıcıların resmî fiyat sayfaları.
 *
 * Fable 5.1'in GİRDİ fiyatı belgeden türetildi (önbellek okuma ücreti temel
 * girdinin 0,025 katı ve 0,25 USD/MTok veriliyor → temel girdi 10 USD).
 * ÇIKTI fiyatı doğrulanmadı; buradaki 50, "çıktı = girdinin beş katı"
 * oranından türetilmiş bir VARSAYIMDIR. Yanlışsa yön güvenli tarafta: fazla
 * hesaplarız, eksik değil.
 */
export const PRICING: Record<string, { in: number; out: number }> = {
  'gemini-2.0-flash': { in: 0.15, out: 0.6 },
  'gemini-2.5-pro': { in: 1.25, out: 10.0 },
  'claude-sonnet-5': { in: 2.0, out: 10.0 },
  // TAŞMA MODELİ. Aylık kota bitince istek reddedilmiyor, buraya düşüyor.
  // Fiyat 12.09.2026'da web aramasıyla doğrulandı; aynı rakam birden çok
  // bağımsız kaynakta ($1 giriş / $5 çıkış per MTok) — Anthropic'in kendi
  // sayfası değil. Ölçülen dilekçe boyutuyla (4.844 giriş + 1.573 çıkış,
  // n=7) istek başına ≈ ₺0,53; Sonnet'in yarısı.
  'claude-haiku-4-5-20251001': { in: 1.0, out: 5.0 },
  'claude-opus-5': { in: 5.0, out: 25.0 },
  'claude-fable-5-1': { in: 10.0, out: 50.0 },
  'gpt-5.6-terra': { in: 2.0, out: 12.0 },
  'gpt-5.1': { in: 1.25, out: 10.0 },
  'gpt-5': { in: 1.25, out: 10.0 },
  'gpt-5.4-mini': { in: 0.75, out: 4.5 },
  'gpt-5-mini': { in: 0.25, out: 2.0 },
  'gpt-5.6-luna': { in: 0.2, out: 1.2 },
  'gpt-5-nano': { in: 0.05, out: 0.4 },
};

/**
 * Bilinmeyen model için EN PAHALI tarife.
 *
 * Yön bilinçli: model adı değişip tabloya girmediğinde maliyeti OLDUĞUNDAN
 * DÜŞÜK saymak, tavanı geçersiz kılar ve zararı ancak fatura gelince gösterir.
 * Fazla saymak ise en fazla kullanıcıyı erken durdurur — geri alınabilir bir
 * hata. Sağlayıcılar model adlarını haber vermeden emekliye ayırıyor; bu
 * yüzden "bilinmeyen model" beklenen bir durumdur, istisna değil.
 */
export function enPahaliFiyat(): { in: number; out: number } {
  let en = { in: 0, out: 0 };
  for (const p of Object.values(PRICING)) {
    if (p.in + p.out > en.in + en.out) en = p;
  }
  return en;
}

/** Bir çağrının TL maliyeti. */
export function costTry(model: string, tin: number, tout: number): number {
  const p = PRICING[model] ?? enPahaliFiyat();
  return ((tin / 1e6) * p.in + (tout / 1e6) * p.out) * USD_TRY;
}
