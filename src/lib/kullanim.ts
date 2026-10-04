import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export { yolSade } from '@/lib/kullanimOlay';

/**
 * KULLANIM SAYACI — 03.10.2026, bkz. 0165_kullanim_sayac.
 *
 * Yalnız "gün × olay × platform" sayacı artar; kullanıcı/cihaz kimliği, metin
 * GÖNDERİLMEZ. Aynı olay bir uygulama açılışında bir kez sayılır (aynı ekrana
 * on kez dönmek akışı çarpıtmasın). Hata sessizce yutulur: ölçüm, uygulamayı
 * asla bozmamalı.
 */
const sayilan = new Set<string>();

/**
 * REKLAM KAYNAĞI — 04.10.2026. Reklam bağlantısı `/app/?utm_source=meta&utm_campaign=ekim`
 * gibi gelirse web'de BİR KEZ 'kaynak:meta/ekim' sayılır (kişi yok, sayaç).
 * "Hangi reklam kayıt getiriyor" sorusunun tek ölçüsü bu; App Store tarafı
 * App Store Connect'in kendi analitiğinde.
 */
export function reklamKaynaginiKaydet(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const sade = (v: string | null) => (v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    const kaynak = sade(q.get('utm_source'));
    if (!kaynak) return;
    const kampanya = sade(q.get('utm_campaign'));
    kullanimKaydet(`kaynak:${kaynak}${kampanya ? `/${kampanya}` : ''}`);
  } catch {
    // ölçüm uygulamayı bozmaz
  }
}

export function kullanimKaydet(olay: string): void {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
  if (!platform || sayilan.has(olay)) return;
  sayilan.add(olay);
  void supabase.rpc('kullanim_kaydet', { p_olay: olay, p_platform: platform }).then(
    () => {},
    () => {}
  );
}
