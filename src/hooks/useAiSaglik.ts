import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Yapay zekâ sağlayıcılarının durumu.
 *
 * NEDEN VAR. Ücretli bir üründe en kötü senaryo, "yapay zekâ çalışmıyor"
 * bilgisini müşteriden öğrenmektir. Groq'un günlük token kotası bittiğinde
 * asistan Gemini'ye düşer; iki sağlayıcı da düşerse mevzuat özetine düşer.
 * Bu uç, hangi katta olduğumuzu ÖNCEDEN gösterir.
 *
 * Anahtar hiçbir zaman istemciye gelmez; yalnız "tanımlı mı / yanıt veriyor mu".
 */
export interface SaglayiciDurumu {
  saglayici: string;
  anahtar: boolean;
  calisiyor: boolean;
  http?: number;
  neden?: string;
  ms?: number;
  model?: string;
  /** Son GERÇEK çağrının sonucu ('ok' | 'daily_quota' | 'rate_limit' | ...).
   *  Yoklama 1 token'lık istek gönderir ve günlük token tavanı dolmuşken bile
   *  geçebilir; hizmet verip veremediğini yalnız bu alan söyler. */
  gercekSonSonuc?: string | null;
  gercekSonZaman?: string | null;
  gercekSonBasari?: string | null;
}

export interface AiSaglik {
  ayakta: string[];
  /** İki sağlayıcı da ayaktaysa kota bittiğinde asistan susmaz. */
  yedekli: boolean;
  saglayicilar: SaglayiciDurumu[];
}

export function useAiSaglik(enabled: boolean) {
  return useQuery<AiSaglik>({
    queryKey: ['ai-saglik'],
    enabled,
    // Yoklama gerçek istek gönderir; sık çağırmak kotayı yer. Beş dakika
    // tazelik yeterli, panel her açıldığında yeniden yoklamaz.
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-saglik', { body: {} });
      if (error) throw error;
      return data as AiSaglik;
    },
  });
}
