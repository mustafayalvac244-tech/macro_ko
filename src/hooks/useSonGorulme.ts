import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * "SON GÖRÜLME" DAMGASI.
 *
 * NEDEN VAR. "Bu kullanıcı en son ne zaman girdi?" sorusunun güvenilir bir
 * cevabı yoktu:
 *   • auth.users.last_sign_in_at — oturum cihazda saklanıp jeton otomatik
 *     tazelendiği için çıkış yapmayan bir avukatta AYLAR öncesini gösterir.
 *   • son_islem (0095) — yalnız kayıt AÇAN kullanıcıda dolar; sadece okuyan
 *     (dosyasına bakan, duruşma listesini açan) avukat hiç görünmez.
 * Bu hook üçüncüsünü yazar: uygulama her açıldığında/öne geldiğinde.
 *
 * SESSİZ BAŞARISIZLIK BİLEREK. Çağrı başarısız olursa (ağ yok, migration 0097
 * henüz uygulanmadı) hiçbir şey yapılmaz: bu telemetridir, kullanıcının işini
 * bölmemeli. Hata yutulan TEK yer burasıdır ve sebebi budur.
 *
 * YAZMA SIKLIĞI SUNUCUDA KISILIR. Fonksiyon 30 dakikadan yeni bir damga varsa
 * yazmaz (bkz. 0097). İstemcideki `sonCagri` kontrolü yalnız gereksiz ağ
 * isteğini önlemek içindir; doğruluk sunucuya bağlıdır, istemciye değil.
 */
const EN_AZ_ARALIK_MS = 30 * 60 * 1000;

export function useSonGorulme(): void {
  const session = useAuthStore((s) => s.session);
  const sonCagri = useRef(0);

  useEffect(() => {
    if (!session) return;

    const dokun = () => {
      const simdi = Date.now();
      if (simdi - sonCagri.current < EN_AZ_ARALIK_MS) return;
      sonCagri.current = simdi;
      void supabase.rpc('son_gorulme_dokun').then(({ error }) => {
        if (error) {
          // Damga yazılamadı; sonraki denemede tekrar dene.
          sonCagri.current = 0;
        }
      });
    };

    dokun();
    const abone = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') dokun();
    });
    return () => abone.remove();
  }, [session]);
}
