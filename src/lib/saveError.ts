import { Alert } from 'react-native';
import { router } from 'expo-router';
import { getLang, translate } from '@/i18n';
import { planLimitiCoz } from '@/config/planlar';

/**
 * Kaydetme hatalarını KULLANICIYA duyurur.
 *
 * Neden: formlar `mutateAsync` çağırıyor ama çoğu try/catch ile sarılı değildi;
 * kayıt başarısız olduğunda (çevrimdışı, yetki/RLS hatası, sunucu hatası) hata
 * sessizce yutuluyor, avukat duruşmayı "kaydettim" sanıyordu. Bir duruşmanın
 * sessizce kaydedilmemesi bu uygulamada en ağır hatadır.
 *
 * Mutasyon kancalarına `onError: notifySaveError` olarak takılır; böylece tek
 * yerden bütün çağrı noktaları korunur.
 */

/** Supabase/ağ hatasından kullanıcıya gösterilecek mesajı seçer. */
function messageFor(err: unknown): string {
  const lang = getLang();
  const e = err as { message?: string; code?: string } | null;
  const raw = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';

  // Ağ yok / istek ulaşmadı
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout')) {
    return translate(lang, 'err.saveOffline');
  }
  // Yetki (RLS) — oturum düşmüş olabilir
  if (code === '42501' || raw.includes('permission') || raw.includes('jwt') || raw.includes('row-level')) {
    return translate(lang, 'err.savePermission');
  }
  return translate(lang, 'err.saveGeneric');
}

/** react-query `onError` için hazır işleyici. */
export function notifySaveError(err: unknown): void {
  const lang = getLang();

  // PLAN LİMİTİ ayrı ele alınır: bu bir ARIZA değil, ürünün kuralıdır.
  // "Kaydedilemedi, tekrar deneyin" demek yanıltıcı olurdu — tekrar denemek
  // işe yaramaz. Kullanıcıya neyin dolduğu ve çıkış yolu söylenir.
  const limit = planLimitiCoz((err as { message?: string } | null)?.message);
  if (limit) {
    const govde =
      limit.limit === 0
        ? translate(lang, `plan.kapali.${limit.tur}` as 'plan.kapali.finans')
        : translate(lang, `plan.doldu.${limit.tur}` as 'plan.doldu.dava', { n: String(limit.limit) });
    Alert.alert(translate(lang, 'plan.limitBaslik'), govde, [
      { text: translate(lang, 'common.cancel'), style: 'cancel' },
      {
        text: translate(lang, 'plan.planlariGor'),
        onPress: () => router.push('/premium' as Parameters<typeof router.push>[0]),
      },
    ]);
    return;
  }

  Alert.alert(translate(lang, 'err.saveTitle'), messageFor(err));
}
