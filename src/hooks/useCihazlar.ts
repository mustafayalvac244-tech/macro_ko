import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cihazAnahtari, cihazKunyesi } from '@/lib/cihazKimligi';
import { useAuthStore } from '@/store/authStore';

export interface OturumCihazi {
  id: string;
  cihaz_anahtari: string;
  ad: string | null;
  platform: string | null;
  uygulama_surumu: string | null;
  ilk_gorulme: string;
  son_gorulme: string;
}

interface BildirimSonucu {
  yeni: boolean;
  ilk_cihaz: boolean;
  toplam: number;
}

/**
 * Cihazı sunucuya bildirir; YENİ bir cihazsa `yeniCihaz` true döner.
 *
 * Uyarı YALNIZ ikinci ve sonraki cihazlarda çıkar: ilk kurulumda "yeni
 * cihazdan giriş yapıldı" demek anlamsız ve korkutucu olurdu.
 *
 * Hata sessizce geçilir (migration 0099 uygulanmadıysa, ağ yoksa): bu bir
 * fark etme aracıdır, kullanıcının işini bölmemeli.
 */
export function useCihazBildir(): { yeniCihaz: boolean; kapat: () => void } {
  const session = useAuthStore((s) => s.session);
  const [yeniCihaz, setYeniCihaz] = useState(false);
  const calisti = useRef(false);

  useEffect(() => {
    if (!session || calisti.current) return;
    calisti.current = true;
    let iptal = false;

    void (async () => {
      try {
        const k = await cihazKunyesi();
        const { data, error } = await supabase.rpc('cihaz_bildir', {
          p_anahtar: k.anahtar,
          p_ad: k.ad,
          p_platform: k.platform,
          p_surum: k.surum,
        });
        if (error || iptal) return;
        const s = data as BildirimSonucu | null;
        if (s?.yeni && !s.ilk_cihaz) setYeniCihaz(true);
      } catch {
        // fark etme aracı — sessiz
      }
    })();

    return () => {
      iptal = true;
    };
  }, [session]);

  return { yeniCihaz, kapat: () => setYeniCihaz(false) };
}

/** Kullanıcının kendi cihaz listesi (Ayarlar ekranı). */
export function useCihazlarim() {
  const ownerId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['cihazlar', ownerId],
    enabled: !!ownerId,
    staleTime: 60_000,
    queryFn: async (): Promise<OturumCihazi[]> => {
      const { data, error } = await supabase
        .from('oturum_cihazlari')
        .select('id, cihaz_anahtari, ad, platform, uygulama_surumu, ilk_gorulme, son_gorulme')
        .order('son_gorulme', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OturumCihazi[];
    },
  });
}

/**
 * "Bu ben değilim" — DİĞER oturumları kapatır, bu cihaz açık kalır.
 *
 * scope: 'others' kullanılıyor ('global' DEĞİL): global, kullanıcının kendi
 * oturumunu da düşürür ve avukat tam da paniklediği anda uygulamadan atılırdı.
 * 'others' yalnız diğer yenileme jetonlarını iptal eder — saldırganın oturumu
 * düşer, kullanıcı kaldığı yerden devam eder.
 * (supabase/auth-js types.d.ts:1555 — scope?: 'global' | 'local' | 'others')
 *
 * SIRA ÖNEMLİ: önce cihaz kayıtları temizlenir, sonra jetonlar iptal edilir.
 * ASIL KONTROL signOut'tur; cihaz satırlarını silmek TEK BAŞINA hiçbir oturumu
 * kapatmaz — liste sadece bir görüntüdür.
 */
export function useTumOturumlariKapat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const anahtar = await cihazAnahtari();
      // Bu cihaz hariç tümünü listeden düşür.
      await supabase.rpc('cihazlarimi_temizle', { p_haric: anahtar });
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cihazlar'] });
    },
  });
}
