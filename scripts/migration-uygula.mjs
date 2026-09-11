// MIGRATION UYGULAYICI — SQL'i elle yapıştırmayı bitirir.
// ---------------------------------------------------------------------------
// NEDEN VAR. Migration'lar bugüne kadar Supabase SQL Editor'e ELLE
// yapıştırılarak uygulandı. Bu üç ayrı soruna yol açtı:
//   • Hangi dosyanın uygulandığı kimse tarafından kaydedilmiyordu (0093/0094'ün
//     uygulanıp uygulanmadığını haftalarca bilemedik).
//   • Çok ifadeli dosyalarda Editor yalnız SON sorgunun sonucunu gösteriyor,
//     yani doğrulama çıktıları görünmüyordu.
//   • Her seferinde birinden "şunu çalıştır" diye istemek gerekiyordu.
//
// Supabase Management API'nin sorgu ucu bunu gereksiz kılıyor:
//     POST /v1/projects/{ref}/database/query   { "query": "..." }
// Kimlik: SUPABASE_ACCESS_TOKEN (hesap düzeyinde erişim belirteci; zaten
// edge dağıtımı için depo secret'ı olarak tanımlı).
//
// ── GÜVENLİK SINIRLARI (bilinçli olarak dar) ────────────────────────────────
//  • Dosya listesi AÇIKÇA verilmeli. "Hepsini uygula" gibi bir kip YOK —
//    depodaki 100+ migration'ı topluca çalıştırmak canlıyı bozabilir.
//  • Yalnız supabase/migrations altındaki dosyalar; yol dışarı çıkamaz.
//  • İlk hatada DURUR. Sıradaki migration öncekinin başarılı olduğunu varsayar.
//  • Belirteç yalnız ortamdan okunur, hiçbir yere yazılmaz, çıktıda görünmez.
//
// Kullanım:  node scripts/migration-uygula.mjs 0106 0107

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG = join(KOK, 'supabase', 'migrations');
const REF = process.env.SUPABASE_PROJECT_REF || 'wjshlysfmeqlnfiibknj';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

const numaralar = process.argv.slice(2).filter(Boolean);

if (!TOKEN) {
  console.error('HATA: SUPABASE_ACCESS_TOKEN tanımlı değil.');
  process.exit(1);
}
if (numaralar.length === 0) {
  console.error('HATA: uygulanacak migration numarası verilmedi. Örn: 0106 0107');
  console.error('Toplu uygulama kipi bilerek yok — canlıda topluca çalıştırmak bozucudur.');
  process.exit(1);
}

const hepsi = readdirSync(MIG).filter((f) => f.endsWith('.sql'));

/** Numaradan tek bir dosyaya çözer; belirsizlik varsa durur. */
function dosyaBul(n) {
  const eslesen = hepsi.filter((f) => f.startsWith(`${n}_`));
  if (eslesen.length !== 1) {
    console.error(`HATA: ${n} için ${eslesen.length} dosya bulundu (1 bekleniyordu).`);
    process.exit(1);
  }
  return eslesen[0];
}

async function calistir(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const metin = await res.text();
  let govde;
  try {
    govde = JSON.parse(metin);
  } catch {
    govde = metin;
  }
  return { ok: res.ok, durum: res.status, govde };
}

let hata = 0;
for (const n of numaralar) {
  const dosya = dosyaBul(n);
  const sql = readFileSync(join(MIG, dosya), 'utf8');
  process.stdout.write(`\n── ${dosya} (${sql.length} karakter) ────────────────\n`);

  const r = await calistir(sql);
  if (!r.ok) {
    // Hata gövdesi PostgreSQL'in kendi mesajını taşır; kısaltmadan yazıyoruz
    // çünkü asıl teşhis oradadır (42601, 42703, 42P13 gibi kodlar).
    console.error(`HATA (HTTP ${r.durum}):`);
    console.error(typeof r.govde === 'string' ? r.govde : JSON.stringify(r.govde, null, 2));
    hata = 1;
    console.error('\nİlk hatada duruldu — sıradaki migration çalıştırılmadı.');
    break;
  }

  // Uç, SON ifadenin satırlarını döndürür. Doğrulama sorgusu olan
  // migration'larda tablo burada görünür; Editor'deki "yalnız son sorgu"
  // kısıtı burada bir SORUN DEĞİL çünkü doğrulamayı zaten sona koyuyoruz.
  const satirlar = Array.isArray(r.govde) ? r.govde : [];
  if (satirlar.length === 0) {
    console.log('UYGULANDI (sonuç satırı yok).');
  } else {
    console.log(`UYGULANDI — ${satirlar.length} satır döndü:`);
    for (const s of satirlar) console.log('  ' + JSON.stringify(s, null, 0));
  }
}

process.exit(hata);
