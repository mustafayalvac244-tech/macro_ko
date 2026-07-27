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

// ── AI MALİYET ÖLÇÜMÜ + KATMAN TAVANI (batma koruması) ──────────────────────
// Her AI çağrısının token maliyeti hesaplanıp ai_usage'a yazılır; çağrıdan önce
// kullanıcının bu-ay maliyeti katman tavanını aşmışsa çağrı engellenir.
const USD_TRY = Number(Deno.env.get('VEKIL_USD_TRY') || '42');
const PRICING: Record<string, { in: number; out: number }> = {
  'gemini-2.0-flash': { in: 0.15, out: 0.60 }, // USD / 1M token (temkinli)
  'gemini-2.5-pro': { in: 1.25, out: 10.0 },
};
interface TierCfg { model: string; ceilingTry: number }
function tierConfig(aiTier: string | null | undefined, isPremium: boolean): { tier: string; cfg: TierCfg } {
  const t = aiTier || (isPremium ? 'pro' : 'free');
  const table: Record<string, TierCfg> = {
    free: { model: MODEL_BASIC, ceilingTry: 15 },
    baslangic: { model: 'gemini-2.0-flash', ceilingTry: 150 },
    pro: { model: MODEL_PLUS, ceilingTry: 450 },
    elit: { model: MODEL_PLUS, ceilingTry: 1500 },
  };
  return { tier: t, cfg: table[t] ?? table.free };
}
function costTry(model: string, tin: number, tout: number): number {
  const p = PRICING[model] ?? PRICING['gemini-2.5-pro'];
  return ((tin / 1e6) * p.in + (tout / 1e6) * p.out) * USD_TRY;
}
function aiPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
async function usageThisMonth(userId: string): Promise<number> {
  const s = svc();
  if (!s) return 0;
  const { data } = await s.from('ai_usage').select('cost_try').eq('user_id', userId).eq('period', aiPeriod()).maybeSingle();
  return Number((data as { cost_try?: number } | null)?.cost_try ?? 0);
}
async function recordUsage(userId: string, model: string, tin: number, tout: number): Promise<void> {
  const s = svc();
  if (!s) return;
  const cost = costTry(model, tin, tout);
  const p = aiPeriod();
  const { data } = await s.from('ai_usage').select('calls,tokens_in,tokens_out,cost_try').eq('user_id', userId).eq('period', p).maybeSingle();
  const prev = data as { calls?: number; tokens_in?: number; tokens_out?: number; cost_try?: number } | null;
  await s.from('ai_usage').upsert({
    user_id: userId,
    period: p,
    calls: (prev?.calls ?? 0) + 1,
    tokens_in: (prev?.tokens_in ?? 0) + tin,
    tokens_out: (prev?.tokens_out ?? 0) + tout,
    cost_try: Number(prev?.cost_try ?? 0) + cost,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period' });
}
type Meter = { tin: number; tout: number };
// deno-lint-ignore no-explicit-any
function meterAdd(m: Meter, j: any): void {
  m.tin += j?.usageMetadata?.promptTokenCount ?? 0;
  m.tout += j?.usageMetadata?.candidatesTokenCount ?? 0;
}

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
  /** Künye detayı: tespit edilen karar sonucu (Bozma/Onama/…). */
  outcome?: string;
  /** Künye detayı: kararın hüküm/sonuç bölümünden kısa alıntı. */
  sonuc?: string;
  /** Künye detayı: incelenen (alt derece) mahkeme bilgisi. */
  incelenen?: string;
  /** Aranan ifade kararın metninde birebir geçiyor mu (arama motoru bazen
   *  ilgili/köke yakın kararlar da döndürüyor). undefined=önizleme çekilmedi. */
  matched?: boolean;
}

/**
 * Karar metninden kural-tabanlı (AI'sız) hızlı analiz: operatif sonuç
 * (Bozma/Onama/…), hüküm bölümü alıntısı ve incelenen alt derece mahkeme.
 * Sonuç tespiti kararın SON kısmından (hüküm fıkrası) yapılır — metnin
 * ortasındaki geçişlerden etkilenmez.
 */
function analyzeDecision(text: string): { outcome?: string; sonuc?: string; incelenen?: string } {
  if (!text) return {};
  const clean = text.replace(/\s+/g, ' ').trim();
  const low = clean.toLocaleLowerCase('tr');

  // Hüküm/sonuç bölümü: son "sonuç" işaretinden itibaren, yoksa son 380 karakter.
  const mk = low.lastIndexOf('sonuç');
  const rawSonuc = mk >= 0 ? clean.slice(mk, mk + 420) : clean.slice(-380);
  const sonuc = rawSonuc ? (mk > 0 ? '' : '…') + rawSonuc.trim() + '…' : undefined;

  // Operatif sonucu kararın son bölümünden (hüküm fıkrası) tespit et.
  const tail = low.slice(-1200);
  const has = (s: string) => tail.includes(s);
  let outcome: string | undefined;
  if (has('düzeltilerek onan')) outcome = 'Düzeltilerek Onama';
  else if (has('kısmen') && (has('bozulmasına') || has('bozulması'))) outcome = 'Kısmen Bozma';
  else if (has('bozulmasına') || has('bozulması')) outcome = 'Bozma';
  else if (has('onanmasına') || has('onanmasi') || has('onanması') || has('onandığ')) outcome = 'Onama';
  else if (has('kaldırılmasına')) outcome = 'Kaldırma (istinaf)';
  else if (has('esastan') && has('reddine')) outcome = 'İstinaf Başvurusu Reddi';
  else if (has('kabulüne')) outcome = 'Kabul';
  else if (has('reddine')) outcome = 'Ret';

  // İncelenen alt derece mahkeme (varsa).
  let incelenen: string | undefined;
  const im = clean.match(/İNCELENEN KARARIN MAHKEMESİ\s*:?\s*([^\n]{3,80}?)(?:\s{2,}|TARİHİ|NUMARASI|SAYISI|$)/i);
  if (im) incelenen = im[1].trim();

  return { outcome, sonuc, incelenen };
}

/** Türkçe küçük harf + şapkalı harf katlaması (â→a, î→i, û→u). Uzunluk korunur,
 *  böylece katlanmış metindeki indeks orijinal metinde aynı yeri gösterir. */
function foldTr(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
}

/** Aranan ifadenin (veya 3+ harfli kelimelerinden birinin) metinde geçtiği ilk
 *  konumu döndürür; hiç geçmiyorsa -1. */
function findTermIndex(foldedText: string, query: string): number {
  const terms = [query.trim(), ...query.trim().split(/\s+/).filter((w) => w.length >= 3)]
    .map(foldTr)
    .filter(Boolean);
  for (const term of terms) {
    const i = foldedText.indexOf(term);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Aranan kelimenin karar metninde geçtiği yerden kısa bir önizleme çıkarır
 * (LEGALBANK/Lexpera tarzı) — avukat kararı açmadan konuyla ilgisini görsün.
 * Eşleşme bulunamazsa kararın giriş kısmından bir özet döner.
 */
function buildSnippet(text: string, query: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const idx = findTermIndex(foldTr(clean), query);
  const MAX = 240;
  if (idx < 0) {
    return clean.slice(0, MAX).trim() + (clean.length > MAX ? '…' : '');
  }
  const start = Math.max(0, idx - 90);
  const end = Math.min(clean.length, idx + 150);
  return (start > 0 ? '…' : '') + clean.slice(start, end).trim() + (end < clean.length ? '…' : '');
}

/** Aranan ifade metinde birebir (şapka-katlamalı) geçiyor mu? */
function textHasTerm(text: string, query: string): boolean {
  return findTermIndex(foldTr(text.replace(/\s+/g, ' ')), query) >= 0;
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
        const text = await fetchDocText(h.id, h.src);
        h.snippet = buildSnippet(text, query);
        h.matched = textHasTerm(text, query);
        // Tam metni bizde kalıcı arşivle — UYAP çökse de bu karar bizde kalır.
        await archiveDecision(h, text, query);
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
  // UYAP Solr çökünce HTTP 200 döner ama recordsTotal gelmez ve liste boştur;
  // bunu gerçek "0 sonuç"tan (recordsTotal=0) ayırıp kaynak arızası olarak yükselt.
  const recTotal = j?.data?.recordsTotal;
  const metaErr = (j?.metadata?.FMTY === 'ERROR');
  if (metaErr || (recTotal == null && (j?.data?.data?.length ?? 0) === 0)) {
    throw new Error('source_unreachable');
  }
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
// Bedesten API (bedesten.adalet.gov.tr) — Adalet Bakanlığı birleşik karar
// bankası. UYAP Emsal (BAM + yerel) YARGITAY içermez; Yargıtay ve Danıştay
// kararlarına buradan erişiyoruz. Yargıtay'ın kendi sitesi (karararama) bulut
// IP'lerini engellediği için tek erişilebilir Yargıtay kaynağı budur.
// ---------------------------------------------------------------------------
const BEDESTEN_BASE = 'https://bedesten.adalet.gov.tr';
const BEDESTEN_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};

/** Bedesten base64 (UTF-8) içeriğini düz metne çevirir. */
function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return b64; // zaten düz metinse olduğu gibi
  }
}

function bedestenRows(j: unknown): Hit[] {
  const list = (j as { data?: { emsalKararList?: unknown[] } })?.data?.emsalKararList ?? [];
  return (list as Record<string, unknown>[])
    .map((r): Hit => {
      const birim = String(r.birimAdi ?? '');
      const type = (r.itemType as { name?: string })?.name;
      const prefix = type === 'DANISTAYKARAR' ? 'Danıştay' : 'Yargıtay';
      const kt = r.kararTarihi ? String(r.kararTarihi).slice(0, 10).split('-').reverse().join('.') : '';
      return {
        id: String(r.documentId ?? ''),
        daire: birim ? `${prefix} ${birim}` : prefix,
        esasNo: r.esasNoYil != null ? `${r.esasNoYil}/${r.esasNoSira}` : '',
        kararNo: r.kararNoYil != null ? `${r.kararNoYil}/${r.kararNoSira}` : '',
        kararTarihi: kt,
        durum: '',
        src: 'yargitay' as const,
      };
    })
    .filter((h) => h.id);
}

async function bedestenSearch(
  query: string,
  page: number,
  pageSize: number,
  itemType = 'YARGITAYKARARI',
  opts?: { sortByDate?: boolean },
): Promise<{ hits: Hit[]; total: number }> {
  const data: Record<string, unknown> = {
    pageSize,
    pageNumber: page,
    itemTypeList: [itemType],
    phrase: query,
  };
  // Varsayılan: alaka (relevance) sıralaması. İstenirse en yeni karar → eski.
  if (opts?.sortByDate) {
    data.sortFields = ['KARAR_TARIHI'];
    data.sortDirection = 'desc';
  }
  const res = await fetch(`${BEDESTEN_BASE}/emsal-karar/searchDocuments`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`bedesten_${res.status}`);
  const j = await res.json();
  // Bedesten HTTP 200 dönüp arka plan (UYAP Solr) çökünce metadata'da hata
  // bildiriyor; bunu "0 sonuç" sanmayıp kaynak arızası olarak yükselt.
  const meta = (j as { metadata?: { FMTY?: string; FMC?: string } })?.metadata;
  if (meta?.FMTY === 'ERROR' || (meta?.FMC ?? '').includes('EXCEPTION')) {
    throw new Error('source_unreachable');
  }
  return { hits: bedestenRows(j), total: Number((j as { data?: { total?: number } })?.data?.total ?? 0) };
}

async function bedestenDocument(id: string): Promise<string> {
  const res = await fetch(`${BEDESTEN_BASE}/emsal-karar/getDocumentContent`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({ data: { documentId: id } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`bedesten_doc_${res.status}`);
  const j = await res.json();
  const data = (j as { data?: { content?: string; mimeType?: string } })?.data;
  const mime = String(data?.mimeType ?? '');
  // Taranmış (PDF/görüntü) kararların metni yok — düz metin sözü vermeyelim.
  if (mime && !mime.includes('html') && !mime.includes('text')) return '';
  return htmlToText(b64ToUtf8(String(data?.content ?? '')));
}

/** Kaynağa göre karar tam metnini getirir. */
async function fetchDocText(id: string, src?: 'emsal' | 'yargitay'): Promise<string> {
  return src === 'yargitay' ? await bedestenDocument(id) : await emsalDocument(id);
}

// ---------------------------------------------------------------------------
// KALICI ARŞİV — çekilen kararları kendi veritabanımıza (ictihat_kararlar)
// yazarız; böylece UYAP çökse bile daha önce görülen kararlar bizde kalır ve
// arşivden sunulur. Servis anahtarı (service_role) ile yazılır.
// ---------------------------------------------------------------------------
let _svc: ReturnType<typeof createClient> | null = null;
function svc(): ReturnType<typeof createClient> | null {
  if (_svc) return _svc;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url && key) _svc = createClient(url, key);
  return _svc;
}

function kurulOf(h: Hit): string {
  if (h.src === 'yargitay') return h.daire.startsWith('Danıştay') ? 'Danıştay' : 'Yargıtay';
  return 'BAM/Yerel';
}

/** Bir kararı tam metniyle arşive yaz (idempotent upsert). En iyi çaba; hata yutulur. */
async function archiveDecision(h: Hit, fullText: string, query: string): Promise<void> {
  const db = svc();
  if (!db || !h.id || !fullText || fullText.length < 200) return; // taranmış/boş atla
  try {
    await db.from('ictihat_kararlar').upsert(
      {
        id: h.id,
        kurul: kurulOf(h),
        daire: h.daire || null,
        esas_no: h.esasNo || null,
        karar_no: h.kararNo || null,
        karar_tarihi: h.kararTarihi || null,
        durum: h.durum || null,
        arama_terimi: query.slice(0, 120),
        full_text: fullText,
      },
      { onConflict: 'id' },
    );
  } catch {
    // arşivleme en iyi çabadır; başarısız olsa da kullanıcı akışını bozmaz
  }
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

async function geminiSummary(query: string, docs: Array<{ hit: Hit; text: string }>, model: string, meter?: Meter): Promise<string> {
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
  if (meter) meterAdd(meter, j);
  const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('empty');
  return text.trim();
}

/**
 * OLAY ANALİZİ — 1. adım: avukatın anlattığı olaydan, UYAP Emsal'de içtihat
 * aramak için en isabetli Türkçe arama terimlerini ve hukuki nitelendirmeyi üretir.
 */
async function geminiPlan(olay: string, model: string, meter?: Meter): Promise<{ issue: string; queries: string[] }> {
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
  if (meter) meterAdd(meter, j);
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
  model: string,
  meter?: Meter
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
  if (meter) meterAdd(meter, j);
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
    /** Arama mahkeme süzgeci: 'yargitay' | 'danistay' | 'emsal'. */
    court?: 'yargitay' | 'danistay' | 'emsal';
    /** Künye araması: esas no ("2019/3641"), karar no ("2022/1689"), daire süzgeci. */
    esas?: string;
    karar?: string;
    daire?: string;
    /** document: kaynağı belirtir (emsal varsayılan). */
    src?: 'emsal' | 'yargitay';
    /** Arama modu: 'smart' (tam ifade önce), 'exact' (yalnız ardışık), 'recent' (en yeni). */
    mode?: 'smart' | 'exact' | 'recent';
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
      // Mahkeme süzgeci: 'yargitay' (Bedesten) | 'danistay' (Bedesten) | 'emsal'
      // (UYAP Emsal: BAM + yerel). Varsayılan Yargıtay — en üst mahkeme.
      const court = body.court ?? 'yargitay';

      // Yargıtay / Danıştay → Bedesten (tam sayfalama, tek kaynak).
      if (court === 'yargitay' || court === 'danistay') {
        const itemType = court === 'danistay' ? 'DANISTAYKARAR' : 'YARGITAYKARARI';
        const mode = body.mode ?? 'smart';
        // Çok kelimeli sorguda tırnak = ardışık (tam ifade) araması.
        const multiWord = query.trim().split(/\s+/).length > 1;
        try {
          let hits: Hit[];
          let total: number;
          if (mode === 'recent') {
            // EN YENİ: tarihe göre sırala (alaka değil).
            const r = await bedestenSearch(query, page, pageSize, itemType, { sortByDate: true });
            hits = r.hits;
            total = r.total;
          } else if (mode === 'exact' && multiWord) {
            // TAM İFADE: yalnız kelimelerin ardışık geçtiği kararlar.
            const r = await bedestenSearch(`"${query}"`, page, pageSize, itemType);
            hits = r.hits;
            total = r.total;
          } else if (page === 1 && multiWord) {
            // AKILLI (varsayılan): önce tam ifade (ardışık), sonra kelime bazlı;
            // "şerit değiştirme" gibi aramalarda tam ifade EN ÜSTTE çıkar.
            const [ph, kw] = await Promise.all([
              bedestenSearch(`"${query}"`, 1, pageSize, itemType).catch(() => ({ hits: [], total: 0 })),
              bedestenSearch(query, 1, pageSize, itemType),
            ]);
            const seen = new Set<string>();
            hits = [];
            for (const h of [...ph.hits, ...kw.hits]) {
              if (h.id && !seen.has(h.id)) {
                seen.add(h.id);
                hits.push(h);
              }
            }
            hits = hits.slice(0, pageSize);
            total = kw.total || ph.total;
          } else {
            // Tek kelime ya da sayfa 2+ : düz kelime araması.
            const r = await bedestenSearch(query, page, pageSize, itemType);
            hits = r.hits;
            total = r.total;
          }
          await attachSnippets(hits, query, hits.length);
          // Aranan ifadenin metinde birebir GEÇMEDİĞİ (köke yakın) kararları
          // sona at — "recent" modunda tarih sırasını bozmamak için dokunma.
          if (mode !== 'recent') {
            hits.sort((a, b) => (a.matched === false ? 1 : 0) - (b.matched === false ? 1 : 0));
          }
          return json({ hits, total, page, source: court });
        } catch (e) {
          // UYAP çökük → daha önce arşivlediğimiz kararlardan sun (bizde kalanlar).
          const msg = e instanceof Error ? e.message : '';
          if (msg === 'source_unreachable' && page === 1) {
            const { data } = await supabase.rpc('search_ictihat_fts', { q: query, match_count: pageSize });
            const hits = (data ?? []).map((r: Record<string, unknown>) => {
              const h = rowToHit(r);
              if (r.snippet) h.snippet = String(r.snippet);
              h.matched = true;
              return h;
            });
            if (hits.length > 0) return json({ hits, total: hits.length, page: 1, source: 'archive' });
          }
          throw e;
        }
      }

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
      // Yargıtay künyesini de tara (Bedesten). Erişilemezse boş döner.
      const ygPromise: Promise<Hit[]> = bedestenSearch(term, 1, 20, 'YARGITAYKARARI')
        .then((r) => r.hits)
        .catch(() => []);
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

      // Tam eşleşme: önizleme + DETAYLI ANALİZ (sonuç, hüküm alıntısı, incelenen
      // mahkeme). Atıf yapanlar: künyenin geçtiği yer (karşı taraf "cımbızla mı
      // çekmiş" oradan görülür).
      await Promise.all([
        ...exact.slice(0, 4).map(async (h) => {
          try {
            const text = await fetchDocText(h.id, h.src);
            h.snippet = buildSnippet(text, term);
            const a = analyzeDecision(text);
            h.outcome = a.outcome;
            h.sonuc = a.sonuc;
            h.incelenen = a.incelenen;
            await archiveDecision(h, text, term);
          } catch {
            // analiz alınamadı → geç
          }
        }),
        ...citing.slice(0, 8).map(async (h) => {
          try {
            const text = await fetchDocText(h.id, h.src);
            h.snippet = buildSnippet(text, term);
            await archiveDecision(h, text, term);
          } catch {
            // önizleme alınamadı → geç
          }
        }),
      ]);

      return json({ esas, karar, exact, citing });
    }

    if (action === 'document') {
      const id = (body.id ?? '').trim();
      if (!id) return json({ error: 'bad_request' }, 400);
      // ÖNCE ARŞİV (bizde kalan): hızlı ve UYAP çökse bile çalışır.
      const { data: row } = await supabase
        .from('ictihat_kararlar')
        .select('full_text')
        .eq('id', id)
        .maybeSingle();
      if (row?.full_text) return json({ id, text: String(row.full_text), source: 'archive' });
      // Arşivde yoksa canlı çek ve metni arşive yaz (bir dahaki sefere bizde kalsın).
      const text = body.src === 'yargitay' ? await bedestenDocument(id) : await emsalDocument(id);
      await archiveDecision({ id, daire: '', esasNo: '', kararNo: '', kararTarihi: '', durum: '', src: body.src ?? 'emsal' }, text, '');
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
      // Üyelik katmanı + maliyet tavanı kontrolü (batma koruması).
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_premium, ai_tier')
        .eq('id', userData.user.id)
        .maybeSingle();
      const { tier, cfg } = tierConfig(
        (prof as { ai_tier?: string } | null)?.ai_tier,
        !!(prof as { is_premium?: boolean } | null)?.is_premium
      );
      const used = await usageThisMonth(userData.user.id);
      if (used >= cfg.ceilingTry) return json({ error: 'quota_exceeded', tier, used, ceiling: cfg.ceilingTry }, 402);
      const meter: Meter = { tin: 0, tout: 0 };
      const summary = await geminiSummary(query, docs, cfg.model, meter);
      await recordUsage(userData.user.id, cfg.model, meter.tin, meter.tout);
      return json({ summary, count: docs.length, tier });
    }

    // OLAY ANALİZİ — avukat olayı anlatır; AI hukuki değerlendirme + çözüm yazar ve
    // olaya uygun GERÇEK içtihatı bulup getirir (kelime araması değil, akıl yürütme).
    if (action === 'analyze') {
      const olay = (body.olay ?? '').trim();
      if (olay.length < 15) return json({ error: 'bad_request' }, 400);

      // Üyelik katmanı + maliyet tavanı kontrolü (batma koruması).
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_premium, ai_tier')
        .eq('id', userData.user.id)
        .maybeSingle();
      const { tier, cfg } = tierConfig(
        (prof as { ai_tier?: string } | null)?.ai_tier,
        !!(prof as { is_premium?: boolean } | null)?.is_premium
      );
      const used = await usageThisMonth(userData.user.id);
      if (used >= cfg.ceilingTry) return json({ error: 'quota_exceeded', tier, used, ceiling: cfg.ceilingTry }, 402);
      const model = cfg.model;
      const meter: Meter = { tin: 0, tout: 0 };

      // 1) Olaydan arama terimleri üret.
      const plan = await geminiPlan(olay, model, meter);
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
      const analysis = await geminiAnalyze(olay, plan.issue, docs, model, meter);
      await recordUsage(userData.user.id, model, meter.tin, meter.tout);
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
