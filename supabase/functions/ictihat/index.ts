// Vekil :: içtihat (case-law) retrieval + grounded AI summary.
//
// Kaynak: UYAP Emsal Karar (emsal.uyap.gov.tr) — Yargıtay, Danıştay, Bölge
// Adliye/İdare Mahkemesi kararlarının kamuya açık resmi bankası. Mahkeme
// kararları kamusal kayıttır; burada yalnızca arama/getirme yapıyoruz.
//
// Anahtarsız mimari: kullanıcı hiçbir şey girmez, giriş yapmış olması yeter.
// Gemini anahtarı sunucuda secret olarak durur (yalnızca "summarize" için).
//
// Deploy:
//   supabase functions deploy ictihat
//   (GEMINI_API_KEY zaten ai-chat için tanımlı; summarize onu kullanır)
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMSAL_BASE = 'https://emsal.uyap.gov.tr';
const MODEL_BASIC = Deno.env.get('VEKIL_MODEL_BASIC') || 'gemini-2.0-flash';
const MODEL_PLUS = Deno.env.get('VEKIL_MODEL_PLUS') || 'gemini-2.5-pro';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** UYAP getDokuman HTML'ini düz metne çevirir (Gemini'ye ve önizlemeye uygun). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Hit {
  id: string;
  daire: string;
  esasNo: string;
  kararNo: string;
  kararTarihi: string;
  durum: string;
  /** Aranan kelimenin karar metnindeki geçtiği yerden kısa önizleme. */
  snippet?: string;
  /** Kararın kaynağı: UYAP Emsal (varsayılan) veya Yargıtay Karar Arama. */
  src?: 'emsal' | 'yargitay';
}

/**
 * Aranan kelimenin karar metninde geçtiği yerden kısa bir önizleme çıkarır
 * (LEGALBANK/Lexpera tarzı) — avukat kararı açmadan konuyla ilgisini görsün.
 * Eşleşme bulunamazsa kararın giriş kısmından bir özet döner.
 */
function buildSnippet(text: string, query: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const lower = clean.toLocaleLowerCase('tr');
  // Önce tam ifade, sonra 3+ harfli tek tek kelimeler (uzun → kısa).
  const terms = [query.trim(), ...query.trim().split(/\s+/).filter((w) => w.length >= 3)]
    .map((t) => t.toLocaleLowerCase('tr'))
    .filter(Boolean);
  let idx = -1;
  for (const term of terms) {
    idx = lower.indexOf(term);
    if (idx >= 0) break;
  }
  const MAX = 240;
  if (idx < 0) {
    return clean.slice(0, MAX).trim() + (clean.length > MAX ? '…' : '');
  }
  const start = Math.max(0, idx - 90);
  const end = Math.min(clean.length, idx + 150);
  return (start > 0 ? '…' : '') + clean.slice(start, end).trim() + (end < clean.length ? '…' : '');
}

/**
 * Canlı UYAP sonuçlarına önizleme ekler: ilk `limit` kararın metnini paralel
 * çekip aranan kelimenin çevresinden kesit çıkarır. Metni çekilemeyen karar
 * sessizce önizlemesiz kalır (arama yine de sonuç döndürür).
 */
async function attachSnippets(hits: Hit[], query: string, limit = 10): Promise<void> {
  const targets = hits.slice(0, limit).filter((h) => !h.snippet && h.id);
  await Promise.all(
    targets.map(async (h) => {
      try {
        const text = await emsalDocument(h.id);
        h.snippet = buildSnippet(text, query);
      } catch {
        // önizleme alınamadı → geç
      }
    }),
  );
}

