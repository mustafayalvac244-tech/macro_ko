// YEDEK HAT GÜNLÜK KAPISI (10.10.2026, 50 denetçi bulgusu 23). Saf, testli.
// ---------------------------------------------------------------------------
// BULUNAN KUSUR. Claude düşünce ai-chat cevabı ücretsiz sağlayıcıya (Groq,
// ardından Gemini) çevirir. Bu cevapta: hak iade edilir (asıl model
// cevaplamadı), maliyet 0 yazılır (faturalı değil) ve günlük sayaç
// artmaz. Yani ne günlük adil kullanım ne aylık ₺ tavanı bu yolu sayıyordu —
// bir kullanıcı, Claude kapalıyken sınırsız yedek cevap çekebilirdi. O
// sağlayıcıların günlük token tavanı TÜM kullanıcılar için ORTAK (bkz.
// _shared/kullanim.ts): tek kullanıcı havuzu bitirince herkes kaybeder.
//
// ÇÖZÜM. Yedeğe GEÇİLMEDEN hemen önce kullanıcının bugünkü yedek cevap sayısına
// bakılır; tavandaysa yedeğe geçilmez, istek `yedek_gunluk` hatasıyla biter
// (429; hak iadesi sarmalayıcısı geri verir; sohbette kullanıcı yine de
// mevzuat özetini görür). Kapı yalnız yedeğe inileceği anda çalışır: sağlıklı
// Claude yolu bir sorgu daha ÖDEMEZ ve Claude düzeldikten sonra o gün yedekte
// kalmış kullanıcı engellenmez.
//
// TAVAN = 25: ÖLÇÜLMEDİ, EMSAL. Claude anahtarı hiç yokken zaten ücretsiz
// sağlayıcıya düşen katmanın günlük adil kullanım hakkı 25 (katman.ts >
// tierConfig, `gunluk: 25`). Aynı sağlayıcı, aynı havuz, aynı sayı. Ürün
// kararıdır; değiştirmek için bu sabit yeter.
//
// SAYIM NASIL. ai_istek satırları (ai-chat > yedekBugun): bugün, bu kullanıcı,
// musteriye_yazildi=false VE maliyet_try=0. Kusurlu Claude cevabı da
// "müşteriye yazılmadı" olur ama maliyeti > 0'dır; yalnız yedek hat 0 yazar.
//
// BİLİNEN SINIR. Sayım-sonra-karar: aynı anda gelen N yedek isteği hepsi
// "altındayım" görebilir; tavan N kadar aşılabilir. Hak rezervasyonundaki gibi
// satır kilidi yok; amaç kesin sayaç değil, sınırsızlığı kapatmak. Sayım
// okunamazsa (hata) KULLANICI MAĞDUR EDİLMEZ: izin verilir.

export const YEDEK_GUNLUK_TAVAN = 25;
export const YEDEK_TAVAN_HATASI = 'yedek_gunluk';

/** Bugünkü yedek cevap sayısı tavanın altında mı? `say` null dönerse okunamamıştır. */
export async function yedekIzniVar(say: () => Promise<number | null>, tavan: number = YEDEK_GUNLUK_TAVAN): Promise<boolean> {
  try {
    const n = await say();
    return n === null || n < tavan;
  } catch {
    return true;
  }
}

/**
 * İstemciye anlamlı kodla dönebilen hatalar. Altı modun hata eşlemesi bu
 * listeyi AYRI AYRI elle yazıyordu; biri unutulsa yeni kod o modda 502
 * 'upstream' olurdu.
 */
export function bilinenIstekHatasi(msg: string): boolean {
  return msg === 'rate_limit' || msg === 'daily_quota' || msg === YEDEK_TAVAN_HATASI;
}
