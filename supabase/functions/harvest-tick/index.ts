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
import { sonrakiSayfa } from '../_shared/hasatSayfa.ts';
import { havuzda } from '../_shared/havuz.ts';

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

/**
 * BELGE İNDİRMEDE EŞZAMANLILIK.
 * Gerekçe ve ölçümler _shared/havuz.ts başlığında. Özet: seri+uyku 1,01
 * belge/sn, eşzamanlılık 4'te 4,24 belge/sn ve 0 hata. 8 de hatasız çıktı ama
 * yalnız tek bir patlamada ölçüldü; sürekli hız ölçülmedi, o yüzden 4.
 */
const ES_ZAMAN = 4;

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

/**
 * BELGELERİ İNDİR VE YAZ — her iki modun ortak adımı.
 *
 * ÜÇ DEĞİŞİKLİK, ÜÇÜ DE ÖLÇÜME DAYANIYOR:
 *
 * 1. ELEME ÖNCE. Eskiden döngü TÜM satırları geziyor, kotayı EKLENEN karar
 *    sayısıyla sayıyordu; yani yinelenen satırlar da döngüyü tüketiyordu.
 *    Şimdi önce havuzda olanlar ELENİYOR, sonra kalanların ilk `enFazla`
 *    tanesi alınıyor. "Yarım kaldı mı" sorusu da netleşiyor: elenmişten sonra
 *    hâlâ kotadan fazla YENİ satır varsa sayfa bitmemiştir.
 *
 * 2. EŞZAMANLI İNDİRME. Belge başına 300 ms uyku yerine 4'lü havuz.
 *    Ölçüldü: 1,01 belge/sn → 4,24 belge/sn, 0 hata (bkz. _shared/havuz.ts).
 *
 * 3. TEK SEFERDE YAZ. Eskiden her belge için ayrı bir upsert gidiyordu; 10
 *    belge = 10 ayrı veritabanı gidiş-dönüşü. Bugünkü teşhiste 6 saatte 33
 *    "Gateway Timeout" ve 132 yetki reddi ölçüldü — veritabanı boğulduğunda
 *    yetki kontrolü de düşüyor ve tur 403 alıyor. Gidiş-dönüş sayısını
 *    azaltmak bu baskıyı doğrudan düşürür.
 */
async function belgeleriAl(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  kaynak: string,
  rows: Satir[],
  enFazla: number,
  aramaTerimi: string
): Promise<{ eklenen: number; yarimKaldi: boolean; not?: string; yazilanIdler: string[]; zatenVar: string[] }> {
  const ids = rows.map((x) => String(x.id));
  let mevcut = new Set<string>();
  if (ids.length) {
    const { data } = await supabase.from('ictihat_kararlar').select('id').in('id', ids);
    mevcut = new Set(((data ?? []) as Array<{ id: string }>).map((x) => x.id));
  }

  const zatenVar = rows.map((r) => String(r.id)).filter((id) => mevcut.has(id));
  const yeniler = rows.filter((r) => !mevcut.has(String(r.id)));
  const yarimKaldi = yeniler.length > enFazla;
  const alinacak = yeniler.slice(0, enFazla);
  if (alinacak.length === 0) return { eklenen: 0, yarimKaldi, yazilanIdler: [], zatenVar };

  const metinler = await havuzda(alinacak, ES_ZAMAN, async (row) => {
    const id = String(row.id);
    return kaynak === 'emsal' ? await emsalDoc(id) : await bedestenDoc(id);
  });

  // 200 karakterin altı gerçek karar metni değil (boş kabuk ya da hata sayfası).
  const yazilacak = alinacak
    .map((row, i) => ({ row, text: metinler[i] }))
    .filter((x) => typeof x.text === 'string' && x.text.length >= 200)
    .map(({ row, text }) => ({
      id: String(row.id),
      kurul: kurulOf(row.daire),
      daire: row.daire ?? null,
      esas_no: row.esasNo ?? null,
      karar_no: row.kararNo ?? null,
      karar_tarihi: row.kararTarihi ?? null,
      durum: row.durum ?? null,
      arama_terimi: aramaTerimi,
      full_text: text as string,
    }));

  if (yazilacak.length === 0) return { eklenen: 0, yarimKaldi, yazilanIdler: [], zatenVar };

  const { error } = await supabase.from('ictihat_kararlar').upsert(yazilacak, { onConflict: 'id' });
  // YAZMA HATASI SESSİZ KALMAZ. Eski döngü hatayı yutuyordu: `if (!error)
  // eklenen++` yazamayınca sayacı artırmıyor ama HİÇBİR ŞEY SÖYLEMİYORDU.
  // Toplu yazmada bu daha da kritik: tek hata tüm sayfayı kaybettirir.
  if (error) {
    return { eklenen: 0, yarimKaldi, not: `upsert: ${String(error.message).slice(0, 90)}`, yazilanIdler: [], zatenVar };
  }
  return { eklenen: yazilacak.length, yarimKaldi, yazilanIdler: yazilacak.map((x) => x.id), zatenVar };
}

