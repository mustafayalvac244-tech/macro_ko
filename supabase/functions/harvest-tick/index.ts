// Vekil :: içtihat hasadı — tek turluk (tick)
// ---------------------------------------------------------------------------
// NEDEN VAR: hasat GitHub Actions'ta kuruluydu ve çalışması için repoya secret
// eklenmesi gerekiyordu. Bu adım tamamlanamadı; dokuz zamanlı çalışma da secret
// olmadığı için düştü ve havuz yalnız elle büyüyebildi.
//
// Bu işlev aynı işi Supabase'in İÇİNDE yapar: pg_cron bu işlevi çağırır, GitHub
// hiç devreye girmez. Böylece havuzun büyümesi tek bir dış yapılandırma adımına
// bağlı olmaktan çıkar. Yedekleme işleri (backup.take_snapshot) zaten aynı
// desenle çalışıyor.
//
// TASARIM — KÜÇÜK TUR: edge çalışma zamanının süre bütçesi sınırlıdır, bu
// yüzden her çağrı TEK terimin TEK sayfasını işler ve en fazla birkaç karar
// çeker. Sıklık pg_cron tarafında ayarlanır. Küçük tur ayrıca kaynak sitelerin
// hız sınırına takılmayı da azaltır.
//
// Kullanım: POST { "kaynak": "emsal" | "yargitay" | "danistay", "enFazla": 6 }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { servisYetkisiVarMi } from '../_shared/yetki.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMSAL = 'https://emsal.uyap.gov.tr';
const BEDESTEN = 'https://bedesten.adalet.gov.tr';
const BEDESTEN_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};
const PAGE_SIZE = 20;

const uyu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kesme işareti UYAP aramasını tamamen öldürüyor (ölçüldü: 0 vs 86.985 kayıt). */
function normalizeTerm(t: string): string {
  return t.replace(/['’ʼ]/g, '').replace(/\s+/g, ' ').trim();
}

function kurulOf(daire = ''): string {
  const d = daire.toLocaleLowerCase('tr');
  if (d.includes('bölge adliye')) return 'BAM';
  if (d.includes('bölge idare')) return 'BİM';
  if (d.includes('danıştay')) return 'Danıştay';
  if (d.includes('yargıtay')) return 'Yargıtay';
  if (d.includes('anayasa')) return 'AYM';
  return 'Yerel';
}

function htmlToText(html = ''): string {
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

/** Deno'da Buffer yok; base64 → UTF-8 elle çözülür (Türkçe harfler bozulmasın). */
function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return b64;
  }
}

type Satir = { id: string; daire: string; esasNo: string; kararNo: string; kararTarihi: string; durum?: string };

async function emsalSearch(terim: string, page: number): Promise<{ rows: Satir[]; total: number }> {
  const res = await fetch(`${EMSAL}/aramalist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${EMSAL}/`,
    },
    body: JSON.stringify({ data: { arananKelime: normalizeTerm(terim), pageSize: PAGE_SIZE, pageNumber: page } }),
  });
  if (!res.ok) throw new Error(`emsal arama ${res.status}`);
  const j = await res.json();
  const rows = (j?.data?.data ?? []) as Satir[];
  const total = Number(j?.data?.recordsTotal ?? 0);
  // UYAP hız sınırında 429 DEĞİL, HTTP 200 + boş sonuç döndürüyor. Bu sahte
  // sıfırı "sonuç yok" sayarsak terim biten olarak işaretlenir ve o konudaki
  // içtihat havuza hiç girmez. Bu yüzden 1. sayfadaki sıfır hata sayılır.
  if (page === 1 && total === 0 && rows.length === 0) throw new Error('emsal 429 (sahte sıfır)');
  return { rows, total };
}

