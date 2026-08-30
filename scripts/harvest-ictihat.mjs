#!/usr/bin/env node
// Vekil :: İçtihat hasatçısı (harvester)
// ---------------------------------------------------------------------------
// UYAP Emsal (emsal.uyap.gov.tr) — Yargıtay, Danıştay, BAM/BİM kararlarının
// kamuya açık resmi bankası — üzerinden sürekli karar toplayıp kendi
// `ictihat_kararlar` havuzumuza biriktirir. Her çalışmada seed terimleri
// kaldığı sayfadan devam ettirir; böylece havuz zamanla büyür ve güçlenir.
//
// Çalıştırma (yerel veya GitHub Actions cron):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   [GEMINI_API_KEY=...] node scripts/harvest-ictihat.mjs
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (zorunlu; DRY modda gerekmez)
//   GEMINI_API_KEY                            (opsiyonel; varsa embedding üretir)
//   HARVEST_MAX          bu çalışmada eklenecek en fazla yeni karar (vars. 400)
//   HARVEST_TERMS        bu çalışmada işlenecek terim sayısı (vars. 10)
//   HARVEST_PAGE_SIZE    Emsal sayfa boyutu (vars. 20)
//   HARVEST_DRY=1        DB'ye yazma; sadece tara ve raporla (test için)
//   HARVEST_ONLY         virgüllü filtre; yalnız eşleşen terimleri hasat et
//   HARVEST_SOURCE       'emsal' (BAM/yerel, vars.) | 'yargitay' | 'danistay'
//                        UYAP Emsal Yargıtay İÇERMEZ; Yargıtay/Danıştay için
//                        Bedesten (bedesten.adalet.gov.tr) kullanılır.
//   HARVEST_DOC_DELAY / HARVEST_TERM_DELAY / HARVEST_RETRY_BASE  (ms)
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const EMSAL = 'https://emsal.uyap.gov.tr';
const EMBED_MODEL = 'text-embedding-004';
const __dirname = dirname(fileURLToPath(import.meta.url));

const DRY = process.env.HARVEST_DRY === '1';
const MAX_NEW = Number(process.env.HARVEST_MAX ?? 400);
const TERMS_PER_RUN = Number(process.env.HARVEST_TERMS ?? 10);
const PAGE_SIZE = Number(process.env.HARVEST_PAGE_SIZE ?? 20);
// UYAP Emsal 300ms'lik hızda 429 veriyordu; varsayılan yavaşlatıldı.
const DOC_DELAY = Number(process.env.HARVEST_DOC_DELAY ?? 1200);
const TERM_DELAY = Number(process.env.HARVEST_TERM_DELAY ?? 2500);
const RETRY_BASE = Number(process.env.HARVEST_RETRY_BASE ?? 4000);
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
// Kaynak: 'emsal' (BAM/yerel) | 'yargitay' | 'danistay'. UYAP Emsal Yargıtay
// içermediği için Yargıtay/Danıştay Bedesten'den toplanır.
const SOURCE = process.env.HARVEST_SOURCE || 'emsal';
// Belirli konuları hedefle: virgülle ayrılmış parçalar, terimde geçen (küçük
// harfe indirgenmiş) alt dize olarak eşleşir. Havuzda boş kalan bir konuyu
// hemen doldurmak için kullanılır. Boşsa tüm terimler sıradan işlenir.
const ONLY = (process.env.HARVEST_ONLY || '').toLocaleLowerCase('tr').split(',').map((x) => x.trim()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a);
}

/** daire metninden kurulu türet. */
function kurulOf(daire = '') {
  const d = daire.toLocaleLowerCase('tr');
  if (d.includes('bölge adliye')) return 'BAM';
  if (d.includes('bölge idare')) return 'BİM';
  if (d.includes('danıştay')) return 'Danıştay';
  if (d.includes('yargıtay')) return 'Yargıtay';
  if (d.includes('anayasa')) return 'AYM';
  return 'Diğer';
}

