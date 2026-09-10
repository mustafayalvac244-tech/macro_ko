import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * AI kontörü (ön ödemeli bakiye).
 *
 * NEDEN KONTÖR. Aylık sabit ücret iki şeyi çözmüyordu: ayda üç dilekçe yazan
 * avukat, otuz dilekçe yazanla aynı parayı veriyordu; ve ücretsiz sağlayıcının
 * günlük tavanı TÜM kullanıcılar için ortak olduğundan "sınırsız" demek
 * tutamayacağımız bir söz olurdu. Kontörde kullandığın kadar ödersin, biz de
 * ancak sattığımız kadar hizmet vermeyi taahhüt ederiz.
 *
 * Bakiyeyi yalnız sunucu değiştirir; kullanıcı kendi bakiyesini yalnız OKUR.
 */
export interface AiKontor {
  bakiye_try: number;
  toplam_yuklenen_try: number;
  toplam_harcanan_try: number;
}

export function useAiKontor(enabled = true) {
  return useQuery<AiKontor>({
    queryKey: ['ai-kontor'],
    enabled,
    // Bakiye her istekte değişiyor; kısa tazelik doğru davranış.
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_kontor')
        .select('bakiye_try, toplam_yuklenen_try, toplam_harcanan_try')
        .maybeSingle();
      if (error) throw error;
      // Hiç kontör yüklenmemiş kullanıcının satırı yoktur; sıfır bakiye demektir.
      return (data as AiKontor | null) ?? { bakiye_try: 0, toplam_yuklenen_try: 0, toplam_harcanan_try: 0 };
    },
  });
}

/** Bir isteğin ne kadar tuttuğu — yanıtla birlikte gelir. */
export interface AiKullanim {
  model: string;
  girdiToken: number;
  ciktiToken: number;
  maliyetTL: number;
}