async function bedestenSearch(terim: string, page: number, itemType: string): Promise<{ rows: Satir[]; total: number }> {
  const res = await fetch(`${BEDESTEN}/emsal-karar/searchDocuments`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({
      data: { pageSize: PAGE_SIZE, pageNumber: page, itemTypeList: [itemType], phrase: normalizeTerm(terim) },
    }),
  });
  if (!res.ok) throw new Error(`bedesten ${res.status}`);
  const j = await res.json();
  // Bedesten HTTP 200 dönüp arka planda çökebiliyor; "sonuç yok" sanma.
  const meta = j?.metadata ?? {};
  if (meta.FMTY === 'ERROR' || String(meta.FMC ?? '').includes('EXCEPTION')) throw new Error('bedesten 429');
  // deno-lint-ignore no-explicit-any
  const list = (j?.data?.emsalKararList ?? []) as any[];
  const rows: Satir[] = list
    .map((r) => {
      const prefix = r?.itemType?.name === 'DANISTAYKARAR' ? 'Danıştay' : 'Yargıtay';
      let birim = String(r.birimAdi ?? '').trim();
      if (birim.startsWith(prefix)) birim = birim.slice(prefix.length).trim();
      return {
        id: String(r.documentId ?? ''),
        daire: birim ? `${prefix} ${birim}` : prefix,
        esasNo: r.esasNoYil != null ? `${r.esasNoYil}/${r.esasNoSira}` : '',
        kararNo: r.kararNoYil != null ? `${r.kararNoYil}/${r.kararNoSira}` : '',
        kararTarihi: r.kararTarihi ? String(r.kararTarihi).slice(0, 10).split('-').reverse().join('.') : '',
      };
    })
    .filter((x) => x.id);
  return { rows, total: Number(j?.data?.total ?? 0) };
}

