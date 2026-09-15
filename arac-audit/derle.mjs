#!/usr/bin/env node
// TEK DOSYA DERLEYİCİ
//
// Neden var: modül hâlindeki uygulama `file://` ile açılmaz (tarayıcı ES modül
// yüklemesini CORS gerekçesiyle engeller). Sahadaki tabletlere sunucu kurmadan,
// USB ya da e-postayla tek bir .html göndermek en kısa yol. Bu betik tüm
// modülleri ve CSS'i tek bir HTML'e gömer.
//
// Kullanım:  node arac-audit/derle.mjs
// Çıktı:     arac-audit/tek-dosya/arac-audit.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = dirname(fileURLToPath(import.meta.url));

// Bağımlılık sırası — bir modül, kendisinden önce gelenlere dayanır.
const MODULLER = [
  'katalog.js', 'vin.js', 'zip.js', 'goruntu.js', 'xlsx.js',
  'model3d.js', 'puan.js', 'depo.js', 'rapor.js', 'uygulama.js',
];

/** Bir modülün dışa açtığı isimleri toplar (namespace içe aktarımı için). */
function disaAcilanlar(kaynak) {
  const adlar = new Set();
  const desenler = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const d of desenler) {
    for (const e of kaynak.matchAll(d)) adlar.add(e[1]);
  }
  // export { a, b };
  for (const e of kaynak.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)) {
    for (const ad of e[1].split(',')) {
      const t = ad.trim().split(/\s+as\s+/).pop()?.trim();
      if (t) adlar.add(t);
    }
  }
  return [...adlar];
}

/** import satırlarını siler, export anahtar sözcüğünü kaldırır. */
function govdeyeCevir(kaynak) {
  return kaynak
    // import * as X from '...';  ->  (aşağıda ayrıca ad alanı üretilir)
    .replace(/^import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    // import { a, b } from '...';  /  import x from '...';
    .replace(/^import\s+[^;]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    // export { a, b };
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    // export const/function/class -> const/function/class
    .replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '');
}

function derle() {
  const kaynaklar = new Map(MODULLER.map((d) => [d, readFileSync(join(KOK, 'js', d), 'utf8')]));

  // `import * as depo from './depo.js'` gibi ad alanı içe aktarımlarını topla:
  // paketlenmiş sürümde modül sınırı kalmadığı için o nesneyi elle kurmalıyız.
  const adAlanlari = new Map(); // dosya -> takma ad
  for (const kaynak of kaynaklar.values()) {
    for (const e of kaynak.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([\w.-]+)['"]/g)) {
      adAlanlari.set(e[2], e[1]);
    }
  }
  for (const dosya of adAlanlari.keys()) {
    if (!kaynaklar.has(dosya)) throw new Error(`Ad alanı içe aktarımı bilinmeyen modülü gösteriyor: ${dosya}`);
  }

  const parcalar = [];
  for (const dosya of MODULLER) {
    const kaynak = kaynaklar.get(dosya);
    parcalar.push(`\n/* ===== ${dosya} ===== */\n${govdeyeCevir(kaynak)}`);
    const takma = adAlanlari.get(dosya);
    if (takma) {
      const uyeler = disaAcilanlar(kaynak);
      if (!uyeler.length) throw new Error(`${dosya} hiçbir şey dışa açmıyor ama ad alanı olarak kullanılıyor.`);
      parcalar.push(`const ${takma} = { ${uyeler.join(', ')} };`);
    }
  }

  const css = readFileSync(join(KOK, 'css', 'stil.css'), 'utf8');
  const simge = readFileSync(join(KOK, 'simge.svg'), 'utf8');
  const simgeVeri = `data:image/svg+xml;base64,${Buffer.from(simge, 'utf8').toString('base64')}`;

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#1D4ED8">
<title>Araç Audit</title>
<link rel="icon" href="${simgeVeri}">
<style>
${css}
</style>
</head>
<body>
<div id="kok"><div class="yukleniyor">Yükleniyor…</div></div>
<script>
"use strict";
(function () {
${parcalar.join('\n')}
})();
</script>
</body>
</html>
`;

  const cikisKlasor = join(KOK, 'tek-dosya');
  mkdirSync(cikisKlasor, { recursive: true });
  const cikis = join(cikisKlasor, 'arac-audit.html');
  writeFileSync(cikis, html, 'utf8');
  return { cikis, boyut: Buffer.byteLength(html, 'utf8') };
}

const { cikis, boyut } = derle();
console.log(`Tek dosya üretildi: ${cikis} (${(boyut / 1024).toFixed(0)} KB)`);
