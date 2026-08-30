import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { IctihatHit } from './useIctihat';

/**
 * DAVANA EMSAL — avukatın kendi dosyasını, küratörlü Yargıtay içtihat bankasıyla
 * otomatik eşleştirir. Dava konusundan (case_type, yoksa başlık) bir arama terimi
 * üretir ve içtihat edge fonksiyonuna "akıllı" (tam ifade öncelikli) aramayı
 * yaptırır. Sonuç react-query ile önbelleğe alınır — corpus nadiren değiştiği için
 * aynı konu tekrar taranmaz, panel anında dolar.
 */

/** Dosyanın konusundan temiz bir içtihat arama terimi çıkarır. */
export function caseSearchTerm(c: { case_type?: string | null; title?: string | null } | null | undefined): string {
  if (!c) return '';
  // case_type en temiz sinyal ("İşçilik Alacağı", "Kira Tespiti"…). Yoksa başlığı,
  // esas/karar numaralarını ve taraf ekini ayıklayarak kullan.
  const primary = (c.case_type ?? '').trim();
  if (primary) return primary;
  let title = (c.title ?? '').trim();
  // "2023/145", "E.2023/145" gibi dosya/esas numaralarını at.
  title = title.replace(/\b[EK]\.?\s*\d{2,4}\s*\/\s*\d+/gi, ' ');
  title = title.replace(/\b\d{2,4}\s*\/\s*\d+\b/g, ' ');
  // Fazla boşlukları sadeleştir.
  return title.replace(/\s{2,}/g, ' ').trim();
}

interface PrecedentResult {
  hits: IctihatHit[];
  total: number;
  source?: string;
}

async function fetchPrecedents(term: string): Promise<PrecedentResult> {
  const { data, error } = await supabase.functions.invoke('ictihat', {
    body: { action: 'search', query: term, court: 'yargitay', mode: 'smart', page: 1, pageSize: 6 },
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

/** Verilen konu terimi için emsal Yargıtay kararlarını getirir (önbellekli). */
export function useCasePrecedents(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['case-precedents', q],
    enabled: q.length >= 2,
    // Karar bankası nadiren değişir; 1 saat taze say, çevrimdışı için 24 saat sakla.
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: () => fetchPrecedents(q),
  });
}
