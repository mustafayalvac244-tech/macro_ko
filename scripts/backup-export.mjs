#!/usr/bin/env node
/**
 * ÜCRETSİZ YEDEK — KATMAN 2: dışarı (off-site) yedek.
 *
 * Supabase Free planda otomatik yedek/PITR yoktur. Katman 1 (veritabanı içi
 * günlük anlık görüntü) yanlış silme/bozulmaya karşı korur ama proje tamamen
 * kaybolursa işe yaramaz. Bu betik tüm kullanıcı verisini PostgREST üzerinden
 * JSON'a döker; GitHub Actions bunu ŞİFRELEYİP artefakt olarak saklar.
 *
 * Ortam değişkenleri:
 *   SUPABASE_URL          https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role anahtarı (RLS'i aşar, tüm satırları okur)
 *   OUT_DIR               çıktı klasörü (varsayılan: ./backup-out)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;
const OUT_DIR = process.env.OUT_DIR || 'backup-out';

if (!URL_BASE || !KEY) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_KEY gerekli.');
  process.exit(1);
}

/** Kullanıcı verisi. İçtihat/mevzuat gibi yeniden üretilebilir referans veri hariç. */
const TABLES = [
  'profiles', 'clients', 'cases', 'hearings', 'deadlines', 'documents',
  'finance_entries', 'payments', 'payment_promises', 'case_expenses',
  'case_installments', 'client_advances', 'client_expenses',
  'enforcement_files', 'enforcement_collections', 'jobs', 'offices',
  'office_members', 'purchases', 'question_answers', 'feedback', 'ai_usage',
];

const PAGE = 1000;

async function dumpTable(table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${URL_BASE}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      // Tablo yoksa/erişilemiyorsa yedeği komple düşürme; not düşüp devam et.
      console.warn(`  ! ${table}: HTTP ${res.status} — atlandı`);
      return null;
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir(OUT_DIR, { recursive: true });

const summary = {};
let total = 0;
for (const table of TABLES) {
  const rows = await dumpTable(table);
  if (rows === null) continue;
  await writeFile(path.join(OUT_DIR, `${table}.json`), JSON.stringify(rows), 'utf8');
  summary[table] = rows.length;
  total += rows.length;
  console.log(`  ✓ ${table}: ${rows.length} satır`);
}

await writeFile(
  path.join(OUT_DIR, '_manifest.json'),
  JSON.stringify({ takenAt: new Date().toISOString(), stamp, totalRows: total, tables: summary }, null, 2),
  'utf8'
);

console.log(`\nToplam ${total} satır, ${Object.keys(summary).length} tablo → ${OUT_DIR}`);
if (total === 0) {
  console.error('HATA: hiç satır alınamadı — yedek geçersiz sayılır.');
  process.exit(1);
}