function htmlToText(html = '') {
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

/**
 * 429 (hız sınırı) için üstel bekleme ile yeniden dener.
 *
 * UYAP Emsal sabit hızda istek atınca hızla 429 veriyordu ve eski kod hatayı
 * yutup KARARI ATLIYORDU — yani hasat neredeyse hiç veri toplayamıyordu.
 * Artık 429 alınca bekleyip tekrar denenir; kalıcı kayıp olmaz.
 */
async function withRetry(fn, label, tries = 4) {
  let wait = RETRY_BASE;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const rate = /\b429\b/.test(String(e.message));
      if (!rate || i === tries) throw e;
      log(`   ${label}: hız sınırı, ${wait}ms bekleniyor (deneme ${i}/${tries})`);
      await sleep(wait);
      wait *= 2; // üstel geri çekilme
    }
  }
  throw new Error(`${label}: tükendi`);
}

/**
 * UYAP Emsal'de arama terimini normalleştirir.
 *
 * ÖLÇÜLDÜ: kesme işareti aramayı tamamen öldürüyor —
 *   "zamanaşımı def'i" → 0 kayıt   |   "zamanaşımı defi" → 86.985 kayıt
 * Apostrof içeren terimler sessizce hiç sonuç getirmediği için o konudaki
 * içtihat havuza hiç girmiyordu. Kesme işaretleri temizlenir.
 */
function normalizeTerm(terim) {
  return terim.replace(/['\u2019\u02bc]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * UYAP hız sınırına takılınca 429 DÖNDÜRMÜYOR — HTTP 200 ile boş sonuç
 * döndürüyor. Ölçüldü: art arda sorguda "ihya davası" 0 kayıt verdi, 12 sn
 * beklendikten sonra aynı terim 16.932 kayıt verdi ("tapu iptali ve tescil"
 * 0 → 514.802). Bu sahte sıfır, hasatçıda terimi "bitti" (done) işaretleyip
 * o konudaki içtihadın havuza HİÇ girmemesine yol açıyordu.
 *
 * Bu yüzden 1. sayfada 0 sonuç, "sonuç yok" değil "muhtemel throttle" sayılır
 * ve yeniden denenir. Gerçekten boş terimler denemeler bitince 0 kalır.
 */
class ThrottledZero extends Error {
  constructor(terim) {
    super(`arama "${terim}": 429`); // withRetry'ın hız-sınırı dalına düşsün
  }
}

async function emsalSearch(terim, page) {
  terim = normalizeTerm(terim);
  const res = await fetch(`${EMSAL}/aramalist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${EMSAL}/`,
    },
    body: JSON.stringify({ data: { arananKelime: terim, pageSize: PAGE_SIZE, pageNumber: page } }),
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const j = await res.json();
  const rows = j?.data?.data ?? [];
  const total = Number(j?.data?.recordsTotal ?? 0);
  // 1. sayfada hiç sonuç yoksa bu büyük ihtimalle sahte sıfır (throttle).
  if (page === 1 && total === 0 && rows.length === 0) throw new ThrottledZero(terim);
  return { rows, total };
}


// ---------------------------------------------------------------------------
// Bedesten (bedesten.adalet.gov.tr) — Adalet Bakanlığı birleşik karar bankası.
//
// NEDEN GEREKLİ: UYAP Emsal YARGITAY KARARI İÇERMEZ; yalnızca BAM/BİM ve yerel
// mahkeme kararları döner. Bu yüzden hasat aylarca sadece BAM biriktirdi,
// Yargıtay havuzu sabit kaldı. Avukat için Yargıtay kararı BAM'dan daha
// değerlidir (yerleşik içtihat). Yargıtay/Danıştay buradan toplanır.
// ---------------------------------------------------------------------------
const BEDESTEN = 'https://bedesten.adalet.gov.tr';
const BEDESTEN_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
  AdaletApplicationName: 'UyapMevzuat',
};

function b64ToUtf8(b64) {
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return b64;
  }
}

async function bedestenSearch(terim, page, itemType = 'YARGITAYKARARI') {
  const res = await fetch(`${BEDESTEN}/emsal-karar/searchDocuments`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({ data: { pageSize: PAGE_SIZE, pageNumber: page, itemTypeList: [itemType], phrase: normalizeTerm(terim) } }),
  });
  if (!res.ok) throw new Error(`bedesten ${res.status}`);
  const j = await res.json();
  // Bedesten HTTP 200 dönüp arka planda çökebiliyor; bunu "sonuç yok" sanma.
  const meta = j?.metadata ?? {};
  if (meta.FMTY === 'ERROR' || String(meta.FMC ?? '').includes('EXCEPTION')) throw new Error('bedesten 429');
  const list = j?.data?.emsalKararList ?? [];
  const rows = list.map((r) => {
    const prefix = r?.itemType?.name === 'DANISTAYKARAR' ? 'Danıştay' : 'Yargıtay';
    let birim = String(r.birimAdi ?? '').trim();
    // Savunma amaçlı: birimAdi normalde ön ek içermez, içerirse çiftlemesin.
    if (birim.startsWith(prefix)) birim = birim.slice(prefix.length).trim();
    return {
      id: String(r.documentId ?? ''),
      daire: birim ? `${prefix} ${birim}` : prefix,
      esasNo: r.esasNoYil != null ? `${r.esasNoYil}/${r.esasNoSira}` : '',
      kararNo: r.kararNoYil != null ? `${r.kararNoYil}/${r.kararNoSira}` : '',
      kararTarihi: r.kararTarihi ? String(r.kararTarihi).slice(0, 10).split('-').reverse().join('.') : '',
    };
  }).filter((x) => x.id);
  return { rows, total: Number(j?.data?.total ?? 0) };
}