async function emsalDoc(id: string): Promise<string> {
  const res = await fetch(`${EMSAL}/getDokuman?id=${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: `${EMSAL}/` },
  });
  if (!res.ok) throw new Error(`emsal doc ${res.status}`);
  const j = await res.json();
  return htmlToText(String(j?.data ?? ''));
}

async function bedestenDoc(id: string): Promise<string> {
  const res = await fetch(`${BEDESTEN}/emsal-karar/getDocumentContent`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({ data: { documentId: id } }),
  });
  if (!res.ok) throw new Error(`bedesten doc ${res.status}`);
  const j = await res.json();
  return htmlToText(b64ToUtf8(String(j?.data?.content ?? '')));
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

  let kaynak = 'emsal';
  let enFazla = 6;
  try {
    const body = await req.json();
    if (body?.kaynak === 'yargitay' || body?.kaynak === 'danistay') kaynak = body.kaynak;
    enFazla = Math.min(10, Math.max(1, Number(body?.enFazla ?? 6)));
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  // Terim seçimi: en uzun süredir işlenmemiş olan. Böylece 134 terim sırayla
  // dolaşılır ve hep aynı konu taranmaz.
  const onek = kaynak === 'emsal' ? '' : `${kaynak}:`;
  /**
   * ÖNCELİK ÖNCE, SONRA TAZELİK.
   *
   * Eskiden yalnız `last_run` sırasıyla dönülüyordu: 134 terim eşit ağırlıkta
   * taranıyordu. Günde ~1.300 karar çekebiliyorsak o kotayı neyin harcadığı
   * önemlidir — Yargıtay Hukuk Genel Kurulu kararıyla hiçbir müvekkilimizi
   * ilgilendirmeyen bir konu aynı hızda toplanıyordu.
   *
   * `oncelik` sütunu (migration 0093) üç sinyalden hesaplanıyor: kullanıcı-
   * larımızın GERÇEK dava karışımı, yüksek yargı ağırlığı ve tazelik. İkincil
   * sıralama hâlâ `last_run` — böylece aynı öncelikteki terimler sırayla
   * dolaşılır ve hiçbiri aç kalmaz.
   *
   * SESSİZ ÖLÜM RİSKİ (bu yüzden geri düşüş var). Bu işlev `oncelik` sütununa
   * bağımlı; sütun yoksa (0093 uygulanmamışsa) PostgREST 42703 döndürür, bu
   * işlev 500 verir ve hasat DURUR. Üstelik görünmez durur: hasat_tetikle
   * net.http_post ile ateşle-unut çağırıyor, yanıtı kimse okumuyor. Yani tek
   * bir eksik migration, hasadı haftalarca sessizce kapalı tutabilirdi.
   * Bağımlılığı sürüm sırasına bırakmak yerine burada kırıyoruz: sütun yoksa
   * eski davranışa (yalnız last_run) düşülür ve bunu yanıtta söyleriz.
   */
  const terimSec = (oncelikliMi: boolean) => {
    let s = supabase.from('ictihat_harvest_state').select('terim, next_page');
    if (oncelikliMi) s = s.order('oncelik', { ascending: false });
    s = s.order('last_run', { ascending: true, nullsFirst: true }).limit(1);
    return onek ? s.like('terim', `${onek}%`) : s.not('terim', 'like', '%:%');
  };

  let oncelikliCalisti = true;
  let { data: durum, error: durumErr } = await terimSec(true);
  if (durumErr) {
    // 42703 = undefined_column. Yalnız bu hatada geri düş; başka hataları
    // (yetki, ağ) maskelemek arızayı gizlemek olurdu.
    const sutunYok = durumErr.code === '42703' || /oncelik/i.test(durumErr.message ?? '');
    if (!sutunYok) {
      return new Response(JSON.stringify({ error: 'state_failed', detail: durumErr.message }), { status: 500, headers: CORS });
    }
    oncelikliCalisti = false;
    ({ data: durum, error: durumErr } = await terimSec(false));
    if (durumErr) {
      return new Response(JSON.stringify({ error: 'state_failed', detail: durumErr.message }), { status: 500, headers: CORS });
    }
  }
  const kayit = (durum ?? [])[0] as { terim: string; next_page: number } | undefined;
  if (!kayit) return new Response(JSON.stringify({ error: 'terim_yok' }), { status: 404, headers: CORS });

  const stateKey = kayit.terim;
  const terim = onek ? stateKey.slice(onek.length) : stateKey;
  const page = kayit.next_page ?? 1;

  // Bu tur ne olursa olsun terimi "işlendi" say: hata alsak bile sıradaki tur
  // başka terime geçsin, aynı bozuk terimde sonsuza kadar takılıp kalmasın.
  await supabase
    .from('ictihat_harvest_state')
    .update({ last_run: new Date().toISOString() })
    .eq('terim', stateKey);

  let rows: Satir[] = [];
  let total = 0;
  try {
    const r =
      kaynak === 'emsal'
        ? await emsalSearch(terim, page)
        : await bedestenSearch(terim, page, kaynak === 'danistay' ? 'DANISTAYKARAR' : 'YARGITAYKARARI');
    rows = r.rows;
    total = r.total;
  } catch (e) {
    // Hız sınırı bu turu boş geçirir; sayfa ilerletilmez, sonraki tur aynı
    // sayfayı yeniden dener — karar kaybı olmaz.
    return new Response(JSON.stringify({ kaynak, terim, sayfa: page, eklenen: 0, not: String(e).slice(0, 120) }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Havuzda olanları ele: aynı kararı tekrar indirip kaynağı yormayalım.
  const ids = rows.map((x) => String(x.id));
  let mevcut = new Set<string>();
  if (ids.length) {
    const { data } = await supabase.from('ictihat_kararlar').select('id').in('id', ids);
    mevcut = new Set(((data ?? []) as Array<{ id: string }>).map((x) => x.id));
  }

  let eklenen = 0;
  for (const row of rows) {
    if (eklenen >= enFazla) break;
    const id = String(row.id);
    if (mevcut.has(id)) continue;
    // NAZİK HIZ. 800 ms'den 300 ms'ye indirildi. Ölçüm: eşzamanlılık 10'da
    // 8,7 belge/sn güvenli, 16'da 429 geliyordu. Yeni hız ~0,17 belge/sn —
    // ölçülen güvenli tavanın ellide biri. Kaynak UYAP bir KAMU hizmeti;
    // hızlanmanın sınırı teknik değil, nezaket ve yasaklanmama riskidir.
    await uyu(300);
    let text = '';
    try {
      text = kaynak === 'emsal' ? await emsalDoc(id) : await bedestenDoc(id);
    } catch {
      continue;
    }
    if (!text || text.length < 200) continue;
    const { error } = await supabase.from('ictihat_kararlar').upsert(
      {
        id,
        kurul: kurulOf(row.daire),
        daire: row.daire ?? null,
        esas_no: row.esasNo ?? null,
        karar_no: row.kararNo ?? null,
        karar_tarihi: row.kararTarihi ?? null,
        durum: row.durum ?? null,
        arama_terimi: terim,
        full_text: text,
      },
      { onConflict: 'id' }
    );
    if (!error) eklenen++;
  }

  // Sayfayı ilerlet; son sayfaysa başa dön (yeni kararlar için tekrar tara).
  const sonSayfa = rows.length < PAGE_SIZE;
  await supabase
    .from('ictihat_harvest_state')
    .update({
      next_page: sonSayfa ? 1 : page + 1,
      done: sonSayfa,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq('terim', stateKey);

  return new Response(
    JSON.stringify({
      kaynak,
      terim,
      sayfa: page,
      taranan: rows.length,
      eklenen,
      toplam: total,
      // Öncelik sıralaması çalışmadıysa bunu SÖYLE. Sessizce eski davranışa
      // dönmek, "öncelikli hasat açık" sanmamıza yol açardı.
      ...(oncelikliCalisti ? {} : { uyari: 'oncelik_sutunu_yok__last_run_ile_siralandi' }),
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
