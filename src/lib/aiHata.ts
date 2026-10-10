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
  /** doc-extract 'pdf_no_text' döndüğünde PDF'in sayfa sayısı. */
  sayfa?: number;
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

/**
 * Sohbet isteğinin istemci tarafı zaman aşımı (ms). ÖLÇÜLMEDİ, TAHMİN.
 *
 * Referans: 04–05.10'da ölçülen sohbet süresi 22–30 sn (DURUM.md). 120 sn bunun
 * kabaca 4–5 katı: yavaş ama sağlıklı bir cevabı kesmez, askıda kalan bağlantıyı
 * ise sonsuza dek bekletmez (eskiden zaman aşımı hiç yoktu: ekran "düşünüyor"da
 * kalıp kutuyu kilitliyordu). Sunucu işi bitirmiş olabilir; bu yüzden zaman
 * aşımı mesajı "hakkınızdan düşülmedi" DEMEZ.
 */
export const AI_SOHBET_ZAMAN_ASIMI_MS = 120_000;

/**
 * Sunucuya HİÇ ulaşılamadığında (functions-js FunctionsFetchError) nedeni ayırır:
 * zaman aşımı/iptal → 'zaman_asimi'; diğerleri (ağ yok) → 'generic'. Sunucu
 * cevap verdiyse (HTTP/relay hatası) null: oradaki kod gövdeden okunur.
 */
export function aiBaglantiKodu(fnErr: unknown): 'zaman_asimi' | 'generic' | null {
  const e = fnErr as { name?: string; context?: { name?: string } } | null;
  if (e?.name !== 'FunctionsFetchError') return null;
  const ic = e.context?.name;
  return ic === 'AbortError' || ic === 'TimeoutError' ? 'zaman_asimi' : 'generic';
}

// Uygulamanın t() işlevi bütün çeviri anahtarlarını kabul eder; burada yalnız
// kullandıklarımızı istiyoruz. Daha genişini kabul eden bir işlev, daha darını
// isteyen bu tipe atanabilir — yani t() olduğu gibi geçer ve yanlış anahtar
// yazma ihtimali kapanır.
type HataAnahtari = 'ai.errEkBuyuk' | 'ai.errSoruUzun' | 'ai.errPaketGerekli' | 'ai.errQuotaWait' | 'ai.errDailyQuota' | 'ai.errRateLimit' | 'ai.errQuota' | 'ai.errKontor' | 'ai.errDailyCap' | 'ai.errMutalaaKapali' | 'ai.errSoruKota' | 'ai.errMutalaaKota' | 'ai.errDenemeBitti' | 'ai.errKvkkRiza' | 'ai.errKvkkKontrol' | 'ai.errServis' | 'ai.errBos' | 'ai.errOturum' | 'ai.errTamamlanamadi' | 'ai.errGeneric' | 'ai.errZamanAsimi' | 'ai.errGirdiBuyuk' | 'ai.errYedekGunluk' | 'ai.errRefusal';
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
  // Eklenen belgelerin toplam boyutu sunucu tavanını aştı (bkz.
  // supabase/functions/_shared/belgeEki.ts). Hak düşmez, istek başlamadı.
  if (kod === 'ek_buyuk') return t('ai.errEkBuyuk');
  // Yazılan/yapıştırılan metin sunucu tavanını aştı (SORU_TAVANI, aynı
  // dosya). İstek başlamadan reddedildi; kesilip eksik okunmadı.
  if (kod === 'soru_uzun') return t('ai.errSoruUzun');
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
  // "AI" katmanının aylık soru/mütalaa kotası: kontörden farklı — yükleme
  // yapılamaz, yalnız ay dönünce (aiPeriod, UTC) yenilenir.
  if (kod === 'ai_soru_kota_bitti') return t('ai.errSoruKota');
  if (kod === 'ai_mutalaa_kota_bitti') return t('ai.errMutalaaKota');
  // Yaşam boyu deneme hakkı (3 soru) tükendi — kontör/kota gibi yenilenmez,
  // yalnız abonelikle devam edilir.
  if (kod === 'deneme_hakki_bitti') return t('ai.errDenemeBitti');
  // KVKK açık rızası yok. Bu bir ARIZA DEĞİL, kuraldır: rıza olmadan metni
  // yurt dışına gönderemeyiz. "Tekrar deneyin" demek yanıltıcı olurdu —
  // tekrar denemek hiçbir zaman işe yaramaz. Mesaj, gidilecek YERİ söylüyor.
  if (kod === 'kvkk_riza_yok') return t('ai.errKvkkRiza');
  // Rıza kaydı OKUNAMADI — kullanıcının eksiği değil, bizim arızamız. Ayrı
  // mesaj şart: "imzalayın" deseydik, imzalamış kullanıcıyı olmayan bir işe
  // yollar ve gerçek arıza görünmez kalırdı.
  if (kod === 'kvkk_kontrol_hatasi') return t('ai.errKvkkKontrol');
  // PAKETTE YOK — kota değil, kapsam. 13.09.2026'da deneme hakkı ücretsiz
  // katmandan alınıp ₺399'luk pakete taşındı; ödeme yapmamış kullanıcı artık
  // yapay zekâ uçlarından 403 `tier_required` alıyor. Bunu "kotanız bitti"
  // diye göstermek yanlış sebep söylemek olurdu: kullanıcı beklerse
  // açılacağını sanır, oysa beklemekle açılmaz.
  if (kod === 'tier_required') return t('ai.errPaketGerekli');
  // SUNUCU TARAFI ARIZALAR (08.10.2026). Bunlar da "İnternet bağlantınızı
  // kontrol edin" diyordu; oysa sorun bizde. 08.10'da Claude hesabı askıya
  // alındığında avukat kendi internetini suçlayacaktı. Hak iadesi
  // _shared/hakIadesi.ts'te: başarısız istekte hak geri verilir.
  // İÇ SÜRE BÜTÇESİ DOLDU (09.10.2026, Hukuki Araştırma): platformun 546'sı
  // gövdesiz geliyor ve "internet bağlantınızı kontrol edin" diye görünüyordu.
  if (kod === 'zaman_asimi') return t('ai.errZamanAsimi');
  // MODEL REDDİ: servis arızası değil; aynı olayla tekrar denemek işe yaramaz.
  if (kod === 'refusal') return t('ai.errRefusal');
  if (kod === 'upstream') return t('ai.errServis');
  if (kod === 'empty') return t('ai.errBos');
  if (kod === 'unauthorized') return t('ai.errOturum');
  // 10.10.2026: istemci zaman aşımı, sohbet girdi tavanı (413) ve yedek hat
  // günlük kapısı (429). Üçü de "internet" değil; sebebi söylenir.
  if (kod === 'zaman_asimi') return t('ai.errZamanAsimi');
  if (kod === 'girdi_buyuk') return t('ai.errGirdiBuyuk');
  if (kod === 'yedek_gunluk') return t('ai.errYedekGunluk');
  // Bağlantı hatası YALNIZ sunucuya hiç ulaşılamadığında ('generic' ya da
  // kod yok). Ulaşıldı ama kod tanınmıyorsa internet suçlanmaz.
  if (kod === '' || kod === 'generic') return t('ai.errGeneric');
  return t('ai.errTamamlanamadi');
}

