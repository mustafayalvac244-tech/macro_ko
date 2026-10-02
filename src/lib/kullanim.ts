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

export function kullanimKaydet(olay: string): void {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
  if (!platform || sayilan.has(olay)) return;
  sayilan.add(olay);
  void supabase.rpc('kullanim_kaydet', { p_olay: olay, p_platform: platform }).then(
    () => {},
    () => {}
  );
}
