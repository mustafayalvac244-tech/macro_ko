// src/data/laws/<slug>.json içindeki maddeleri Supabase'e yükler (upsert).
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/load-law-db.mjs iyuk iik
//
// (kanun_short, madde_no) tekil olduğu için tekrar çalıştırmak güvenlidir:
// var olan madde güncellenir, yenisi eklenir. fts/fts_simple/fts_w üretilmiş
// sütunlar olduğu için yazma sırasında kendiliğinden kurulur; embedding NULL
// kalır ve scripts/embed-ictihat.mjs (EMBED_KAYNAK=mevzuat) ile doldurulur.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = dirname(dirname(fileURLToPath(import.meta.url)));
const url = process.env.SUPABASE_URL ?? '';
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !svc) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}

const sluglar = process.argv.slice(2);
if (sluglar.length === 0) {
  console.error('HATA: en az bir slug verin (ör. iyuk iik).');
  process.exit(1);
}

const PARCA = 200;

for (const slug of sluglar) {
  const dosya = join(KOK, 'src', 'data', 'laws', `${slug}.json`);
  const kanun = JSON.parse(readFileSync(dosya, 'utf8'));
  const satirlar = kanun.articles.map((a) => ({
    kanun_short: kanun.short,
    kanun_name: kanun.name,
    madde_no: String(a.no),
    baslik: a.title || null,
    metin: a.text,
    section: a.section || null,
  }));

  let yazilan = 0;
  for (let i = 0; i < satirlar.length; i += PARCA) {
    const dilim = satirlar.slice(i, i + PARCA);
    const res = await fetch(
      `${url}/rest/v1/mevzuat_maddeleri?on_conflict=kanun_short,madde_no`,
      {
        method: 'POST',
        headers: {
          apikey: svc,
          Authorization: `Bearer ${svc}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(dilim),
      }
    );
    if (!res.ok) {
      console.error(`${kanun.short}: yazılamadı ${res.status} ${(await res.text()).slice(0, 300)}`);
      process.exit(1);
    }
    yazilan += dilim.length;
    process.stdout.write(`\r${kanun.short}: ${yazilan}/${satirlar.length}`);
  }
  console.log(`\r${kanun.short}: ${yazilan} madde yazıldı.`);
}