async function emsalSearch(query: string, page: number, pageSize: number): Promise<{ hits: Hit[]; total: number }> {
  const res = await fetch(`${EMSAL_BASE}/aramalist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${EMSAL_BASE}/`,
    },
    body: JSON.stringify({ data: { arananKelime: query, pageSize, pageNumber: page } }),
  });
  if (!res.ok) throw new Error(`emsal_search_${res.status}`);
  const j = await res.json();
  const rows = j?.data?.data ?? [];
  const hits: Hit[] = rows.map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    daire: String(r.daire ?? ''),
    esasNo: String(r.esasNo ?? ''),
    kararNo: String(r.kararNo ?? ''),
    kararTarihi: String(r.kararTarihi ?? ''),
    durum: String(r.durum ?? ''),
  }));
  return { hits, total: Number(j?.data?.recordsTotal ?? hits.length) };
}

async function emsalDocument(id: string): Promise<string> {
  const res = await fetch(`${EMSAL_BASE}/getDokuman?id=${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: `${EMSAL_BASE}/` },
  });
  if (!res.ok) throw new Error(`emsal_doc_${res.status}`);
  const j = await res.json();
  return htmlToText(String(j?.data ?? ''));
}

// ---------------------------------------------------------------------------
// Yargıtay Karar Arama (karararama.yargitay.gov.tr) — künye doğrulamada ikinci
// kaynak. Erişilemezse (engel/kesinti) sessizce atlanır; Emsal tek başına döner.
// ---------------------------------------------------------------------------
const YARGITAY_BASE = 'https://karararama.yargitay.gov.tr';

async function yargitaySearch(query: string, pageSize: number): Promise<Hit[]> {
  const res = await fetch(`${YARGITAY_BASE}/aramalist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${YARGITAY_BASE}/`,
    },
    body: JSON.stringify({ data: { arananKelime: query, pageSize, pageNumber: 1 } }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`yargitay_${res.status}`);
  const j = await res.json();
  const rows = j?.data?.data ?? [];
  return rows
    .map((r: Record<string, unknown>): Hit => ({
      id: String(r.id ?? ''),
      daire: String(r.daire ?? ''),
      esasNo: String(r.esasNo ?? ''),
      kararNo: String(r.kararNo ?? ''),
      kararTarihi: String(r.kararTarihi ?? ''),
      durum: String(r.durum ?? ''),
      src: 'yargitay' as const,
    }))
    .filter((h: Hit) => h.id);
}

async function yargitayDocument(id: string): Promise<string> {
  const res = await fetch(`${YARGITAY_BASE}/getDokuman?id=${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: `${YARGITAY_BASE}/` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`yargitay_doc_${res.status}`);
  const j = await res.json();
  return htmlToText(String(j?.data ?? ''));
}

/** "E.2019/3641", "2019 / 3641", "2019-3641" → "2019/3641"; geçersizse ''. */
function normalizeKunyeNo(raw: string): string {
  const m = (raw ?? '').match(/(\d{4})\s*[/\-.]\s*(\d{1,6})/);
  return m ? `${m[1]}/${m[2]}` : '';
}

const EMBED_MODEL = 'text-embedding-004';

/** Soruyu Gemini ile vektöre çevirir (semantik havuz araması için). null=anahtar yok/başarısız. */
async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 2000) }] } }),
      }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.embedding?.values ?? null;
  } catch {
    return null;
  }
}

/** Havuz RPC satırını uygulama Hit şekline çevirir. */
// deno-lint-ignore no-explicit-any
function rowToHit(r: any): Hit {
  return {
    id: String(r.id ?? ''),
    daire: String(r.daire ?? ''),
    esasNo: String(r.esas_no ?? ''),
    kararNo: String(r.karar_no ?? ''),
    kararTarihi: String(r.karar_tarihi ?? ''),
    durum: String(r.durum ?? ''),
  };
}

