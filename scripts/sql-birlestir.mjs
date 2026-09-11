// MIGRATION BİRLEŞTİRİCİ — Supabase SQL Editor'e TEK SEFERDE yapıştırmak için.
// ---------------------------------------------------------------------------
// NEDEN VAR. Migration'lar canlıya elle, SQL Editor'den yapıştırılarak
// uygulanıyor. Beş dosyayı tek tek yapıştırmak iki hata üretir: sıra karışır
// ve biri unutulur. Unutulan bir migration sessiz kalır — 0093'te tam olarak
// bu oldu, uygulanıp uygulanmadığını haftalarca bilemedik.
//
// NEDEN ELLE YAZILMIŞ BİR BİRLEŞİK DOSYA DEĞİL: kopya, kaynağından ayrışır.
// Bu betik her koşuda migration'ları DOSYADAN okur; birleşik çıktı ile
// supabase/migrations/ arasında fark oluşamaz.
//
// Kullanım:
//   node scripts/sql-birlestir.mjs hasat-baslat 0093 0094 0101 0102 0103
// Çıktı:
//   scripts/birlesik/hasat-baslat.sql
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG = join(KOK, 'supabase', 'migrations');

const [ad, ...numaralar] = process.argv.slice(2);
if (!ad || numaralar.length === 0) {
  console.error('Kullanım: node scripts/sql-birlestir.mjs <ad> <numara...>');
  process.exit(1);
}

const hepsi = readdirSync(MIG).filter((f) => f.endsWith('.sql'));
const parcalar = [];

for (const n of numaralar) {
  const eslesen = hepsi.filter((f) => f.startsWith(`${n}_`));
  if (eslesen.length !== 1) {
    // Sessizce atlamak, eksik bir migration'ı "uygulandı" sanmamıza yol açardı.
    console.error(`HATA: ${n} için ${eslesen.length} dosya bulundu (1 bekleniyordu).`);
    process.exit(1);
  }
  parcalar.push({ dosya: eslesen[0], icerik: readFileSync(join(MIG, eslesen[0]), 'utf8') });
}

const baslik = `-- ===========================================================================
-- BİRLEŞİK MIGRATION: ${ad}
-- Üreten: scripts/sql-birlestir.mjs — ELLE DÜZENLEME. Kaynak dosyalar:
${parcalar.map((p) => `--   supabase/migrations/${p.dosya}`).join('\n')}
--
-- NASIL UYGULANIR: Supabase → SQL Editor → hepsini yapıştır → Run.
-- Hepsi tekrar çalıştırılabilir (idempotent): daha önce uygulanmış olanlar
-- zarar vermeden yeniden çalışır. Bu yüzden "hangisi uygulanmıştı" diye
-- düşünmene gerek yok.
-- ===========================================================================

`;

const govde = parcalar
  .map(
    (p) => `
-- ═══════════════════════════════════════════════════════════════════════════
-- ${p.dosya}
-- ═══════════════════════════════════════════════════════════════════════════
${p.icerik.trimEnd()}
`
  )
  .join('\n');

mkdirSync(join(KOK, 'scripts', 'birlesik'), { recursive: true });
const yol = join(KOK, 'scripts', 'birlesik', `${ad}.sql`);
writeFileSync(yol, baslik + govde + '\n');
console.log(`${yol} üretildi: ${parcalar.length} migration, ${(baslik + govde).length} karakter`);