/**
 * KATALOG TURU — metni HANGİ kararlar için indireceğimize biz karar veriyoruz.
 *
 * ESKİ DAVRANIŞ: bir anahtar kelime listesi dolaşılır, o terimin arama
 * sonuçlarındaki kararların metni indirilirdi. Yani havuzun içeriğini
 * RASTLANTI belirliyordu ve "elimizde ne yok" sorusunun cevabı yoktu.
 *
 * YENİ: katalog (0124) korpusun tamamını üstveri olarak sayıyor. Metin hasadı
 * artık o katalogtan besleniyor: metni olmayan kararlar arasından EN YENİSİ
 * önce. Böylece hem sıralama açık (avukat için 2024 kararı 2006'dan değerli)
 * hem de "ne kadarının metni var" ölçülebilir bir sayı oluyor.
 *
 * Yinelenen indirme pratikte sıfır: katalog satırı metin geldiğinde
 * işaretleniyor, kuyruk bir daha o kararı vermiyor.
 */
async function katalogTuru(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  kaynak: string,
  enFazla: number
): Promise<Response> {
  const tur = kaynak === 'danistay' ? 'DANISTAYKARAR' : 'YARGITAYKARARI';
  const bas = { ...CORS, 'Content-Type': 'application/json' };
  const cevap = (o: Record<string, unknown>, durum = 200) =>
    new Response(JSON.stringify({ kaynak, mod: 'katalog', ...o }), { status: durum, headers: bas });

  const { data, error } = await supabase
    .from('ictihat_katalog')
    .select('id, daire, esas_yil, esas_sira, karar_yil, karar_sira, karar_tarihi')
    .eq('tur', tur)
    .eq('metin_var', false)
    .order('son_deneme', { ascending: true, nullsFirst: true })
    .order('karar_tarihi', { ascending: false })
    .limit(enFazla);

  if (error) return cevap({ error: 'katalog_state_failed', detail: String(error.message).slice(0, 120) }, 500);
  type K = {
    id: string; daire: string | null;
    esas_yil: number | null; esas_sira: number | null;
    karar_yil: number | null; karar_sira: number | null;
    karar_tarihi: string | null;
  };
  const kayitlar = (data ?? []) as K[];
  if (kayitlar.length === 0) return cevap({ eklenen: 0, not: 'katalogda metinsiz karar yok' });

  // Denendi işareti ÖNCE konuyor: tur yarıda düşse bile aynı kararlar bir
  // sonraki turda kuyruğun başında tekrar durmasın.
  const idler = kayitlar.map((k) => k.id);
  await supabase
    .from('ictihat_katalog')
    .update({ son_deneme: new Date().toISOString() })
    .in('id', idler);

  const rows: Satir[] = kayitlar.map((k) => ({
    id: k.id,
    daire: k.daire ?? '',
    esasNo: k.esas_yil != null ? `${k.esas_yil}/${k.esas_sira}` : '',
    kararNo: k.karar_yil != null ? `${k.karar_yil}/${k.karar_sira}` : '',
    // ictihat_kararlar.karar_tarihi metin ve "GG.AA.YYYY" biçiminde tutuluyor.
    kararTarihi: k.karar_tarihi ? String(k.karar_tarihi).slice(0, 10).split('-').reverse().join('.') : '',
  }));

  const { eklenen, not, yazilanIdler, zatenVar } = await belgeleriAl(
    supabase,
    kaynak,
    rows,
    enFazla,
    'katalog'
  );

  // Metni artık elimizde olanları kuyruktan düşür. `zatenVar` de işaretleniyor:
  // o kararlar ictihat_kararlar'a başka bir yoldan (terim modu) girmiş demektir
  // ve katalog bunu bilmiyordu.
  const bitenler = [...yazilanIdler, ...zatenVar];
  if (bitenler.length) {
    await supabase.from('ictihat_katalog').update({ metin_var: true }).in('id', bitenler);
  }

  return cevap({
    istenen: kayitlar.length,
    eklenen,
    zaten_vardi: zatenVar.length,
    ...(not ? { not } : {}),
  });
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
  // MOD. 'terim' = eski davranış (anahtar kelime listesi). 'katalog' = metni
  // olmayan kararları katalogdan alır; yalnız Bedesten kaynaklarında
  // (yargitay/danistay) var, çünkü katalog o uçtan sayılıyor.
  let mod: 'terim' | 'katalog' = 'terim';
  try {
    const body = await req.json();
    if (body?.kaynak === 'yargitay' || body?.kaynak === 'danistay') kaynak = body.kaynak;
    // TAVAN 10 → 40. Eski tavanın sebebi süre bütçesiydi: her belge arasında
    // 300 ms uyku olduğu için 10 belge ~13 saniye sürüyordu. Eşzamanlılık 4 ile
    // ölçülen hız 4,24 belge/sn; 40 belge ~10 saniye. Yani tur başına karar
    // dört katına çıkarken turun süresi kısalıyor.
    enFazla = Math.min(40, Math.max(1, Number(body?.enFazla ?? 6)));
    if (body?.mod === 'katalog' && kaynak !== 'emsal') mod = 'katalog';
  } catch {
    // gövdesiz çağrı: varsayılan
  }

  if (mod === 'katalog') return await katalogTuru(supabase, kaynak, enFazla);

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

  const { eklenen, yarimKaldi, not: yazmaNotu } = await belgeleriAl(supabase, kaynak, rows, enFazla, terim);

  /**
   * SAYFANIN YARISI ÇÖPE GİDİYORDU — BULUNAN KAYIP.
   *
   * PAGE_SIZE 20, ama `enFazla` en çok 10 (cron da 10 geçiyor). Döngü 10 YENİ
   * kayıt sonrası kırılıyordu; ardından sayfa KOŞULSUZ ilerletiliyordu:
   *     next_page: sonSayfa ? 1 : page + 1
   * Yani bir sayfada 20 yeni karar varsa 10'u alınıp KALAN 10'U BİR DAHA HİÇ
   * GÖRÜLMÜYORDU. Sayfa geçilmişti; terim ancak listenin sonuna varıp başa
   * döndüğünde oraya uğrayabilirdi.
   *
   * ÖLÇÜMLE BİRLEŞİNCE ANLAM KAZANDI: 404 terimin TAMAMI 2-5. sayfada.
   * Hiçbiri ilerlememiş, hiçbiri bitmemiş. Yani atlanan kararların geri
   * dönüşü pratikte hiç olmuyordu — sayfa başına en çok %50 kalıcı kayıp.
   *
   * DÜZELTME: kotaya takılıp sayfayı BİTİREMEDİYSEK sayfa İLERLEMEZ. Sonraki
   * tur aynı sayfayı yeniden çeker; ilk 10'u `mevcut` süzgeci yinelenen diye
   * eler ve kalanlar alınır. Sonsuz döngü olmaz: iki tur sonra sayfada yeni
   * kalmaz, kotaya takılmayız ve sayfa normal şekilde ilerler.
   *
   * UYAP'A EK YÜK GETİRMEZ: tur başına yine bir liste isteği + en çok 10 belge
   * isteği. Sadece artık indirdiğimizi çöpe atmıyoruz.
   *
   * `done` da yarım sayfada işaretlenmez; yoksa terim biten sayılıp taramadan
   * düşerdi.
   *
   * Karar mantığı _shared/hasatSayfa.ts'te ve testli: edge çalışma zamanında
   * gömülü kalsaydı yalnız canlıda fark edilebilirdi — nitekim aylarca öyle oldu.
   */
  const karar = sonrakiSayfa({ sayfa: page, satir: rows.length, sayfaBoyu: PAGE_SIZE, yarimKaldi });
  await supabase
    .from('ictihat_harvest_state')
    .update({
      next_page: karar.sonrakiSayfa,
      done: karar.bitti,
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
      // Kotaya takılıp sayfa yarım kaldıysa SÖYLE: teşhis sorgusu bunu sayıp
      // "kota mı dar, sonuç mu yok" ayrımını yapabilsin.
      ...(yarimKaldi ? { yarim: true } : {}),
      // Toplu yazma düştüyse SÖYLE. Eski döngü hatayı yutuyordu.
      ...(yazmaNotu ? { not: yazmaNotu } : {}),
      // Öncelik sıralaması çalışmadıysa bunu SÖYLE. Sessizce eski davranışa
      // dönmek, "öncelikli hasat açık" sanmamıza yol açardı.
      ...(oncelikliCalisti ? {} : { uyari: 'oncelik_sutunu_yok__last_run_ile_siralandi' }),
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