async function geminiSummary(query: string, docs: Array<{ hit: Hit; text: string }>, model: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('not_configured');

  // Her kararın metnini token için sınırlayıp kaynak etiketiyle veriyoruz;
  // Gemini yalnızca bu gerçek kararlara atıf yapacak.
  const corpus = docs
    .map((d, i) => {
      const label = `[${i + 1}] ${d.hit.daire} — E.${d.hit.esasNo} K.${d.hit.kararNo} (${d.hit.kararTarihi})`;
      return `${label}\n${d.text.slice(0, 6000)}`;
    })
    .join('\n\n----\n\n');

  const system =
    'Sen "Vekil AI" adlı hukuk asistanısın. Sana verilen GERÇEK mahkeme kararlarını ' +
    'kullanarak avukatın sorusunu yanıtla. YALNIZCA verilen kararlardaki bilgilere dayan; ' +
    'karar metinlerinde olmayan hiçbir içtihat, madde veya sonuç UYDURMA. Atıf yaparken ' +
    'kararı [1], [2] gibi numaralarıyla ve daire + esas/karar no ile belirt. Kısa, mesleki ' +
    'Türkçe yaz. Sonuna, bunun hukuki tavsiye olmadığını ve kararların güncelliğinin teyit ' +
    'edilmesi gerektiğini ekle.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `SORU: ${query}\n\nİLGİLİ KARARLAR:\n\n${corpus}` }],
          },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
      }),
    }
  );
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limit' : 'upstream');
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('empty');
  return text.trim();
}

/**
 * OLAY ANALİZİ — 1. adım: avukatın anlattığı olaydan, UYAP Emsal'de içtihat
 * aramak için en isabetli Türkçe arama terimlerini ve hukuki nitelendirmeyi üretir.
 */
