import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** UYAP Emsal'den dönen tek bir karar kaydı. */
export interface IctihatHit {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  durum: string;
}

type IctihatError = 'rate_limit' | 'source' | 'generic';

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ictihat', { body });
  if (error) {
    let code = '';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.error ?? '';
    } catch {
      // gövde okunamadı
    }
    const err = new Error(code || 'generic');
    throw err;
  }
  return data as T;
}

function mapError(e: unknown): IctihatError {
  const msg = e instanceof Error ? e.message : '';
  if (msg === 'rate_limit') return 'rate_limit';
  if (msg === 'source_unreachable') return 'source';
  return 'generic';
}

/** İçtihat arama + tekil karar metni + AI kaynaklı özet. */
export function useIctihat() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<IctihatHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setQuery(q);
    setError(null);
    setSearching(true);
    setSearched(true);
    try {
      const res = await invoke<{ hits: IctihatHit[]; total: number }>({
        action: 'search',
        query: q,
        pageSize: 15,
      });
      setHits(res.hits ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setError(mapError(e));
      setHits([]);
      setTotal(0);
    } finally {
      setSearching(false);
    }
  }, []);

  return { query, hits, total, searching, error, searched, search };
}

/** Tek bir kararın tam metnini getirir. */
export function useIctihatDocument() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);

  const load = useCallback(async (id: string) => {
    setError(null);
    setLoading(true);
    setText('');
    try {
      const res = await invoke<{ text: string }>({ action: 'document', id });
      setText(res.text ?? '');
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { text, loading, error, load };
}

/** Seçili kararları Gemini'ye kaynaklı özetletir. */
export function useIctihatSummary() {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);

  const summarize = useCallback(async (query: string, ids: string[]) => {
    if (ids.length === 0) return;
    setError(null);
    setLoading(true);
    setSummary('');
    try {
      const res = await invoke<{ summary: string }>({ action: 'summarize', query, ids });
      setSummary(res.summary ?? '');
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSummary('');
    setError(null);
  }, []);

  return { summary, loading, error, summarize, reset };
}
