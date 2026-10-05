// Vekil :: Resmî Gazete günlük fihristi (05.10.2026)
// ---------------------------------------------------------------------------
// pg_cron günde birkaç kez çağırır (0170). Günün fihristini okur, maddeleri
// public.resmi_gazete tablosuna yazar; uygulama yalnız tablodan okur — yani
// kullanıcı başına dış istek YOK, kaynağa günde birkaç istek gider.
//
// Ayrıştırma ve gerekçe: _shared/resmiGazete.ts.
//
// KAYNAK KARARSIZ (ölçüldü 05.10.2026): buradan art arda 31 fihrist
// istendiğinde 10'u 20 sn'de cevap vermedi. Bu yüzden her istek 3 deneme ve
// cron günde birkaç tur; bir tur düşerse sonraki tur tamamlar. Tablo
// yalnız BAŞARILI okumada yazılır — yarım veri yazılmaz.
//
// Kullanım: POST { "tarih": "YYYY-AA-GG" }  (boşsa Türkiye'nin bugünü)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { servisYetkisiVarMi } from '../_shared/yetki.ts';
import { CORS } from '../_shared/cors.ts';
import { fihristCoz, fihristUrl, turkiyeBugun, type GazeteMaddesi } from '../_shared/resmiGazete.ts';

const ZAMAN_ASIMI_MS = 20_000;
const DENEME = 3;

/** null: sayfa yok (henüz yayımlanmamış ya da o gün gazete çıkmamış). */
async function sayfaGetir(url: string): Promise<string | null> {
  let son: unknown = null;
  for (let i = 0; i < DENEME; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (VekilPro; +https://vekilpro.app)' },
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ham = new Uint8Array(await r.arrayBuffer());
      return new TextDecoder('windows-1254').decode(ham);
    } catch (e) {
      son = e;
    }
  }
  throw new Error(`kaynak yanıt vermedi (${DENEME} deneme): ${String(son).slice(0, 120)}`);
}

const yanit = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await servisYetkisiVarMi(req))) return yanit({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return yanit({ error: 'not_configured' }, 500);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let tarih = turkiyeBugun();
  try {
    const govde = await req.json();
    if (typeof govde?.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(govde.tarih)) tarih = govde.tarih;
  } catch {
    // gövdesiz çağrı: bugün
  }

  const t0 = Date.now();
  try {
    const anaUrl = fihristUrl(tarih);
    const ana = await sayfaGetir(anaUrl);
    if (ana === null) return yanit({ tarih, yayinda: false, sureMs: Date.now() - t0 });

    const f = fihristCoz(ana, anaUrl);
    const maddeler: GazeteMaddesi[] = [...f.maddeler];
    for (const mUrl of f.mukerrerler) {
      const m = await sayfaGetir(mUrl);
      if (m !== null) maddeler.push(...fihristCoz(m, mUrl, true).maddeler);
    }

    const { error } = await supabase.from('resmi_gazete').upsert(
      { tarih, sayi: f.sayi, maddeler, mukerrer: f.mukerrerler.length, cekildi: new Date().toISOString() },
      { onConflict: 'tarih' }
    );
    if (error) return yanit({ tarih, error: 'yazilamadi', detay: error.message }, 500);
    return yanit({ tarih, yayinda: true, sayi: f.sayi, madde: maddeler.length, mukerrer: f.mukerrerler.length, sureMs: Date.now() - t0 });
  } catch (e) {
    return yanit({ tarih, error: 'kaynak', detay: String(e).slice(0, 200), sureMs: Date.now() - t0 }, 502);
  }
});
