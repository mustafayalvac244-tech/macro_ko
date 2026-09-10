import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { IctihatHit } from './useIctihat';
import { caseCourt, caseSearchTerm } from '@/utils/emsalSecimi';

// Saf seçim mantığı ayrı modülde (test edilebilsin diye); buradan yeniden
// dışa veriliyor ki çağıran ekranlar tek yerden alsın.
export { caseCourt, caseSearchTerm };

/**
 * DAVANA EMSAL — avukatın kendi dosyasını, küratörlü Yargıtay içtihat bankasıyla
 * otomatik eşleştirir. Dava konusundan (case_type, yoksa başlık) bir arama terimi
 * üretir ve içtihat edge fonksiyonuna "akıllı" (tam ifade öncelikli) aramayı
 * yaptırır. Sonuç react-query ile önbelleğe alınır — corpus nadiren değiştiği için
 * aynı konu tekrar taranmaz, panel anında dolar.
 */

interface PrecedentResult {
  hits: IctihatHit[];
  total: number;
  source?: string;
}

async function fetchPrecedents(term: string, court: 'yargitay' | 'danistay'): Promise<PrecedentResult> {
  const { data, error } = await supabase.functions.invoke('ictihat', {
    body: { action: 'search', query: term, court, mode: 'smart', page: 1, pageSize: 6 },
  });
  if (error) {
    let code = '';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.error ?? '';
    } catch {
      // gövde okunamadı
    }
    throw new Error(code || 'generic');
  }
  const res = (data ?? {}) as PrecedentResult;
  return { hits: res.hits ?? [], total: res.total ?? 0, source: res.source };
}

/**
 * Verilen konu terimi için emsal kararları getirir (önbellekli).
 *
 * `court` dosyanın yargı kolundan gelir (bkz. caseCourt) — önbellek anahtarına
 * da girer, aksi hâlde idari bir dosya, daha önce görülmüş bir hukuk dosyasının
 * Yargıtay sonuçlarını önbellekten okurdu.
 */
export function useCasePrecedents(term: string, court: 'yargitay' | 'danistay' = 'yargitay') {
  const q = term.trim();
  return useQuery({
    queryKey: ['case-precedents', court, q],
    enabled: q.length >= 2,
    // Karar bankası nadiren değişir; 1 saat taze say, çevrimdışı için 24 saat sakla.
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: () => fetchPrecedents(q, court),
  });
}
