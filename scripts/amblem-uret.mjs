// AMBLEMDEN BÜTÜN VARLIKLARI ÜRETİR.
//
// NEDEN BETİK. Amblem yedi ayrı dosyada duruyor: uygulama ikonu, Android'in
// üç katmanı, açılış görseli, favicon (PNG) ve sitenin SVG'si. Elle
// üretilince biri unutuluyor ve marka yine ikiye ayrılıyor — bugün tam olarak
// bu yaşandı: tanıtım sayfası düz bir "V" kutusu gösterirken uygulama
// terazi gösteriyordu. Hepsi tek kaynaktan (scripts/amblem.mjs) üretiliyor.
//
// NEDEN TARAYICI. Depoda raster kütüphanesi yok; Chromium zaten kurulu ve
// SVG'yi tam olarak tarayıcının çizeceği gibi çiziyor — yani üretilen PNG,
// sitede görünenle aynı.
//
// KULLANIM: node scripts/amblem-uret.mjs

import { writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { kutulu, sade, LACIVERT, LACIVERT_KOYU, ALTIN } from './amblem.mjs';

function chromiumBul() {
  if (process.env.CHROMIUM_YOLU) return process.env.CHROMIUM_YOLU;
  const kok = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!kok || !existsSync(kok)) return null;
  for (const ad of readdirSync(kok).sort().reverse()) {
    for (const son of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const y = join(kok, ad, son);
      if (existsSync(y)) return y;
    }
  }
  return null;
}

const yol = chromiumBul();
const tarayici = await chromium.launch(yol ? { executablePath: yol } : {});

/** SVG metnini verilen boyutta PNG'ye çevirir. */
async function png(svg, boyut, hedef, zemin = 'transparent') {
  const s = await tarayici.newPage({ viewport: { width: boyut, height: boyut }, deviceScaleFactor: 1 });
  await s.setContent(
    `<body style="margin:0;background:${zemin}">${svg.replace(/width="\d+" height="\d+"/, `width="${boyut}" height="${boyut}"`)}</body>`
  );
  await s.waitForTimeout(120);
  await s.screenshot({ path: hedef, omitBackground: zemin === 'transparent' });
  await s.close();
  console.log(`${hedef.padEnd(44)} ${boyut}×${boyut}`);
}

// 1) Site SVG'si — favicon ve paylaşım kartı buradan.
await writeFile('docs/amblem.svg', kutulu({ boyut: 64 }), 'utf8');
console.log('docs/amblem.svg');

// 2) Uygulama ikonu (iOS + genel). Köşe yuvarlatmayı işletim sistemi
//    kendisi yapıyor; bizim kutumuz KÖŞESİZ olmalı, yoksa iki kez
//    yuvarlanıp kenarda boşluk kalır.
await png(kutulu({ boyut: 1024, radius: 0, gradyanId: 'a1' }), 1024, 'assets/icon.png', LACIVERT);

// 3) Android uyarlanabilir ikon: arka plan düz renk, ön katman saydam.
//    Ön katmanda işaret KÜÇÜLTÜLÜYOR (%62): Android ikonun dış %28'ini
//    maskeyle kırpıyor; tam boy çizilen bir işaretin kolları kesilirdi.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
     <defs><linearGradient id="ab" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${LACIVERT}"/><stop offset="1" stop-color="${LACIVERT_KOYU}"/></linearGradient></defs>
     <rect width="64" height="64" fill="url(#ab)"/></svg>`,
  1024, 'assets/android-icon-background.png', LACIVERT
);
const onKatman = (renk) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
     <g transform="translate(32 32) scale(0.62) translate(-32 -32)">${sade({ renk }).replace(/<\/?svg[^>]*>/g, '')}</g>
   </svg>`;
await png(onKatman(ALTIN), 1024, 'assets/android-icon-foreground.png');
// Tek renkli (Android 13+ temalı ikon): beyaz, sistem kendi rengine boyuyor.
await png(onKatman('#FFFFFF'), 1024, 'assets/android-icon-monochrome.png');

// 4) Açılış görseli — saydam, altın işaret.
await png(onKatman(ALTIN), 1024, 'assets/splash-icon.png');

// 5) Favicon (PNG, uygulama tarafı) ve sitenin .ico yerine kullandığı PNG.
await png(kutulu({ boyut: 256, radius: 56, gradyanId: 'f1' }), 256, 'assets/favicon.png');

await tarayici.close();
console.log('\nTamam — yedi varlık da tek kaynaktan üretildi.');
