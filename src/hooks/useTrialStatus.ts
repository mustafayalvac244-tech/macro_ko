import { useAuthStore } from '@/store/authStore';

/** Ücretsiz deneme süresi (gün). Tek yerden değiştirilir. */
export const TRIAL_DAYS = 7;
/** Aylık abonelik ücreti (TL). */
export const MONTHLY_PRICE_TRY = 399;
/**
 * AI katmanı aylık ücreti (TL) — 250 soru + 12 mütalaa dahil (bkz.
 * supabase/functions/_shared/katman.ts > AI_SORU_LIMIT/AI_MUTALAA_LIMIT;
 * iki sayı burada da AYNI olmalı, kota koddan, fiyat buradan okunuyor).
 */
export const AI_PRICE_TRY = 1499;
/** AI katmanının aylık soru/mütalaa hakkı — yalnız EKRANDA göstermek için;
 *  gerçek sınır sunucuda (_shared/katman.ts). */
export const AI_SORU_HAKKI = 250;
export const AI_MUTALAA_HAKKI = 12;

export interface TrialStatus {
  /** Abone mi (ödeme yaptı / premium verildi)? */
  subscribed: boolean;
  /** Deneme süresi içinde mi? */
  inTrial: boolean;
  /** Deneme bitti mi (ve abone değil)? */
  ended: boolean;
  /** Denemede kalan tam gün sayısı (0 olabilir). */
  daysLeft: number;
  /** Hesabın açıldığı an (deneme başlangıcı). */
  startedAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 7 günlük ücretsiz deneme → sonrasında aylık abonelik modeli.
 *
 * Deneme başlangıcı = hesabın açılış tarihi (Supabase auth `created_at`).
 * Sunucudan gelen güvenilir bir tarihtir; cihaz saatiyle oynanamaz.
 *
 * NOT: Şu an "yumuşak" moddayız — deneme bitince uygulama KİLİTLENMEZ, sadece
 * hatırlatma/abonelik ekranı gösterilir. Ödeme (Apple IAP) canlıya alınınca
 * sert kilide burada tek noktadan geçilebilir.
 */
export function useTrialStatus(): TrialStatus {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const subscribed = !!profile?.is_premium;

  const createdRaw = session?.user?.created_at;
  const startedAt = createdRaw ? new Date(createdRaw) : null;

  if (subscribed || !startedAt || Number.isNaN(startedAt.getTime())) {
    return {
      subscribed,
      inTrial: !subscribed,
      ended: false,
      daysLeft: subscribed ? 0 : TRIAL_DAYS,
      startedAt,
    };
  }

  const elapsedMs = Date.now() - startedAt.getTime();
  const daysLeft = Math.max(0, Math.ceil((TRIAL_DAYS * DAY_MS - elapsedMs) / DAY_MS));
  const inTrial = daysLeft > 0;

  return {
    subscribed: false,
    inTrial,
    ended: !inTrial,
    daysLeft,
    startedAt,
  };
}
