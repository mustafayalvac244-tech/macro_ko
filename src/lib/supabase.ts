import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_YAPILANDIRILDI } from '@/lib/env';
import { anonimIstekKorumasi, diskOturumunuCoz, oturumAnahtari } from '@/lib/oturumKorumasi';

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

const ADRES = supabaseUrl ?? 'https://placeholder.supabase.co';
const ANON_ANAHTAR = supabaseAnonKey ?? 'placeholder-anon-key';
/** auth-js'in oturumu sakladığı AsyncStorage anahtarı (varsayılanla aynı; bkz. oturumKorumasi). */
const OTURUM_ANAHTARI = oturumAnahtari(ADRES);

/**
 * auth-js'in cihazda tuttuğu oturum (yoksa null). auth-js oturumu YALNIZ
 * gerçekten ölünce (yenileme reddedildi, jeton süresi geçmiş) siler; ağ yüzünden
 * yenilenemeyen oturumu tutar. Çevrimdışı soğuk açılış bunu kullanır
 * (src/store/authStore.ts > initialize).
 */
export async function diskOturumu(): Promise<Session | null> {
  try {
    return diskOturumunuCoz(await AsyncStorage.getItem(OTURUM_ANAHTARI));
  } catch {
    return null;
  }
}

// Not parameterized with a generated Database type: without a live Supabase
// project there is nothing to generate types from, and a hand-maintained
// generic here fights supabase-js's strict Insert/Update inference. Query
// hooks in src/hooks/* cast results to the concrete types in
// src/types/database.ts instead.
export const supabase = createClient(ADRES, ANON_ANAHTAR, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // OTURUM AÇIKKEN İSTEK ANONİM GİTMESİN (09.10.2026). Jeton yenilenemezken
  // supabase-js isteği anonim anahtarla gönderir ve RLS hata değil BOŞ LİSTE
  // döndürür; çevrimdışı açılıştan sonra önbellek boş listeyle ezilirdi.
  // Ayrıntı: src/lib/oturumKorumasi.ts > anonimIstekKorumasi.
  global: {
    fetch: anonimIstekKorumasi((...a) => fetch(...a), ANON_ANAHTAR, async () => (await diskOturumu()) !== null),
  },
});

export const DOCUMENTS_BUCKET = 'case-documents';

/**
 * Tek dosya üst sınırı — kovadaki `file_size_limit` ile AYNI olmalı
 * (migration 0085: 26214400 bayt = 25 MB).
 *
 * NEDEN İSTEMCİDE DE VAR. Sınır yalnız sunucudaydı: 40 MB'lık taranmış bir dava
 * dosyası önce tamamen belleğe okunuyor, sonra dakikalarca yükleniyor ve en
 * sonunda sunucu reddedince kullanıcı "kaydedilemedi" gibi hiçbir şey
 * anlatmayan bir hata görüyordu. Sınırı önce burada kontrol etmek hem zamanı
 * hem mobil veriyi kurtarır, hem de doğru cümleyi söyler.
 *
 * SUNUCU YİNE DE SON SÖZDÜR: buradaki kontrol bir kolaylıktır, güvenlik
 * önlemi değil (istemci kodu değiştirilebilir). Kovadaki sınır kalkarsa
 * buradaki sayı da anlamsızlaşır — ikisi birlikte güncellenmeli.
 */
export const MAX_DOSYA_BAYT = 26214400;
