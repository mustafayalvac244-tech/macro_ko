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

async function emsalSearch(terim, page) {
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
  return { rows: j?.data?.data ?? [], total: Number(j?.data?.recordsTotal ?? 0) };
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

function loadTerms() {
  const raw = readFileSync(join(__dirname, 'ictihat-terms.txt'), 'utf8');
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

async function main() {
  const terms = loadTerms();
  log(`Seed terim: ${terms.length} · MAX_NEW=${MAX_NEW} · TERMS_PER_RUN=${TERMS_PER_RUN} · embedding=${GEMINI_KEY ? 'açık' : 'kapalı'} · DRY=${DRY}`);

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
      terms.map((t) => ({ terim: t })),
      { onConflict: 'terim', ignoreDuplicates: true }
    );
    const { data: states } = await supabase
      .from('ictihat_harvest_state')
      .select('terim,next_page,done,last_run')
      .order('last_run', { ascending: true, nullsFirst: true });
    if (states?.length) order = states.map((s) => s.terim).filter((t) => terms.includes(t));
  }

  const batch = order.slice(0, TERMS_PER_RUN);
  let added = 0;
  let scanned = 0;

  for (const terim of batch) {
    if (added >= MAX_NEW) break;

    // Bu terimin kaldığı sayfa.
    let page = 1;
    if (supabase) {
      const { data } = await supabase.from('ictihat_harvest_state').select('next_page').eq('terim', terim).single();
      page = data?.next_page ?? 1;
    }

    let total = 0;
    try {
      const r = await withRetry(() => emsalSearch(terim, page), `arama "${terim}"`);
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
          text = await withRetry(() => emsalDoc(id), `doc ${id}`);
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
          log(`  + ${record.kurul} ${record.daire} E.${record.esas_no} (${text.length} krktr${vec ? ', embed' : ''})`);
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
          .eq('terim', terim);
      }
    } catch (e) {
      log(`! "${terim}" hata: ${e.message}`);
      if (supabase) {
        await supabase
          .from('ictihat_harvest_state')
          .update({ last_run: new Date().toISOString() })
          .eq('terim', terim);
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
