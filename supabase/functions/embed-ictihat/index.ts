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
import { servisYetkisiVarMi } from '../_shared/yetki.ts';
// CORS başlıkları ORTAK dosyadan geliyor — bkz. _shared/cors.ts.
// Burada elle yazılmaları, altı uçta `x-client-info` başlığının izin
// listesinden düşmesine ve tarayıcıda tam arızaya yol açmıştı.
import { CORS } from '../_shared/cors.ts';


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

  // BAKIM UCU — YALNIZ SERVİS ANAHTARI. Ağ geçidinin verify_jwt ayarı yalnızca
  // "geçerli bir JWT var mı" der, KİMİN olduğunu sormaz; bu kontrol olmadan
  // kayıtlı herhangi bir kullanıcı bu ucu tetikleyebiliyordu (bkz. _shared/yetki.ts).
  if (!(await servisYetkisiVarMi(req))) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers: CORS });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // ÖLÇÜLDÜ (18.09.2026, cron kapalıyken yalıtılmış koşu): limit=6 çağrısı
  // HER SEFERİNDE 546 WORKER_RESOURCE_LIMIT veriyor. Canlı cron tam da 6 ile
  // çağırıyordu; son 3 saatteki 60 çağrının 60'ı da düşmüştü. Kayıtlar
  // tek tek update edildiği için çöküşten önce yazılanlar kalıyordu —
  // bu yüzden vektörleme "yavaş" görünüyordu, oysa %100 hata veriyordu.
  // Tavan 6'dan 4'e çekildi, varsayılan 3'e indi.
  let limit = 3;
  // Paralel işçilerin AYNI satırları seçmemesi için atlama. Cron'da her iş
  // farklı bir atla değeriyle çağrılır; kümeler ayrık olur.
  let atla = 0;
  // VARSAYILAN KAPALI. Sebebi aşağıda, `remaining` hesabının yanında.
  let kalanSayilsin = false;
  let kaynak = 'ictihat';
  let sorguMetni: string | null = null;
  // Toplu doldurmayı hızlandırmak için: iki işçi listenin iki ucundan başlayıp
  // ortada buluşur. Kilit yok, ama işlev idempotent olduğu için çakışma en
  // kötü ihtimalle aynı kaydı iki kez hesaplamaya yol açar — bozulma olmaz.
  let sira: 'asc' | 'desc' = 'asc';
  try {
    const body = await req.json();
    limit = Math.min(4, Math.max(1, Number(body?.limit ?? 3)));
    atla = Math.max(0, Number(body?.atla ?? 0) || 0);
    // "kaç kayıt kaldı" sayımı İSTEĞE BAĞLI oldu — bkz. aşağıdaki not.
    kalanSayilsin = body?.kalan === true;
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
    .range(atla, atla + limit - 1);
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

  // ────────────────────────────────────────────────────────────────────────
  // BU SAYIM VERİTABANINI DİZ ÇÖKERTTİ — 18/19.09.2026 gecesi, ölçüldü.
  //
  // Burada eskiden HER çağrının sonunda koşulsuz olarak
  //     select count(*) from ictihat_kararlar where embedding is null
  // vardı. Tek başına zararsız; ama paralel işçi sayısı 64'e çıkarıldığında
  // dakikada 64 kez koşan ~70 bin satırlık bir sayıma dönüştü.
  //
  // SONUÇ: Postgres kayıtlarında saatlerce "canceling statement due to
  // statement timeout" ve doğrudan SQL bağlantılarının zaman aşımına
  // düşmesi — `select now()` bile açılamıyordu. Proje durumu ACTIVE_HEALTHY
  // idi, yani düşen veritabanı değil BAĞLANTI KAPASİTESİYDİ.
  // İşçi 64 → 8'e indirilince veritabanı bir dakika içinde düzeldi; teşhis
  // böyle doğrulandı (tahmin değil).
  //
  // İRONİ VE ASIL DERS: bu sayı hiçbir işe yaramıyordu. Cron onu okumuyor.
  // Yalnız scripts/embed-ictihat.mjs döngüsü duracağı yeri bilmek için
  // kullanıyor. Yani maliyeti ödeyen taraf ile faydasını gören taraf ayrıydı.
  // Artık İSTEYEN öder: gövdede `kalan: true` gönderilirse sayılır.
  let kalan: number | null = null;
  if (kalanSayilsin) {
    const { count } = await supabase
      .from(tablo)
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    kalan = count ?? null;
  }

  return new Response(
    JSON.stringify({ processed, failed: failed.length, remaining: kalan, atla, limit }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
