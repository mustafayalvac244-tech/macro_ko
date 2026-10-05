import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { GazeteGunu } from '@/lib/resmiGazete';

/**
 * Son 7 günün Resmî Gazete fihristi (yeniden eskiye).
 *
 * Veri sunucuda günde birkaç kez çekilir (0170, resmi-gazete işlevi);
 * uygulama kaynağa hiç gitmez, yalnız tablodan okur. Tablo boşsa (ilk tur
 * henüz koşmadıysa) boş dizi döner ve kart hiç çizilmez.
 */
export function useResmiGazete() {
  const girisli = useAuthStore((s) => !!s.session);
  return useQuery({
    queryKey: ['resmi_gazete'],
    enabled: girisli,
    // Satır günde birkaç kez değişir; her ekran açılışında okumaya gerek yok.
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<GazeteGunu[]> => {
      const { data, error } = await supabase
        .from('resmi_gazete')
        .select('tarih,sayi,maddeler,mukerrer,cekildi')
        .order('tarih', { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data ?? []) as GazeteGunu[];
    },
  });
}
