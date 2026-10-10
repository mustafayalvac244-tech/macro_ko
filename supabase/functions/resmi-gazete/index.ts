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
//
// BOŞ GÖVDELİ ÇAĞRI (cron) ÜÇ İŞ YAPAR (10.10.2026 denetimi):
//   1. Bugünü çeker (3 deneme).
//   2. Son GERI_GUN günde tabloda satırı OLMAYAN günleri bir kez dener. Eskiden
//      yalnız "bugün" çekiliyordu; bir gün kaçarsa bir daha hiç çekilmiyordu.
//      Tablo tam dolu ise bu adım yalnız tek bir hafif SELECT'tir.
//   3. Yazmadan önce sonucu doğrular (yazimKarari): bakım sayfası ya da boş
//      ayrıştırma dolu bir günü ezmez; mükerrer düşse de ana sayı yazılır.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { servisYetkisiVarMi } from '../_shared/yetki.ts';
import { CORS } from '../_shared/cors.ts';
import {
  eksikGunler,
  fihristCoz,
  fihristUrl,
  turkiyeBugun,
  yazimKarari,
  type GazeteMaddesi,
  type GazeteSatiri,
} from '../_shared/resmiGazete.ts';

const ZAMAN_ASIMI_MS = 20_000;
const DENEME = 3;
/** Uygulama son 7 satırı gösterir (useResmiGazete); bugün + 6 geri gün = 7. */
const GERI_GUN = 6;
/**
 * Geri dolum yalnız bu süre dolmadan yeni gün başlatır. TAHMİN, ölçülmedi:
 * pg_net isteği 120 sn'de keser (0170); bugünün çekimi tek başına 3×20 sn'ye
 * kadar uzayabilir, geri dolum onun üstüne binmesin.
 */
const GERI_DOLUM_BUTCE_MS = 45_000;

/** null: sayfa yok (henüz yayımlanmamış ya da o gün gazete çıkmamış). */
async function sayfaGetir(url: string, deneme = DENEME): Promise<string | null> {
  let son: unknown = null;
  for (let i = 0; i < deneme; i++) {
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
  throw new Error(`kaynak yanıt vermedi (${deneme} deneme): ${String(son).slice(0, 120)}`);
}

const yanit = (govde: unknown, status = 200) =>
  new Response(JSON.stringify(govde), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Sb = any;

/** Tek günü çeker, doğrular, yazar. Hata FIRLATMAZ; { govde, durum } döner. */
async function gunuIsle(
  supabase: Sb,
  tarih: string,
  deneme: number
): Promise<{ govde: Record<string, unknown>; durum: number }> {
  const t0 = Date.now();
  try {
    const anaUrl = fihristUrl(tarih);
    const ana = await sayfaGetir(anaUrl, deneme);
    if (ana === null) return { govde: { tarih, yayinda: false, sureMs: Date.now() - t0 }, durum: 200 };

    const f = fihristCoz(ana, anaUrl);
    const maddeler: GazeteMaddesi[] = [...f.maddeler];
    // Bir mükerrer sayfası düşerse ana sayı YİNE yazılır; sonraki cron turu
    // mükerreri tamamlar (kayıtlı mükerrer maddeler yazimKarari'nda korunur).
    let mukerrerEksik = 0;
    for (const mUrl of f.mukerrerler) {
      try {
        const m = await sayfaGetir(mUrl, deneme);
        if (m !== null) maddeler.push(...fihristCoz(m, mUrl, true).maddeler);
      } catch {
        mukerrerEksik++;
      }
    }

    const { data: eskiSatir, error: okuErr } = await supabase
      .from('resmi_gazete')
      .select('sayi,maddeler,mukerrer')
      .eq('tarih', tarih)
      .maybeSingle();
    // Eski satır okunamazsa "yok" sayıp üstüne yazmak korumayı kapatırdı.
    if (okuErr) {
      return { govde: { tarih, error: 'okunamadi', detay: String(okuErr.message).slice(0, 120) }, durum: 500 };
    }

    const karar = yazimKarari(
      { sayi: f.sayi, maddeler, mukerrer: f.mukerrerler.length },
      (eskiSatir as GazeteSatiri | null) ?? null,
      mukerrerEksik > 0
    );
    if (!karar.yaz) return { govde: { tarih, error: karar.neden, sureMs: Date.now() - t0 }, durum: 502 };

    const { error } = await supabase
      .from('resmi_gazete')
      .upsert({ tarih, ...karar.satir, cekildi: new Date().toISOString() }, { onConflict: 'tarih' });
    if (error) return { govde: { tarih, error: 'yazilamadi', detay: error.message }, durum: 500 };
    return {
      govde: {
        tarih,
        yayinda: true,
        sayi: karar.satir.sayi,
        madde: karar.satir.maddeler.length,
        mukerrer: karar.satir.mukerrer,
        ...(mukerrerEksik ? { mukerrer_eksik: mukerrerEksik } : {}),
        sureMs: Date.now() - t0,
      },
      durum: 200,
    };
  } catch (e) {
    return { govde: { tarih, error: 'kaynak', detay: String(e).slice(0, 200), sureMs: Date.now() - t0 }, durum: 502 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await servisYetkisiVarMi(req))) return yanit({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return yanit({ error: 'not_configured' }, 500);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let tarih = turkiyeBugun();
  let elle = false;
  try {
    const govde = await req.json();
    if (typeof govde?.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(govde.tarih)) {
      tarih = govde.tarih;
      elle = true;
    }
  } catch {
    // gövdesiz çağrı: bugün
  }

  const t0 = Date.now();
  const bugun = await gunuIsle(supabase, tarih, DENEME);
  // Elle istenen gün tek başına işlenir; geri dolum yalnız cron (gövdesiz) turunda.
  if (elle) return yanit(bugun.govde, bugun.durum);

  // Bugün düşmüş olsa da geri dolum denenir (bugün 404 ise normaldir: gazete
  // henüz yayımlanmamıştır). Kaynak çökükse bütçe zaten sıfırlanmıştır.
  const gecmis: Record<string, unknown>[] = [];
  const aday = eksikGunler(tarih, [], GERI_GUN);
  const { data: satirlar, error: listeErr } = await supabase
    .from('resmi_gazete')
    .select('tarih')
    .in('tarih', aday);
  if (!listeErr) {
    const mevcut = ((satirlar ?? []) as Array<{ tarih: string }>).map((r) => r.tarih);
    for (const g of eksikGunler(tarih, mevcut, GERI_GUN)) {
      if (Date.now() - t0 > GERI_DOLUM_BUTCE_MS) {
        gecmis.push({ tarih: g, atlandi: 'butce' });
        continue;
      }
      // Geri dolumda tek deneme: sonraki cron turu zaten yeniden dener.
      const r = await gunuIsle(supabase, g, 1);
      gecmis.push({ ...r.govde, durum: r.durum });
    }
  }
  // HTTP durumu BUGÜNÜN sonucunu yansıtır (izleme 200 dışını hata sayar);
  // geri dolum ayrıntısı gövdede.
  return yanit(
    { ...bugun.govde, ...(gecmis.length ? { gecmis } : {}), ...(listeErr ? { gecmis_okunamadi: true } : {}) },
    bugun.durum
  );
});
