#!/usr/bin/env node
// Vekil :: mevzuat arama isabet ölçümü
// ---------------------------------------------------------------------------
// NEDEN VAR: AI'nin yanlış hukuk söylemesinin başlıca sebebi, doğru maddenin
// beslemeye hiç girmemesi. Madde gelmeyince model boşluğu kendi hafızasından
// dolduruyor — ölçülmüş bir örnekte tahliyede görevli mahkemeyi "asliye hukuk"
// diye yazdı; HMK m.4 sulh hukuk diyor.
//
// Bu betik, arama değişikliklerinin isabeti artırıp artırmadığını SAYIYLA
// gösterir. Elle tek tek deneyip "iyi gibi" demek ölçüm değildir; bir soruyu
// düzeltirken başka bir soruyu bozmak, ancak böyle fark edilir.
//
// Ölçüt: beklenen madde, aramanın döndürdüğü ilk K sonuç ARASINDA mı?
// (K, ai-chat'in beslemeye koyduğu madde sayısıyla aynı tutulur.)
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/eval-arama.mjs
// Env:
//   EVAL_K    kaç sonuca bakılacağı (vars. 7 — ai-chat ile aynı)
//   EVAL_RPC  ölçülecek arama fonksiyonu (vars. search_mevzuat_fts). Aday bir
//             sıralamayı yayına almadan yan yana ölçmek için kullanılır.
//   EVAL_HIBRIT=1  ai-chat'in yaptığı gibi anlamsal sonuçları da SONA ekler.
//             Sorgu vektörü yalnız edge çalışma zamanında üretilebildiği için
//             embed-ictihat işlevinden alınır.
// Çıkış kodu: bir soru bile kaçarsa 1 (CI'da gerilemeyi yakalamak için).
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const K = Number(process.env.EVAL_K ?? 7);
const RPC = process.env.EVAL_RPC || 'search_mevzuat_fts';
const HIBRIT = process.env.EVAL_HIBRIT === '1';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}

/** "TBK 315" biçimini aramanın döndürdüğü satırla karşılaştırılabilir hale getirir. */
const anahtar = (kanun, madde) => `${kanun} ${madde}`.trim();

async function ara(soru, deneme = 0) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${RPC}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: soru, match_count: K }),
  });
  if (!res.ok) {
    // Geçici sunucu hatası ölçümü sessizce bozmasın: bir kez daha dene.
    if (deneme < 2) return ara(soru, deneme + 1);
    throw new Error(`arama başarısız (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const rows = await res.json();
  const liste = rows.map((r) => anahtar(r.kanun_short, r.madde_no));
  if (!HIBRIT) return liste;

  // ai-chat ile AYNI birleştirme: anlamsal sonuçlar sona eklenir, kelime
  // sıralaması bozulmaz. Farklı birleştirseydik ölçtüğümüz şey, kullanıcının
  // gördüğü şey olmazdı.
  const vec = await sorguVektoru(soru);
  if (!vec) return liste;
  const sem = await rpc('match_mevzuat_semantic', { q_embedding: vec, match_count: 4 });
  for (const r of sem) {
    const a = anahtar(r.kanun_short, r.madde_no);
    if (!liste.includes(a)) liste.push(a);
    if (liste.length >= 10) break;
  }
  return liste;
}

async function rpc(ad, govde) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${ad}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
  return res.ok ? res.json() : [];
}

async function sorguVektoru(soru) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/functions/v1/embed-ictihat`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ embed: soru }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return Array.isArray(j?.embedding) ? j.embedding : null;
}

const { sorular } = JSON.parse(readFileSync(join(__dirname, 'arama-sorulari.json'), 'utf8'));

let toplamBeklenen = 0;
let bulunan = 0;
const kacanlar = [];
let hatali = 0;

console.log(`Mevzuat arama ölçümü · ${RPC}${HIBRIT ? ' + anlamsal' : ''} · ${sorular.length} soru · ilk ${K} sonuç\n`);

for (const s of sorular) {
  let sonuclar;
  try {
    sonuclar = await ara(s.soru);
  } catch (e) {
    // Hata alan soruyu paydadan DÜŞÜRME: düşseydi ölçüm, başarısız sorular
    // arttıkça yükselen sahte bir orana dönerdi.
    console.error(`! "${s.soru}" → ${e.message}`);
    toplamBeklenen += s.beklenen.length;
    hatali++;
    process.exitCode = 1;
    continue;
  }
  const eksik = s.beklenen.filter((b) => !sonuclar.includes(b));
  toplamBeklenen += s.beklenen.length;
  bulunan += s.beklenen.length - eksik.length;

  if (eksik.length === 0) {
    console.log(`✓ ${s.soru}`);
  } else {
    console.log(`✗ ${s.soru}`);
    console.log(`    beklenen : ${s.beklenen.join(', ')}  — KAÇAN: ${eksik.join(', ')}`);
    console.log(`    dönen    : ${sonuclar.join(', ') || '(boş)'}`);
    kacanlar.push({ soru: s.soru, eksik });
  }
}

const oran = toplamBeklenen ? ((bulunan / toplamBeklenen) * 100).toFixed(1) : '0.0';
console.log(`\n${'─'.repeat(60)}`);
console.log(`İSABET: ${bulunan}/${toplamBeklenen} beklenen madde ilk ${K} sonuçta (%${oran})`);
console.log(`Ölçülen soru: ${sorular.length}${hatali ? ` (${hatali} tanesi hata verdi)` : ''}`);

if (kacanlar.length) {
  console.log(`Kaçan madde bulunan soru sayısı: ${kacanlar.length}/${sorular.length}`);
  process.exitCode = 1;
} else {
  console.log('Tüm beklenen maddeler bulundu.');
}
