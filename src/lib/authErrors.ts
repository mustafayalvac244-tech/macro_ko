// Supabase (ve genel ağ) hata mesajları İngilizce döner; kullanıcıya
// göstermeden önce bilinen kalıpları Türkçeye çevirir. Bilinmeyen
// mesajlar olduğu gibi bırakılır (kendi fırlattığımız Türkçe hatalar dahil).
const PATTERNS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-posta veya şifre hatalı.'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, 'Kısa sürede çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.'],
  [/for security purposes.*only request this after (\d+) seconds?/i, 'Güvenlik nedeniyle lütfen kısa bir süre sonra tekrar deneyin.'],
  [/user already registered|already been registered/i, 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.'],
  [/password should be at least (\d+) characters?/i, 'Şifre en az 6 karakter olmalı.'],
  [/password should contain/i, 'Şifre gerekli karakter çeşitlerini içermiyor (harf ve rakam kullanın).'],
  [/unable to validate email address|invalid format|invalid email/i, 'Geçerli bir e-posta adresi girin.'],
  [/email not confirmed/i, 'E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.'],
  [/new password should be different/i, 'Yeni şifre eski şifrenizden farklı olmalı.'],
  [/token has expired|otp.*expired|expired.*otp/i, 'Kodun süresi dolmuş. Lütfen yeni kod isteyin.'],
  [/token.*invalid|invalid.*token|invalid.*otp|otp.*invalid/i, 'Kod hatalı. Lütfen kontrol edip tekrar deneyin.'],
  [/user not found/i, 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.'],
  [/signups? not allowed/i, 'Yeni kayıt şu anda kapalı.'],
  [/rate limit|too many requests/i, 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.'],
  [/network request failed|fetch failed|failed to fetch|network error|timeout/i, 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.'],
  [/jwt expired|refresh token/i, 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.'],
  [/payload too large|exceeded the maximum allowed size/i, 'Dosya boyutu izin verilen sınırı aşıyor.'],
  [/row-level security|permission denied|not authorized/i, 'Bu işlem için yetkiniz yok.'],
  [/duplicate key value/i, 'Bu kayıt zaten mevcut.'],
];

export function trError(message: string | null | undefined): string {
  if (!message) return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  for (const [re, tr] of PATTERNS) {
    if (re.test(message)) return tr;
  }
  return message;
}
