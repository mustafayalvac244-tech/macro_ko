import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cihazAnahtari, cihazKunyesi } from '@/lib/cihazKimligi';
import { useAuthStore } from '@/store/authStore';
import { digerOturumlariKapat, sonZiyaretimdenBeriGirenler } from '@/utils/cihazOturum';

export interface OturumCihazi {
  id: string;
  cihaz_anahtari: string;
  ad: string | null;
  platform: string | null;
  uygulama_surumu: string | null;
  ilk_gorulme: string;
  son_gorulme: string;
}

const CIHAZ_SUTUNLARI = 'id, cihaz_anahtari, ad, platform, uygulama_surumu, ilk_gorulme, son_gorulme';

/**
 * Cihazı sunucuya bildirir; bu cihaz EN SON açıldığından beri hesaba İLK KEZ
 * giren başka bir cihaz varsa `yeniCihaz` onu (en yenisini) taşır.
 *
 * DÜZELTİLDİ (09.10.2026): uyarı eskiden cihaz_bildir'in KENDİ cihazı için
 * döndürdüğü "yeni" bayrağına bakıyordu — yani yeni giren cihazın kendisinde
 * çıkıyor, hesap sahibinin cihazlarında hiç çıkmıyordu. Artık liste,
 * cihaz_bildir bu cihazın son görülmesini now() yapmadan ÖNCE okunur ve
 * "o damgadan sonra ilk kez giren" cihazlar aranır (src/utils/cihazOturum.ts).
 * Yeni giren cihaz listede henüz olmadığı için kendini uyarmaz; uyarı bir
 * sonraki açılışta tekrar çıkmaz, çünkü damga ilerlemiş olur.
 *
 * Hata sessizce geçilir (migration 0099 uygulanmadıysa, ağ yoksa): bu bir
 * fark etme aracıdır, kullanıcının işini bölmemeli.
 */
export function useCihazBildir(): { yeniCihaz: OturumCihazi | null; kapat: () => void } {
  const session = useAuthStore((s) => s.session);
  const [yeniCihaz, setYeniCihaz] = useState<OturumCihazi | null>(null);
  const calisti = useRef(false);

  useEffect(() => {
    if (!session || calisti.current) return;
    calisti.current = true;
    let iptal = false;

    void (async () => {
      try {
        const k = await cihazKunyesi();
        // ÖNCE oku: bildirimden sonra bu cihazın son görülmesi "şimdi" olur
        // ve aradaki girişler görünmez hâle gelir.
        const { data: liste, error: okumaHatasi } = await supabase
          .from('oturum_cihazlari')
          .select(CIHAZ_SUTUNLARI);
        const { error } = await supabase.rpc('cihaz_bildir', {
          p_anahtar: k.anahtar,
          p_ad: k.ad,
          p_platform: k.platform,
          p_surum: k.surum,
        });
        if (okumaHatasi || error || iptal) return;
        const yeniler = sonZiyaretimdenBeriGirenler((liste ?? []) as OturumCihazi[], k.anahtar);
        if (yeniler[0]) setYeniCihaz(yeniler[0]);
      } catch {
        // fark etme aracı — sessiz
      }
    })();

    return () => {
      iptal = true;
    };
  }, [session]);

  return { yeniCihaz, kapat: () => setYeniCihaz(null) };
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
        .select(CIHAZ_SUTUNLARI)
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
 * SIRA (09.10.2026'da çevrildi): ÖNCE jetonlar iptal edilir, SONRA cihaz
 * kayıtları temizlenir. ASIL KONTROL signOut'tur; cihaz satırlarını silmek
 * TEK BAŞINA hiçbir oturumu kapatmaz — liste sadece bir görüntüdür. Eski
 * sırada signOut düşerse liste "yalnız bu cihaz" gösterirken saldırganın
 * oturumu açık kalıyordu (bkz. src/utils/cihazOturum.ts).
 */
export function useTumOturumlariKapat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const anahtar = await cihazAnahtari();
      await digerOturumlariKapat({
        oturumlariKapat: () => supabase.auth.signOut({ scope: 'others' }),
        // Bu cihaz hariç tümünü listeden düşür.
        listeyiTemizle: () => supabase.rpc('cihazlarimi_temizle', { p_haric: anahtar }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cihazlar'] });
    },
  });
}
