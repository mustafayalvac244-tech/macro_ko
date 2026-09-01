// Vekil :: içtihat embedding doldurucusu
// ---------------------------------------------------------------------------
// Havuzdaki kararlara anlamsal arama vektörü üretir. Supabase Edge çalışma
// zamanının YERLEŞİK modelini (gte-small, 384 boyut) kullanır: ücretsizdir,
// API anahtarı istemez, sunucuda çalışır.
//
// Neden gerekli: kelime araması eşanlamı yakalayamaz. Avukat "işten atıldım
// tazminat alamadım" yazınca kararlardaki "hizmet akdinin haklı nedenle feshi"
// ifadesi eşleşmez. Anlamsal arama bu boşluğu kapatır.
//
// İKİ KAYNAK: kararlar ve kanun maddeleri. Mevzuatta da anlamsal arama gerekir,
// çünkü avukat "şiddetli geçimsizlik" yazarken kanun "evlilik birliğinin
// temelinden sarsılması" der; kelime araması bunu eşleştiremez.
//
// Kullanım (servis anahtarıyla, ör. GitHub Actions'tan):
//   POST /functions/v1/embed-ictihat   { "limit": 4, "kaynak": "ictihat" }
//   POST /functions/v1/embed-ictihat   { "limit": 4, "kaynak": "mevzuat" }
// Yanıt: { processed, remaining }
//
// Idempotent: yalnız embedding'i NULL olan kayıtları işler, tekrar çağrılabilir.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Model bir kez kurulur; her istekte yeniden yüklemek pahalı olurdu.
// @ts-ignore — Supabase edge runtime globali
const session = new Supabase.ai.Session('gte-small');

/**
 * Karar metnini vektöre çevirir.
 *
 * 800 karakter: edge çalışma zamanının işlem bütçesi sınırlı; 2000 karakterle
 * tek çağrıda 1 karardan fazlası WORKER_RESOURCE_LIMIT veriyordu. Kararın ilk
 * bölümü zaten konuyu ve uyuşmazlığı içerir, arama için yeterlidir.
 */
async function embed(text: string): Promise<number[]> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 800);
  const v = await session.run(clean, { mean_pool: true, normalize: true });
  return v as number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers: CORS });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Ölçüldü: 4 kayıt güvenli, 8 kayıt WORKER_RESOURCE_LIMIT veriyor.
  let limit = 4;
  let kaynak = 'ictihat';
  let sorguMetni: string | null = null;
  // Toplu doldurmayı hızlandırmak için: iki işçi listenin iki ucundan başlayıp
  // ortada buluşur. Kilit yok, ama işlev idempotent olduğu için çakışma en
  // kötü ihtimalle aynı kaydı iki kez hesaplamaya yol açar — bozulma olmaz.
  let sira: 'asc' | 'desc' = 'asc';
  try {
    const body = await req.json();
    limit = Math.min(6, Math.max(1, Number(body?.limit ?? 4)));
    if (body?.kaynak === 'mevzuat') kaynak = 'mevzuat';
    if (typeof body?.embed === 'string' && body.embed.trim()) sorguMetni = body.embed;
    if (body?.sira === 'desc') sira = 'desc';
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  // Tek metnin vektörünü döndüren kip. Anlamsal aramanın isabetini ÖLÇEBİLMEK
  // için var (scripts/eval-arama.mjs): sorgu vektörü yalnız bu çalışma zamanında
  // üretilebildiğinden, ölçüm betiği vektörü buradan alır. Kayıt yazmaz.
  if (sorguMetni) {
    try {
      const vec = await embed(sorguMetni);
      return new Response(JSON.stringify({ embedding: vec }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'embed_failed', detail: String(e).slice(0, 200) }), {
        status: 500,
        headers: CORS,
      });
    }
  }

  const tablo = kaynak === 'mevzuat' ? 'mevzuat_maddeleri' : 'ictihat_kararlar';
  // Maddede aranan anlam başlıkta yoğunlaşır; başlık metnin önüne konur.
  const alanlar = kaynak === 'mevzuat' ? 'id, kanun_short, baslik, metin' : 'id, full_text';

  const { data, error } = await supabase
    .from(tablo)
    .select(alanlar)
    .is('embedding', null)
    .order('id', { ascending: sira === 'asc' })
    .limit(limit);
  if (error) {
    return new Response(JSON.stringify({ error: 'query_failed', detail: error.message }), { status: 500, headers: CORS });
  }

  type Satir = {
    id: string;
    full_text?: string | null;
    kanun_short?: string | null;
    baslik?: string | null;
    metin?: string | null;
  };
  const rows = ((data ?? []) as unknown as Satir[]).map((r) => ({
    id: r.id,
    full_text:
      kaynak === 'mevzuat'
        ? [r.kanun_short, r.baslik, r.metin].filter(Boolean).join(' — ')
        : (r.full_text ?? ''),
  }));
  let processed = 0;
  const failed: string[] = [];

  for (const row of rows) {
    const text = (row.full_text ?? '').trim();
    if (!text) continue; // metinsiz kayıt vektörlenemez
    try {
      const vec = await embed(text);
      const { error: upErr } = await supabase
        .from(tablo)
        .update({ embedding: vec })
        .eq('id', row.id);
      if (upErr) failed.push(row.id);
      else processed++;
    } catch {
      failed.push(row.id);
    }
  }

  const { count } = await supabase
    .from(tablo)
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  return new Response(
    JSON.stringify({ processed, failed: failed.length, remaining: count ?? null }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
