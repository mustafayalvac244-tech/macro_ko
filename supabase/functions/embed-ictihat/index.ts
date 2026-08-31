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
// Kullanım (servis anahtarıyla, ör. GitHub Actions'tan):
//   POST /functions/v1/embed-ictihat   { "limit": 4 }   (en fazla 6)
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

  // Ölçüldü: 4 karar güvenli, 8 karar WORKER_RESOURCE_LIMIT veriyor.
  let limit = 4;
  try {
    const body = await req.json();
    limit = Math.min(6, Math.max(1, Number(body?.limit ?? 4)));
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  const { data, error } = await supabase
    .from('ictihat_kararlar')
    .select('id, full_text')
    .is('embedding', null)
    .limit(limit);
  if (error) {
    return new Response(JSON.stringify({ error: 'query_failed', detail: error.message }), { status: 500, headers: CORS });
  }

  const rows = (data ?? []) as Array<{ id: string; full_text: string | null }>;
  let processed = 0;
  const failed: string[] = [];

  for (const row of rows) {
    const text = (row.full_text ?? '').trim();
    if (!text) continue; // metinsiz karar vektörlenemez
    try {
      const vec = await embed(text);
      const { error: upErr } = await supabase
        .from('ictihat_kararlar')
        .update({ embedding: vec })
        .eq('id', row.id);
      if (upErr) failed.push(row.id);
      else processed++;
    } catch {
      failed.push(row.id);
    }
  }

  const { count } = await supabase
    .from('ictihat_kararlar')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  return new Response(
    JSON.stringify({ processed, failed: failed.length, remaining: count ?? null }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