export type IctihatError = 'rate_limit' | 'source' | 'ai_off' | 'kvkk' | 'kvkk_arizasi' | 'paket' | 'generic';

/**
 * Hata kodunu çeviri anahtarına çevirir.
 *
 * NEDEN BURADA. Aynı üçlü koşul içtihat ekranında ÜÇ ayrı yerde elle yazılmıştı
 * (arama, olay analizi, künye). Yeni bir hata türü eklendiğinde üçünü birden
 * güncellemek gerekiyordu ve unutulan yer hiçbir hata vermeden yanlış cümleyi
 * gösterirdi — sessizce. Tek sahip burası.
 */
export function ictihatHataAnahtari(error: IctihatError):
  | 'ictihat.errAiOff' | 'ictihat.errRate' | 'ictihat.errSource'
  | 'ai.errKvkkRiza' | 'ai.errKvkkKontrol' | 'ai.errPaketGerekli' | 'ictihat.errGeneric' {
  switch (error) {
    case 'ai_off': return 'ictihat.errAiOff';
    case 'rate_limit': return 'ictihat.errRate';
    case 'source': return 'ictihat.errSource';
    // KVKK mesajları ai-chat ile ORTAK: aynı sebeple kapanan iki ekranın iki
    // farklı cümle söylemesi, kullanıcıya iki ayrı sorun varmış izlenimi verir.
    case 'kvkk': return 'ai.errKvkkRiza';
    case 'kvkk_arizasi': return 'ai.errKvkkKontrol';
    // Paket mesajı da ai-chat ile ORTAK: aynı sebeple kapanan iki ekranın iki
    // ayrı cümle söylemesi, kullanıcıya iki ayrı sorun varmış izlenimi verir.
    case 'paket': return 'ai.errPaketGerekli';
    default: return 'ictihat.errGeneric';
  }
}
