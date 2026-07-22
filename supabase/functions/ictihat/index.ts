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
    action?: 'search' | 'document' | 'summarize';
    query?: string;
    id?: string;
    ids?: string[];
    page?: number;
    pageSize?: number;
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

      // 1) Kendi havuzumuz — önce semantik (embedding varsa), sonra anahtar-kelime (FTS).
      const seen = new Set<string>();
      const hits: Hit[] = [];
      const pushRows = (rows: unknown[]) => {
        for (const r of rows ?? []) {
          const h = rowToHit(r);
          if (h.id && !seen.has(h.id)) {
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

      return json({ hits: hits.slice(0, pageSize), total, source });
    }

    if (action === 'document') {
      const id = (body.id ?? '').trim();
      if (!id) return json({ error: 'bad_request' }, 400);
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

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream';
    if (msg === 'rate_limit') return json({ error: 'rate_limit' }, 429);
    if (msg === 'not_configured') return json({ error: 'not_configured' }, 503);
    // Kaynak siteye ulaşılamazsa (geo/WAF) net bir kod dönelim.
    return json({ error: 'source_unreachable', detail: msg }, 502);
  }
});
