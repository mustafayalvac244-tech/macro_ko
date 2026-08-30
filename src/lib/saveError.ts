import { Alert } from 'react-native';
import { getLang, translate } from '@/i18n';

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
  Alert.alert(translate(getLang(), 'err.saveTitle'), messageFor(err));
}
