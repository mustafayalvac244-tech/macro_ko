/**
 * Captcha yapılandırması — Cloudflare Turnstile.
 *
 * NEDEN TURNSTILE, NEDEN hCaptcha DEĞİL. Kullanıcının isteği "insanları sinir
 * etmeyen bir captcha"ydı. hCaptcha çoğu ziyaretçiye görsel bulmaca gösterir
 * (trafik ışığı, otobüs seçme). Turnstile'ın "managed" kipi ise ziyaretçilerin
 * büyük kısmını HİÇBİR ETKİLEŞİM İSTEMEDEN geçirir; bulmaca yoktur, en fazla
 * bir onay kutusu çıkar ve bu da yalnız şüpheli durumlarda olur.
 *
 * NEDEN ANAHTAR YOKKEN TAMAMEN SESSİZ. Site anahtarı tanımlı değilken captcha
 * hiç çizilmez ve kayıt/giriş isteklerine hiçbir alan eklenmez — yani bugünkü
 * davranışın birebir aynısı. Böylece bu kod, anahtar gelene kadar hiçbir şeyi
 * bozamaz. Anahtar tanımlandığı an kendiliğinden devreye girer.
 *
 * DİKKAT — İKİ TARAF BİRLİKTE AÇILMALI. Supabase tarafında captcha zorunlu
 * kılınırsa (security_captcha_enabled = true) ve uygulama token göndermezse
 * KAYIT VE GİRİŞ TAMAMEN KIRILIR. Sıra şudur:
 *   1) Cloudflare'de Turnstile sitesi oluştur (site key + secret key).
 *   2) Site anahtarını uygulamaya ver (EXPO_PUBLIC_TURNSTILE_SITE_KEY) ve
 *      YENİ BİR SÜRÜM YAYINLA. OTA yeterlidir; native değişiklik yok.
 *   3) Kullanıcıların çoğu yeni sürüme geçtikten SONRA Supabase'de captcha'yı
 *      zorunlu yap (provider: turnstile, secret key).
 * Adım 3'ü adım 2'den önce yapmak, eski sürümdeki herkesi kapıda bırakır.
 */

/** Cloudflare Turnstile site anahtarı (gizli değildir, istemcide bulunur). */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/** Anahtar tanımlıysa captcha çalışır; değilse kod tamamen devre dışıdır. */
export const CAPTCHA_ENABLED = TURNSTILE_SITE_KEY.length > 0;
