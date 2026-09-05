import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_YAPILANDIRILDI } from '@/lib/env';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Yapılandırma eksikse istemci "placeholder.supabase.co" adresine bağlanır ve
 * HER istek ağ hatasıyla düşer. Kullanıcıya görünen mesaj ise "İnternet
 * bağlantısı kurulamadı" olur — yani BAĞLANTI SORUNU sanılır, oysa sebep
 * yapılandırmadır. Web derlemesi bu tuzağa birebir düştü: paket .env olmadan
 * üretildiğinde giriş ekranı çalışıyor görünüp her denemede ağ hatası verdi.
 * Bayrak, hata metnini doğru sebebe çevirmek için dışa verilir.
 */
if (!SUPABASE_YAPILANDIRILDI) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. ' +
      '.env.example dosyasını .env olarak kopyalayıp proje bilgilerinizi yazın; ' +
      'aksi hâlde tüm istekler ağ hatası gibi görünür.'
  );
}

// Not parameterized with a generated Database type: without a live Supabase
// project there is nothing to generate types from, and a hand-maintained
// generic here fights supabase-js's strict Insert/Update inference. Query
// hooks in src/hooks/* cast results to the concrete types in
// src/types/database.ts instead.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export const DOCUMENTS_BUCKET = 'case-documents';
