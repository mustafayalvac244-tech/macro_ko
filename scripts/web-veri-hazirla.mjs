#!/usr/bin/env node
// WEB DIŞA AKTARIMI ÖNCESİ VERİ HAZIRLIĞI
// ---------------------------------------------------------------------------
// Kanun metinleri (src/data/laws/*.json, ~5,2 MB) web'de JS paketine
// GÖMÜLMEZ; ağdan indirilir (bkz. src/data/laws/loader.web.ts). Bu betik o
// dosyaları Expo'nun web çıktısına aynen kopyaladığı `public/` klasörüne
// yerleştirir.
//
// Expo belgesi (Router → Static Rendering): "Expo CLI supports a root public
// directory that gets copied to the dist directory during static rendering."
// `/assets` yolu Metro tarafından rezerve; bu yüzden `veri/kanun` kullanıyoruz.
//
// KOPYA, DEPOYA GİRMEZ: public/veri .gitignore'da. Tek doğruluk kaynağı
// src/data/laws altındaki dosyalardır.
import { readdir, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kaynak = join(kok, 'src', 'data', 'laws');
const hedef = join(kok, 'public', 'veri', 'kanun');

// Eski kopyalar kalmasın (kanun silinirse web'de hayalet dosya kalmasın).
await rm(hedef, { recursive: true, force: true });
await mkdir(hedef, { recursive: true });

const dosyalar = (await readdir(kaynak)).filter((f) => f.endsWith('.json'));
let toplam = 0;
for (const f of dosyalar) {
  await copyFile(join(kaynak, f), join(hedef, f));
  toplam += (await stat(join(kaynak, f))).size;
}
console.log(`web verisi hazır: ${dosyalar.length} kanun dosyası, ${(toplam / 1024 / 1024).toFixed(2)} MB → public/veri/kanun`);
