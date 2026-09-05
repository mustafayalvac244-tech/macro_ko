/**
 * AI uçlarından dönen hatayı kullanıcıya gösterilecek metne çevirir.
 *
 * NEDEN ORTAK. Aynı çeviri üç ekranda ayrı ayrı yazılmıştı (dilekçe, mütalaa,
 * belge inceleme) ve biri değiştiğinde diğerleri geride kalıyordu. Sağlayıcının
 * "kaç dakika sonra" bilgisi eklendiğinde bunun üç yerde birden yapılması
 * gerekti; ortak yer olmadan dördüncü ekranda yine unutulurdu.
 *
 * KOTA MESAJI NEDEN ÖNEMLİ. Ücretsiz sağlayıcının kotası KAYAN pencereyle
 * yenileniyor ("Please try again in 22m36s") ama mesajımız "yarın tekrar
 * deneyin" diyordu. Avukatı 23 dakika beklemesi gerekirken ertesi güne
 * yollamak, o gün için ürünü yok etmek demekti.
 */
export interface AiHataYaniti {
  error?: string;
  /** Sağlayıcının bildirdiği yeniden deneme süresi (saniye). */
  yeniden?: number;
}

/** Edge işlevi hatasının gövdesini okur; okunamazsa boş nesne döner. */
export async function aiHataGovdesi(fnErr: unknown): Promise<AiHataYaniti> {
  try {
    const ctx = (fnErr as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') return ((await ctx.json()) ?? {}) as AiHataYaniti;
  } catch {
    // gövde okunamazsa genel hataya düşülür
  }
  return {};
}

// Uygulamanın t() işlevi bütün çeviri anahtarlarını kabul eder; burada yalnız
// kullandıklarımızı istiyoruz. Daha genişini kabul eden bir işlev, daha darını
// isteyen bu tipe atanabilir — yani t() olduğu gibi geçer ve yanlış anahtar
// yazma ihtimali kapanır.
type HataAnahtari = 'ai.errQuotaWait' | 'ai.errDailyQuota' | 'ai.errRateLimit' | 'ai.errQuota' | 'ai.errKontor' | 'ai.errDailyCap' | 'ai.errMutalaaKapali' | 'ai.errGeneric';
type Ceviri = (anahtar: HataAnahtari, params?: Record<string, string | number>) => string;

/**
 * Hata gövdesinden gösterilecek metni üretir.
 *
 * Bekleme süresi yalnız MAKUL ise gösterilir: sağlayıcı "6 saat sonra" diyorsa
 * dakika saymak kullanıcıya yardımcı olmaz, o gün için kapalı demektir.
 */
export function aiHataMetni(govde: AiHataYaniti, t: Ceviri): string {
  const kod = govde.error ?? '';
  const bekle = typeof govde.yeniden === 'number' && govde.yeniden > 0 ? govde.yeniden : 0;
  if (kod === 'daily_quota' || kod === 'rate_limit') {
    if (bekle && bekle < 6 * 3600) {
      return t('ai.errQuotaWait', { dk: String(Math.max(1, Math.ceil(bekle / 60))) });
    }
    return kod === 'daily_quota' ? t('ai.errDailyQuota') : t('ai.errRateLimit');
  }
  if (kod === 'quota_exceeded') return t('ai.errQuota');
  // Kontör bitmesi kota değildir: beklemekle geçmez, yükleme gerektirir.
  // İkisini aynı mesaja bağlamak kullanıcıyı boşuna bekletirdi.
  if (kod === 'kontor_bitti') return t('ai.errKontor');
  // Günlük adil kullanım hakkı: sağlayıcı kotasından farklı. Bizim koyduğumuz
  // sınır olduğu için ne zaman yenileneceği kesin: gece yarısı (UTC).
  if (kod === 'gunluk_hak_bitti') return t('ai.errDailyCap');
  // Mütalaa, ücretli model yokken hiç üretilmiyor: ölçümde ücretsiz katmanın
  // küçük modeli olmayan kanunlara atıf yapan bir mütalaa üretti. Uydurulmuş
  // mütalaa, eksik mütalaadan çok daha tehlikelidir.
  if (kod === 'mutalaa_model_yok') return t('ai.errMutalaaKapali');
  if (kod === 'not_configured') return t('ai.errGeneric');
  return t('ai.errGeneric');
}
