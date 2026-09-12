// SALT OKUNUR RAPOR KOŞTURUCU.
//
// NEDEN BU DOSYA VAR. Ölçüm sorguları (scripts/*.sql) bugüne kadar Supabase
// SQL Editor'e ELLE yapıştırılıyordu; yani "hasat performansı ne durumda"
// sorusunun cevabı, birinin oturup sorguyu çalıştırmasına bağlıydı. Soru sık
// soruluyor ve cevabın elle alınması, çoğu zaman hiç alınmaması demek.
//
// migration-uygula.mjs aynı API ucunu kullanıyor ama adı ve amacı YAZMAKTIR.
// Bir raporu oradan geçirmek, ileride yanlışlıkla yazan bir dosyanın "rapor"
// diye koşturulmasına kapı açar. Bu yüzden ayrı bir dosya ve tek bir kural:
//
//   YALNIZ scripts/ ALTINDAKİ .sql DOSYALARI, VE İÇERİĞİ YAZMA İÇERMEMELİ.
//
// İçerik denetimi kaba görünebilir ama amacı kaba: bu yolun bir daha asla
// canlı veriyi değiştirmemesi. Migration uygulamak için migration-uygula.mjs
// duruyor; burası yalnız okur.
//
// KULLANIM: SUPABASE_ACCESS_TOKEN=... node scripts/rapor-kos.mjs hasat-tek-rapor

import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'wjshlysfmeqlnfiibknj';

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN gerekli.');
  process.exit(1);
}

const ad = process.argv[2];
if (!ad) {
  console.error('Kullanım: node scripts/rapor-kos.mjs <rapor-adi>   (scripts/<ad>.sql)');
  process.exit(1);
}

// Dizin dışına çıkılamaz: ".." ya da eğik çizgi içeren ad kabul edilmiyor.
if (basename(ad) !== ad) {
  console.error('Rapor adı yalnız dosya adı olabilir (yol içeremez).');
  process.exit(1);
}

const yol = join('scripts', `${ad}.sql`);
let sql;
try {
  sql = await readFile(yol, 'utf8');
} catch {
  console.error(`${yol} bulunamadı.`);
  process.exit(1);
}

// YAZMA DENETİMİ. Yorumlar çıkarıldıktan sonra bakılıyor — bir yorumda geçen
// "update" kelimesi raporu reddetmesin, ama gerçek bir UPDATE geçmesin.
const kod = sql
  .replace(/--[^\n]*/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');
const YASAK = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment\s+on)\b/i;
const bulunan = kod.match(YASAK);
if (bulunan) {
  console.error(
    `REDDEDİLDİ: bu dosya veri değiştirebilir ("${bulunan[0]}").\n` +
    'Rapor koşturucu yalnız okuyan sorguları çalıştırır.\n' +
    'Migration uygulamak için: scripts/migration-uygula.mjs'
  );
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const metin = await res.text();
if (!res.ok) {
  console.error(`HATA ${res.status}: ${metin.slice(0, 600)}`);
  process.exit(1);
}

let satirlar;
try {
  satirlar = JSON.parse(metin);
} catch {
  console.log(metin);
  process.exit(0);
}

if (!Array.isArray(satirlar) || satirlar.length === 0) {
  console.log('(sonuç yok)');
  process.exit(0);
}

// Sonucu okunur bir tablo olarak yaz. Ham JSON, uzun raporlarda okunmuyor.
const sutunlar = [...new Set(satirlar.flatMap((s) => Object.keys(s)))];
const genislik = sutunlar.map((c) =>
  Math.max(c.length, ...satirlar.map((s) => String(s[c] ?? '').length))
);
const satir = (h) => h.map((v, i) => String(v ?? '').padEnd(genislik[i])).join('  ');

console.log(satir(sutunlar));
console.log(genislik.map((g) => '─'.repeat(g)).join('  '));
for (const s of satirlar) console.log(satir(sutunlar.map((c) => s[c])));
console.log(`\n${satirlar.length} satır.`);