async function geminiPlan(olay: string, model: string): Promise<{ issue: string; queries: string[] }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('not_configured');

  const system =
    'Sen Türk hukukunda uzman bir asistansın. Avukatın anlattığı somut olayı hukuken nitelendir ve ' +
    'UYAP Emsal içtihat bankasında ARAMA yapmak için en isabetli 3 Türkçe arama terimi üret. ' +
    'Terimler kısa olsun (2-5 kelime), dava türü/kurum/kavram içersin (ör. "gerçek olmayan ihtiyaç tahliye"). ' +
    'SADECE şu JSON formatında yanıt ver: {"issue":"kısa hukuki nitelendirme","queries":["terim1","terim2","terim3"]}';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `OLAY:\n${olay.slice(0, 4000)}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limit' : 'upstream');
  const j = await res.json();
  const raw = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  try {
    const parsed = JSON.parse(raw);
    const queries = Array.isArray(parsed.queries) ? parsed.queries.map((q: unknown) => String(q)).filter(Boolean).slice(0, 3) : [];
    return { issue: String(parsed.issue ?? ''), queries };
  } catch {
    return { issue: '', queries: [] };
  }
}

/**
 * OLAY ANALİZİ — son adım: olaya göre hukuki değerlendirme + çözüm önerisi yazar
 * ve verilen GERÇEK kararlardan olaya en uygun olanları kaynak göstererek işaret eder.
 */
async function geminiAnalyze(
  olay: string,
  issue: string,
  docs: Array<{ hit: Hit; text: string }>,
  model: string
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('not_configured');

  const corpus = docs
    .map((d, i) => {
      const label = `[${i + 1}] ${d.hit.daire} — E.${d.hit.esasNo} K.${d.hit.kararNo} (${d.hit.kararTarihi})`;
      return `${label}\n${d.text.slice(0, 4500)}`;
    })
    .join('\n\n----\n\n');

  const system =
    'Sen "Vekil AI" adlı, Türk hukukunda uzman bir asistansın. Avukatın anlattığı somut olaya göre şu ' +
    'yapıda, mesleki Türkçe bir analiz yaz:\n' +
    '1) HUKUKİ DEĞERLENDİRME: olayın hukuki nitelendirmesi, uygulanacak temel kurallar (madde no varsa belirt).\n' +
    '2) ÇÖZÜM / STRATEJİ: avukatın atması gereken adımlar, dikkat noktaları.\n' +
    '3) OLAYA UYGUN İÇTİHAT: aşağıda verilen GERÇEK kararlardan olaya en uygun olanları [1],[2] şeklinde ' +
    'atıfla ve HER BİRİ İÇİN olaya neden uyduğunu tek cümleyle açıkla.\n' +
    'YALNIZCA verilen kararlara atıf yap; listede olmayan karar/esas no UYDURMA. Uygun karar yoksa dürüstçe söyle. ' +
    'Sonuna, bunun hukuki tavsiye olmadığını ve kararların güncelliğinin teyit edilmesi gerektiğini ekle.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `OLAY:\n${olay.slice(0, 4000)}\n\nÖN NİTELENDİRME: ${issue}\n\nADAY KARARLAR:\n\n${corpus}` }],
          },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );
  if (!res.ok) throw new Error(res.status === 429 ? 'rate_limit' : 'upstream');
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('empty');
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Yalnızca giriş yapmış Vekil kullanıcıları.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: {
    action?: 'search' | 'document' | 'summarize' | 'analyze' | 'kunye';
    query?: string;
    olay?: string;
    id?: string;
    ids?: string[];
    page?: number;
    pageSize?: number;
    /** Künye araması: esas no ("2019/3641"), karar no ("2022/1689"), daire süzgeci. */
    esas?: string;
    karar?: string;
    daire?: string;
    /** document: kaynağı belirtir (emsal varsayılan). */
    src?: 'emsal' | 'yargitay';
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    const action = body.action ?? 'search';

    if (action === 'search') {
      const query = (body.query ?? '').trim();
      if (!query) return json({ error: 'bad_request' }, 400);
      const pageSize = Math.min(20, Math.max(1, Number(body.pageSize ?? 15)));
      const page = Math.max(1, Number(body.page ?? 1));

      // Sayfa 2+ : sayfalama yalnız canlı UYAP Emsal üzerinden (havuz sayfa 1'de karışır).
      if (page > 1) {
        const live = await emsalSearch(query, page, pageSize);
        await attachSnippets(live.hits, query);
        return json({ hits: live.hits, total: live.total, page, source: 'live' });
      }

      // 1) Kendi havuzumuz — önce semantik (embedding varsa), sonra anahtar-kelime (FTS).
      const seen = new Set<string>();
      const hits: Hit[] = [];
      const pushRows = (rows: unknown[]) => {
        for (const r of rows ?? []) {
          const h = rowToHit(r);
          if (h.id && !seen.has(h.id)) {
            // Havuzda tam metin varsa önizlemeyi bedavaya çıkar (canlı çekmeye gerek yok).
            const ft = (r as Record<string, unknown>)?.full_text;
            if (ft) h.snippet = buildSnippet(String(ft), query);
            seen.add(h.id);
            hits.push(h);
          }
        }
      };

      const qEmb = await embedQuery(query);
      if (qEmb) {
        const { data } = await supabase.rpc('match_ictihat_semantic', { q_embedding: qEmb, match_count: pageSize });
        pushRows(data ?? []);
      }
      if (hits.length < pageSize) {
        const { data } = await supabase.rpc('search_ictihat_fts', { q: query, match_count: pageSize });
        pushRows(data ?? []);
      }

      // 2) Havuz yetersizse canlı UYAP Emsal'den tamamla (dedupe).
      let total = hits.length;
      let source = 'corpus';
      if (hits.length < 8) {
        try {
          const live = await emsalSearch(query, 1, pageSize);
          pushRows(live.hits);
          total = live.total;
          source = hits.length > live.hits.length ? 'hybrid' : 'live';
        } catch (e) {
          // Havuzda bir şey varsa canlı hatayı yutup havuzu döneriz.
          if (hits.length === 0) throw e;
        }
      }

      const paged = hits.slice(0, pageSize);
      // Canlı gelen (havuzda tam metni olmayan) kararlara önizleme ekle.
      await attachSnippets(paged, query);
      return json({ hits: paged, total, page: 1, source });
    }

    // KÜNYE İLE KARAR BULMA — karşı tarafın atıf yaptığı kararı doğrulamak,
    // sadece künyesi bilinen kararın tam metnine ulaşmak için. Tırnaklı arama +
    // sunucuda tam eşleşme süzmesi; eşleşmeyenler "atıf yapan kararlar" olur.
    if (action === 'kunye') {
      const esas = normalizeKunyeNo(body.esas ?? '');
      const karar = normalizeKunyeNo(body.karar ?? '');
      const daireFilter = (body.daire ?? '').trim().toLocaleLowerCase('tr');
      if (!esas && !karar) return json({ error: 'bad_request' }, 400);

      // Dar terimle ara (esas varsa esas): tırnaklı arama tam ifadeyi bulur.
      // Yargıtay Karar Arama Emsal taramasıyla PARALEL koşar (erişilemezse boş
      // döner) — seri beklemek toplam süreyi timeout kadar uzatıyordu.
      const term = esas || karar;
      const ygPromise: Promise<Hit[]> = yargitaySearch(`"${term}"`, 20).catch(() => []);
      const collected: Hit[] = [];
      const seen = new Set<string>();
      for (let p = 1; p <= 3; p++) {
        const { hits: rows, total } = await emsalSearch(`"${term}"`, p, 20);
        for (const h of rows) {
          if (h.id && !seen.has(h.id)) {
            seen.add(h.id);
            collected.push(h);
          }
        }
        if (collected.length >= total || rows.length === 0) break;
      }
      for (const h of await ygPromise) {
        const key = `yg-${h.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(h);
        }
      }

      const matches = (h: Hit) =>
        (!esas || h.esasNo === esas) &&
        (!karar || h.kararNo === karar) &&
        (!daireFilter || h.daire.toLocaleLowerCase('tr').includes(daireFilter));
      const exact = collected.filter(matches);
      const citing = collected.filter((h) => !matches(h)).slice(0, 10);

      // Önizlemeler: tam eşleşmede kararın girişi, atıf yapanlarda künyenin
      // geçtiği yer (karşı taraf "cımbızla mı çekmiş" oradan görülür).
      await Promise.all(
        [...exact.slice(0, 3), ...citing.slice(0, 8)].map(async (h) => {
          try {
            const text = h.src === 'yargitay' ? await yargitayDocument(h.id) : await emsalDocument(h.id);
            h.snippet = buildSnippet(text, term);
          } catch {
            // önizleme alınamadı → geç
          }
        }),
      );

      return json({ esas, karar, exact, citing });
    }

    if (action === 'document') {
      const id = (body.id ?? '').trim();
      if (!id) return json({ error: 'bad_request' }, 400);
      // Yargıtay kaynaklı karar doğrudan oradan okunur (havuzda tutulmaz).
      if (body.src === 'yargitay') {
        const text = await yargitayDocument(id);
        return json({ id, text });
      }
      // Havuzda varsa oradan (hızlı, canlı bağımlılığı yok), yoksa Emsal'den.
      const { data: row } = await supabase
        .from('ictihat_kararlar')
        .select('full_text')
        .eq('id', id)
        .maybeSingle();
      const text = row?.full_text ? String(row.full_text) : await emsalDocument(id);
      return json({ id, text });
    }

    if (action === 'summarize') {
      const query = (body.query ?? '').trim();
      const ids = (body.ids ?? []).slice(0, 4);
      if (!query || ids.length === 0) return json({ error: 'bad_request' }, 400);

      // Önce havuzdan metin+meta (varsa), eksik kalanı canlı Emsal'den çek.
      const { data: corpusRows } = await supabase
        .from('ictihat_kararlar')
        .select('id,daire,esas_no,karar_no,karar_tarihi,durum,full_text')
        .in('id', ids);
      // deno-lint-ignore no-explicit-any
      const corpus = new Map<string, any>((corpusRows ?? []).map((r: any) => [String(r.id), r]));

      const docs: Array<{ hit: Hit; text: string }> = [];
      for (const id of ids) {
        const c = corpus.get(id);
        if (c?.full_text) {
          docs.push({ hit: rowToHit(c), text: String(c.full_text) });
          continue;
        }
        try {
          const text = await emsalDocument(id);
          if (text) docs.push({ hit: { id, daire: '', esasNo: '', kararNo: '', kararTarihi: '', durum: '' }, text });
        } catch {
          // ulaşılamayan kararı atla
        }
      }
      if (docs.length === 0) return json({ error: 'empty' }, 502);
      // Üyelik katmanı: Plus (is_premium) güçlü Pro modeliyle özetler.
      let tier: 'basic' | 'plus' = 'basic';
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', userData.user.id)
          .maybeSingle();
        if (prof?.is_premium) tier = 'plus';
      } catch {
        // Basic'te kal
      }
      const summary = await geminiSummary(query, docs, tier === 'plus' ? MODEL_PLUS : MODEL_BASIC);
      return json({ summary, count: docs.length, tier });
    }

    // OLAY ANALİZİ — avukat olayı anlatır; AI hukuki değerlendirme + çözüm yazar ve
    // olaya uygun GERÇEK içtihatı bulup getirir (kelime araması değil, akıl yürütme).
    if (action === 'analyze') {
      const olay = (body.olay ?? '').trim();
      if (olay.length < 15) return json({ error: 'bad_request' }, 400);

      // Üyelik katmanı.
      let tier: 'basic' | 'plus' = 'basic';
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', userData.user.id)
          .maybeSingle();
        if (prof?.is_premium) tier = 'plus';
      } catch {
        // Basic'te kal
      }
      const model = tier === 'plus' ? MODEL_PLUS : MODEL_BASIC;

      // 1) Olaydan arama terimleri üret.
      const plan = await geminiPlan(olay, model);
      const queries = plan.queries.length > 0 ? plan.queries : [olay.slice(0, 60)];

      // 2) Her terimle gerçek kararları topla (havuz + canlı), dedupe, sınırla.
      const seen = new Set<string>();
      const candidates: Hit[] = [];
      for (const q of queries) {
        if (candidates.length >= 8) break;
        try {
          const { data: ftsRows } = await supabase.rpc('search_ictihat_fts', { q, match_count: 4 });
          for (const r of ftsRows ?? []) {
            const h = rowToHit(r);
            if (h.id && !seen.has(h.id)) { seen.add(h.id); candidates.push(h); }
          }
        } catch { /* havuz yoksa geç */ }
        try {
          const live = await emsalSearch(q, 1, 5);
          for (const h of live.hits) {
            if (h.id && !seen.has(h.id) && candidates.length < 10) { seen.add(h.id); candidates.push(h); }
          }
        } catch { /* canlı ulaşılamazsa geç */ }
      }
      if (candidates.length === 0) return json({ error: 'empty' }, 502);

      // 3) En fazla 6 kararın gerçek metnini çek (havuz önce), AI'a ver.
      const top = candidates.slice(0, 6);
      const ids = top.map((h) => h.id);
      const { data: corpusRows } = await supabase
        .from('ictihat_kararlar')
        .select('id,full_text')
        .in('id', ids);
      // deno-lint-ignore no-explicit-any
      const corpusText = new Map<string, string>((corpusRows ?? []).map((r: any) => [String(r.id), String(r.full_text ?? '')]));

      const docs: Array<{ hit: Hit; text: string }> = [];
      for (const h of top) {
        let text = corpusText.get(h.id) ?? '';
        if (!text) {
          try { text = await emsalDocument(h.id); } catch { text = ''; }
        }
        if (text) docs.push({ hit: h, text });
      }
      if (docs.length === 0) return json({ error: 'empty' }, 502);

      // 4) Olaya göre analiz + olaya uygun içtihat.
      const analysis = await geminiAnalyze(olay, plan.issue, docs, model);
      // Uygulamaya, analizde kullanılan kararları (dokunup okunabilsin diye) döndür.
      return json({ analysis, issue: plan.issue, queries, hits: docs.map((d) => d.hit), tier });
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream';
    if (msg === 'rate_limit') return json({ error: 'rate_limit' }, 429);
    if (msg === 'not_configured') return json({ error: 'not_configured' }, 503);
    // Kaynak siteye ulaşılamazsa (geo/WAF) net bir kod dönelim.
    return json({ error: 'source_unreachable', detail: msg }, 502);
  }
});
