import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 15;

/** UYAP Emsal'den dönen tek bir karar kaydı. */
export interface IctihatHit {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  durum: string;
  /** Aranan kelimenin karar metnindeki geçtiği yerden kısa önizleme (varsa). */
  snippet?: string;
  /** Kararın kaynağı: UYAP Emsal (varsayılan) veya Yargıtay Karar Arama. */
  src?: 'emsal' | 'yargitay';
  /** Künye detayı: tespit edilen karar sonucu (Bozma/Onama/…). */
  outcome?: string;
  /** Künye detayı: kararın hüküm/sonuç bölümünden kısa alıntı. */
  sonuc?: string;
  /** Künye detayı: incelenen (alt derece) mahkeme bilgisi. */
  incelenen?: string;
  /** Aranan ifade kararın metninde birebir geçiyor mu (false ise ilgili/yakın). */
  matched?: boolean;
}

export type IctihatError = 'rate_limit' | 'source' | 'ai_off' | 'generic';

/** Arama mahkeme süzgeci. */
export type IctihatCourt = 'yargitay' | 'danistay' | 'emsal';

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
  if (msg === 'not_configured') return 'ai_off';
  return 'generic';
}

/** İçtihat arama + sayfalama + tekil karar metni + AI kaynaklı özet. */
export function useIctihat() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<IctihatHit[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);
  const [searched, setSearched] = useState(false);
  const pageRef = useRef(1);
  const queryRef = useRef('');
  const courtRef = useRef<IctihatCourt>('yargitay');

  const search = useCallback(async (raw: string, court: IctihatCourt = 'yargitay') => {
    const q = raw.trim();
    if (!q) return;
    queryRef.current = q;
    courtRef.current = court;
    pageRef.current = 1;
    setQuery(q);
    setError(null);
    setSearching(true);
    setSearched(true);
    setHasMore(false);
    try {
      const res = await invoke<{ hits: IctihatHit[]; total: number; source?: string }>({
        action: 'search',
        query: q,
        court,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      const list = res.hits ?? [];
      setHits(list);
      setTotal(res.total ?? 0);
      setSource(res.source ?? '');
      setHasMore(list.length > 0 && list.length < (res.total ?? 0));
    } catch (e) {
      setError(mapError(e));
      setHits([]);
      setTotal(0);
    } finally {
      setSearching(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || searching || !hasMore) return;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await invoke<{ hits: IctihatHit[]; total: number }>({
        action: 'search',
        query: queryRef.current,
        court: courtRef.current,
        page: next,
        pageSize: PAGE_SIZE,
      });
      const incoming = res.hits ?? [];
      setHits((prev) => {
        const seen = new Set(prev.map((h) => h.id));
        const merged = [...prev, ...incoming.filter((h) => !seen.has(h.id))];
        pageRef.current = next;
        setHasMore(incoming.length > 0 && merged.length < (res.total ?? total));
        return merged;
      });
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, searching, hasMore, total]);

  return { query, hits, total, source, searching, loadingMore, hasMore, error, searched, search, loadMore };
}

/** Tek bir kararın tam metnini getirir. */
export function useIctihatDocument() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);

  const load = useCallback(async (id: string, src?: 'emsal' | 'yargitay') => {
    setError(null);
    setLoading(true);
    setText('');
    try {
      const res = await invoke<{ text: string }>({ action: 'document', id, ...(src ? { src } : {}) });
      setText(res.text ?? '');
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { text, loading, error, load };
}

/**
 * KÜNYE İLE KARAR BULMA — "E.2019/3641 K.2022/1689" gibi künyesi bilinen kararı
 * doğrudan bulur (karşı tarafın atıfını doğrulamak / tam metne ulaşmak için).
 * exact: künyeyle birebir eşleşen kararlar; citing: künyeye atıf yapan kararlar.
 */
export function useIctihatKunye() {
  const [exact, setExact] = useState<IctihatHit[]>([]);
  const [citing, setCiting] = useState<IctihatHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);
  const [searched, setSearched] = useState(false);

  const lookup = useCallback(async (esas: string, karar: string, daire: string) => {
    if (!esas.trim() && !karar.trim()) return;
    setError(null);
    setLoading(true);
    setSearched(true);
    setExact([]);
    setCiting([]);
    try {
      const res = await invoke<{ exact: IctihatHit[]; citing: IctihatHit[] }>({
        action: 'kunye',
        esas: esas.trim(),
        karar: karar.trim(),
        daire: daire.trim(),
      });
      setExact(res.exact ?? []);
      setCiting(res.citing ?? []);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setExact([]);
    setCiting([]);
    setError(null);
    setSearched(false);
  }, []);

  return { exact, citing, loading, error, searched, lookup, reset };
}

/**
 * OLAY ANALİZİ — avukat olayı anlatır; AI hukuki değerlendirme + çözüm yazar ve
 * olaya uygun gerçek içtihatı bulup getirir. (Gemini gerektirir.)
 */
export function useIctihatAnalyze() {
  const [analysis, setAnalysis] = useState('');
  const [issue, setIssue] = useState('');
  const [hits, setHits] = useState<IctihatHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<IctihatError | null>(null);
  const [done, setDone] = useState(false);

  const analyze = useCallback(async (olay: string) => {
    if (olay.trim().length < 15) return;
    setError(null);
    setLoading(true);
    setDone(true);
    setAnalysis('');
    setHits([]);
    setIssue('');
    try {
      const res = await invoke<{ analysis: string; issue: string; hits: IctihatHit[] }>({
        action: 'analyze',
        olay: olay.trim(),
      });
      setAnalysis(res.analysis ?? '');
      setIssue(res.issue ?? '');
      setHits(res.hits ?? []);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysis('');
    setIssue('');
    setHits([]);
    setError(null);
    setDone(false);
  }, []);

  return { analysis, issue, hits, loading, error, done, analyze, reset };
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