async function bedestenDoc(id) {
  const res = await fetch(`${BEDESTEN}/emsal-karar/getDocumentContent`, {
    method: 'POST',
    headers: BEDESTEN_HEADERS,
    body: JSON.stringify({ data: { documentId: id } }),
  });
  if (!res.ok) throw new Error(`bedesten doc ${res.status}`);
  const j = await res.json();
  const raw = j?.data?.content ?? '';
  return htmlToText(b64ToUtf8(String(raw)));
}

async function emsalDoc(id) {
  const res = await fetch(`${EMSAL}/getDokuman?id=${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: `${EMSAL}/` },
  });
  if (!res.ok) throw new Error(`doc ${res.status}`);
  const j = await res.json();
  return htmlToText(String(j?.data ?? ''));
}

async function embed(text) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 2000) }] } }),
      }
    );
    if (!res.ok) {
      log(`  embed atlandı (${res.status})`);
      return null;
    }
    const j = await res.json();
    return j?.embedding?.values ?? null;
  } catch (e) {
    log('  embed hata:', e.message);
    return null;
  }
}

/**
 * İlerleme kaydı anahtarı. Aynı terim farklı kaynaklarda (Emsal / Bedesten)
 * ayrı sayfalarda ilerlediği için kaynak adı anahtara katılır; yoksa Emsal'de
 * 5. sayfaya gelmiş bir terim Bedesten'de de 5. sayfadan başlar ve baştaki
 * kararlar hiç toplanmaz.
 */
function stateKey(terim) {
  return SOURCE === 'emsal' ? terim : `${SOURCE}:${terim}`;
}

function loadTerms() {
  const raw = readFileSync(join(__dirname, 'ictihat-terms.txt'), 'utf8');
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

async function main() {
  const terms = loadTerms();
  log(`Kaynak: ${SOURCE} · Seed terim: ${terms.length} · MAX_NEW=${MAX_NEW} · TERMS_PER_RUN=${TERMS_PER_RUN} · embedding=${GEMINI_KEY ? 'açık' : 'kapalı'} · DRY=${DRY}`);

  let supabase = null;
  if (!DRY) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (veya HARVEST_DRY=1).');
      process.exit(1);
    }
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  // Terimleri en eski işlenenden başlat: harvest_state'ten sırayı çek.
  let order = terms;
  if (supabase) {
    // Eksik terimler için state satırı oluştur.
    await supabase.from('ictihat_harvest_state').upsert(
      terms.map((t) => ({ terim: stateKey(t) })),
      { onConflict: 'terim', ignoreDuplicates: true }
    );
    const { data: states } = await supabase
      .from('ictihat_harvest_state')
      .select('terim,next_page,done,last_run')
      .order('last_run', { ascending: true, nullsFirst: true });
    if (states?.length) {
      const pref = SOURCE === 'emsal' ? '' : `${SOURCE}:`;
      order = states
        .map((s) => s.terim)
        .filter((k) => (pref ? k.startsWith(pref) : !k.includes(':')))
        .map((k) => (pref ? k.slice(pref.length) : k))
        .filter((t) => terms.includes(t));
      if (!order.length) order = terms;
    }
  }

  if (ONLY.length) {
    order = order.filter((t) => ONLY.some((f) => t.toLocaleLowerCase('tr').includes(f)));
    log(`Hedefli hasat: ${ONLY.join(', ')} → eşleşen terim: ${order.length}`);
  }
  const batch = order.slice(0, TERMS_PER_RUN);
  let added = 0;
  let scanned = 0;

  for (const terim of batch) {
    if (added >= MAX_NEW) break;

    // Bu terimin kaldığı sayfa.
    let page = 1;
    if (supabase) {
      const { data } = await supabase.from('ictihat_harvest_state').select('next_page').eq('terim', stateKey(terim)).single();
      page = data?.next_page ?? 1;
    }

    let total = 0;
    try {
      const r = await withRetry(
        () =>
          SOURCE === 'emsal'
            ? emsalSearch(terim, page)
            : bedestenSearch(terim, page, SOURCE === 'danistay' ? 'DANISTAYKARAR' : 'YARGITAYKARARI'),
        `arama "${terim}"`
      );
      total = r.total;
      const rows = r.rows;
      scanned += rows.length;
      log(`» "${terim}" s.${page} → ${rows.length} kayıt (toplam ${total.toLocaleString('tr-TR')})`);

      // Zaten havuzda olanları ele.
      const ids = rows.map((x) => String(x.id));
      let existing = new Set();
      if (supabase && ids.length) {
        const { data } = await supabase.from('ictihat_kararlar').select('id').in('id', ids);
        existing = new Set((data ?? []).map((x) => x.id));
      }

      for (const row of rows) {
        if (added >= MAX_NEW) break;
        const id = String(row.id);
        if (existing.has(id)) continue;

        await sleep(DOC_DELAY); // nazik hız (429 önleme)
        let text = '';
        try {
          text = await withRetry(() => (SOURCE === 'emsal' ? emsalDoc(id) : bedestenDoc(id)), `doc ${id}`);
        } catch (e) {
          log(`  doc ${id} hata: ${e.message}`);
          continue;
        }
        if (!text || text.length < 200) continue;

        const record = {
          id,
          kurul: kurulOf(row.daire),
          daire: row.daire ?? null,
          esas_no: row.esasNo ?? null,
          karar_no: row.kararNo ?? null,
          karar_tarihi: row.kararTarihi ?? null,
          durum: row.durum ?? null,
          arama_terimi: terim,
          full_text: text,
        };

        const vec = await embed(text);
        if (vec) record.embedding = vec;

        if (DRY) {
          log(`  + ${record.daire} E.${record.esas_no} (${text.length} krktr${vec ? ', embed' : ''})`);
        } else {
          const { error } = await supabase.from('ictihat_kararlar').upsert(record, { onConflict: 'id' });
          if (error) log(`  upsert hata ${id}: ${error.message}`);
        }
        added++;
      }

      // Durumu güncelle: son sayfa ise başa dön (güncellemeler için), değilse ilerle.
      const isLast = rows.length < PAGE_SIZE;
      if (supabase) {
        await supabase
          .from('ictihat_harvest_state')
          .update({
            next_page: isLast ? 1 : page + 1,
            done: isLast,
            total,
            last_run: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('terim', stateKey(terim));
      }
    } catch (e) {
      log(`! "${terim}" hata: ${e.message}`);
      if (supabase) {
        await supabase
          .from('ictihat_harvest_state')
          .update({ last_run: new Date().toISOString() })
          .eq('terim', stateKey(terim));
      }
    }

    await sleep(TERM_DELAY);
  }

  log(`Bitti. Bu çalışmada eklenen: ${added} · taranan: ${scanned}`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
