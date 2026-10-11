import type { TKey } from '@/i18n';

/** Şifre alt sınırı Supabase tarafında da zorunlu; ekranla aynı sayı. */
export const SIFRE_ASGARI = 8;

type SunucuHatasi = { message: string } | null;

/**
 * Şifre sıfırlama ekranının kullandığı auth-js yüzeyi — yalnız gereken üç
 * çağrı. Ekran `supabase.auth`u verir; test sahtesini verir.
 */
export interface SifirlamaIstemcisi {
  verifyOtp(p: { email: string; token: string; type: 'recovery' }): Promise<{ error: SunucuHatasi }>;
  updateUser(p: { password: string }): Promise<{ error: SunucuHatasi }>;
  getSession(): Promise<{ data: { session: unknown } }>;
}

export type SifirlamaSonucu =
  | { tur: 'bitti'; kodDogrulandi: boolean }
  | {
      tur: 'hata';
      /** Kod sunucuda doğrulandı mı (doğrulandıysa bir daha kullanılamaz). */
      kodDogrulandi: boolean;
      alan: 'code' | 'password' | null;
      /** Ekranın çevireceği sabit mesaj. */
      anahtar?: TKey;
      /** Sunucudan gelen ham mesaj (ekran trError ile çevirir). */
      sunucu?: string;
      /** Sunucu mesajının ardına eklenecek açıklama. */
      ek?: TKey;
    };

/**
 * Kod + yeni şifre adımı (app/forgot-password.tsx).
 *
 * KOD BİR KEZ HARCANIR, OTURUM KALIR (09.10.2026). verifyOtp başarılı olunca
 * kod ölür ama karşılığında bir kurtarma oturumu açılır. Şifre kaydı bundan
 * sonra düşerse (aynı şifre, zayıf şifre, ağ) eski ekran ikinci denemeyi
 * "Bu kod kullanıldı; yeni bir kod isteyin" diye kesiyordu: kullanıcı geri
 * sayımı bekleyip yeni posta almak zorundaydı, oysa oturum açıktı ve yalnız
 * şifre kaydını tekrar denemek yeterliydi. Artık:
 *  - kod doğrulandıysa ve oturum hâlâ açıksa → yalnız updateUser tekrar denenir;
 *  - oturum düşmüşse → ancak o zaman yeni kod istenir.
 */
export async function yeniSifreyiKaydet(
  istemci: SifirlamaIstemcisi,
  girdi: { email: string; kod: string; sifre: string; kodDogrulandi: boolean },
): Promise<SifirlamaSonucu> {
  const { email, kod, sifre } = girdi;
  // Kod zaten doğrulandıysa kutunun boş olması önemsizdir; bir daha gönderilmeyecek.
  if (!girdi.kodDogrulandi && !kod.trim()) {
    return { tur: 'hata', kodDogrulandi: false, alan: 'code', anahtar: 'forgot.needCode' };
  }
  if (sifre.length < SIFRE_ASGARI) {
    return { tur: 'hata', kodDogrulandi: girdi.kodDogrulandi, alan: 'password', anahtar: 'auth.passwordTooShort' };
  }

  if (girdi.kodDogrulandi) {
    const { data } = await istemci.getSession();
    if (!data.session) return { tur: 'hata', kodDogrulandi: true, alan: 'code', anahtar: 'forgot.codeUsed' };
  } else {
    const { error: verifyError } = await istemci.verifyOtp({ email: email.trim(), token: kod.trim(), type: 'recovery' });
    if (verifyError) return { tur: 'hata', kodDogrulandi: false, alan: 'code', sunucu: verifyError.message };
  }

  const { error: updateError } = await istemci.updateUser({ password: sifre });
  if (updateError) {
    return { tur: 'hata', kodDogrulandi: true, alan: null, sunucu: updateError.message, ek: 'forgot.retryNoCode' };
  }
  return { tur: 'bitti', kodDogrulandi: true };
}
