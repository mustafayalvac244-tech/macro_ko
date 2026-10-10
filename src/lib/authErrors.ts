import { SUPABASE_YAPILANDIRILDI } from '@/lib/env';
import { getLang, translate, type Lang, type TKey } from '@/i18n';
// Supabase (ve genel ağ) hata mesajları İngilizce döner; kullanıcıya
// göstermeden önce bilinen kalıpları ARAYÜZ DİLİNE çevirir. Bilinmeyen
// mesajlar olduğu gibi bırakılır (kendi fırlattığımız Türkçe hatalar dahil).
//
// ARAYÜZ DİLİ (09.10.2026). Metinler eskiden bu dosyada Türkçe sabitti:
// Ayarlar'dan İngilizce seçen avukat çıkış yapıp yanlış şifre girince
// İngilizce ekranda Türkçe hata görüyordu. Metinler artık src/i18n'de
// (authErr.*), dil ise çağrı anındaki uygulama dili.

/**
 * Doğrulanmamış e-posta mesajı DIŞA AÇIK: giriş ekranı bu mesajı görünce
 * "doğrulama e-postasını tekrar gönder" düğmesi çizer (04.10.2026 — rakip
 * uygulamanın App Store yorumlarında en sık 1 yıldız sebebi "kod/e-posta
 * gelmiyor, hesap açılamıyor"ydu; bizde tekrar gönderme hiç yoktu).
 * Karşılaştırma için dogrulanmamisMi kullanılır — metin dile göre değişir.
 */
export const DOGRULANMAMIS_ANAHTAR: TKey = 'authErr.emailNotConfirmed';
/** Türkçe metin (eski çağıranlar ve testler için). */
export const DOGRULANMAMIS = translate('tr', DOGRULANMAMIS_ANAHTAR);

/** Mesaj "e-posta doğrulanmamış" hatası mı — iki dilde de tanır. */
export function dogrulanmamisMi(mesaj: string | null | undefined): boolean {
  if (!mesaj) return false;
  return mesaj === translate('tr', DOGRULANMAMIS_ANAHTAR) || mesaj === translate('en', DOGRULANMAMIS_ANAHTAR);
}

const PATTERNS: Array<[RegExp, TKey]> = [
  [/invalid login credentials/i, 'authErr.invalidLogin'],
  // Kayıt ekranı, Supabase'in sahte "başarılı" yanıtını bu anahtarla bildirir
  // (bkz. authStore.signUp, 28.09.2026).
  [/^zaten-kayitli$/, 'authErr.alreadyRegisteredSignup'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, 'authErr.emailRateLimit'],
  [/for security purposes.*only request this after (\d+) seconds?/i, 'authErr.securityWait'],
  [/user already registered|already been registered/i, 'authErr.alreadyRegistered'],
  [/password should be at least (\d+) characters?/i, 'authErr.passwordMin'],
  [/password should contain/i, 'authErr.passwordChars'],
  [/unable to validate email address|invalid format|invalid email/i, 'authErr.invalidEmail'],
  [/email not confirmed/i, DOGRULANMAMIS_ANAHTAR],
  [/new password should be different/i, 'authErr.samePassword'],
  [/token has expired|otp.*expired|expired.*otp/i, 'authErr.codeExpired'],
  [/token.*invalid|invalid.*token|invalid.*otp|otp.*invalid/i, 'authErr.codeInvalid'],
  [/user not found/i, 'authErr.userNotFound'],
  [/signups? not allowed/i, 'authErr.signupsClosed'],
  [/rate limit|too many requests/i, 'authErr.rateLimit'],
  // SUNUCU TARAFI ZAMAN AŞIMI — AĞ HATASINDAN ÖNCE gelmeli.
  // 23.09.2026, gerçek kullanıcı ekranı: giriş düğmesine basınca kırmızıyla
  //   {"status":504,"statusText":"gateway timed out","redirected":false,"url":"https://…/auth/v1/token?…"}
  // yazdı. Aşağıdaki ağ deseni `timeout` arıyordu, Supabase ağ geçidi
  // `timed out` yazıyor; eşleşmeyince ham JSON — sunucu adresiyle birlikte —
  // kullanıcıya basıldı. Ayrıca bu BİZİM sunucumuzun sorunu: "bağlantınızı
  // kontrol edin" demek kullanıcıyı suçsuz yere kendi internetine yollar.
  [/gateway time-?d? ?out|bad gateway|service unavailable|"status"\s*:\s*50[0-9]|AuthRetryableFetchError/i, 'authErr.serverUnavailable'],
  [/network request failed|fetch failed|failed to fetch|network error|timeout/i, 'authErr.network'],
  [/jwt expired|refresh token/i, 'authErr.sessionExpired'],
  [/payload too large|exceeded the maximum allowed size/i, 'authErr.payloadTooLarge'],
  [/row-level security|permission denied|not authorized/i, 'authErr.notAuthorized'],
  [/duplicate key value/i, 'authErr.duplicate'],
];

/**
 * @param yapilandirildi Supabase adresi/anahtarı tanımlı mı. Parametre olarak
 * alınır ki işlev SAF kalsın: ortamdan okusaydı aynı girdi, ortama göre farklı
 * çıktı verirdi ve birim testi ortama bağımlı hâle gelirdi.
 * @param dil Çıktı dili; verilmezse uygulamanın o anki dili.
 */
export function trError(
  message: string | null | undefined,
  yapilandirildi: boolean = SUPABASE_YAPILANDIRILDI,
  dil: Lang = getLang()
): string {
  const metin = (anahtar: TKey) => translate(dil, anahtar);
  if (!message) return metin('authErr.generic');
  // YAPILANDIRMA EKSİĞİNİ AĞ HATASI SANMAYALIM. Supabase adresi/anahtarı
  // tanımlı değilse istemci sahte bir adrese gider ve her istek "network
  // request failed" verir; kullanıcı bağlantısını kontrol edip durur, oysa
  // sorun .env dosyasındadır. Web derlemesinde tam olarak bu yaşandı:
  // giriş ekranı sorunsuz açıldı, her deneme "İnternet bağlantısı kurulamadı"
  // dedi ve sebep saatlerce bağlantıda arandı.
  if (!yapilandirildi && /network request failed|fetch failed|failed to fetch|network error/i.test(message)) {
    return metin('authErr.notConfigured');
  }
  for (const [re, anahtar] of PATTERNS) {
    if (re.test(message)) return metin(anahtar);
  }
  // HAM ÇIKTI KORUMASI. Tanımadığımız mesajı olduğu gibi bırakıyoruz — çünkü
  // kendi fırlattığımız Türkçe hatalar da buradan geçiyor. AMA ham JSON ya da
  // içinde sunucu adresi olan bir metin hiçbir zaman kullanıcı diline
  // çevrilmiş bir hata değildir: bir kütüphanenin iç çıktısıdır. 504 olayı
  // tam böyle sızdı. Desen listesi bir gün yine bir biçimi kaçırırsa, en
  // azından sunucu adresi ve teknik döküm ekrana düşmesin.
  if (/^\s*[{[]/.test(message) || /https?:\/\//i.test(message)) {
    return metin('authErr.unexpected');
  }
  return message;
}
