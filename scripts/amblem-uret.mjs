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
import { kutulu, kucuk, sade, LACIVERT_ORTA, LACIVERT_KOYU, ALTIN_ACIK } from './amblem.mjs';

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

// 1) Site SVG'leri — tam amblem (başlık) ve sadeleştirilmiş (favicon).
await writeFile('docs/amblem.svg', kutulu({ boyut: 64 }), 'utf8');
await writeFile('docs/amblem-kucuk.svg', kucuk({ boyut: 64, gradyanId: 'vk' }), 'utf8');
console.log('docs/amblem.svg + docs/amblem-kucuk.svg');

// 2) Uygulama ikonu (iOS + genel). Köşe yuvarlatmayı işletim sistemi
//    kendisi yapıyor; bizim kutumuz KÖŞESİZ olmalı, yoksa iki kez
//    yuvarlanıp kenarda boşluk kalır.
await png(kutulu({ boyut: 1024, radius: 0, gradyanId: 'a1' }), 1024, 'assets/icon.png', LACIVERT_ORTA);

// 3) Android uyarlanabilir ikon: arka plan düz renk, ön katman saydam.
//    Ön katmanda amblem KÜÇÜLTÜLÜYOR (%62): Android ikonun dış %28'ini
//    maskeyle kırpıyor; tam boy çizilen bir amblemin kefeleri kesilirdi.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
     <defs><linearGradient id="ab" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${LACIVERT_ORTA}"/><stop offset="1" stop-color="${LACIVERT_KOYU}"/></linearGradient></defs>
     <rect width="512" height="512" fill="url(#ab)"/></svg>`,
  1024, 'assets/android-icon-background.png', LACIVERT_ORTA
);
// Halka içleri SAYDAM olamaz (arkadan zemin görünür ve halka kaybolur);
// arka plan katmanının rengiyle dolduruluyor.
await png(sade({ cizgi: '#F0F4FC', altin: ALTIN_ACIK, dugum: LACIVERT_KOYU, olcek: 0.62 }),
          1024, 'assets/android-icon-foreground.png');
// Tek renkli (Android 13+ temalı ikon): tamamı beyaz, sistem kendi rengine
// boyuyor. Altın vurgular da beyaza iniyor, yoksa tema renginde kaybolur.
await png(sade({ cizgi: '#FFFFFF', altin: '#FFFFFF', dugum: 'none', olcek: 0.62 }),
          1024, 'assets/android-icon-monochrome.png');

// 4) Açılış görseli — saydam zemin, açık çizgi.
await png(sade({ cizgi: '#F0F4FC', altin: ALTIN_ACIK, dugum: 'none', olcek: 0.78 }),
          1024, 'assets/splash-icon.png');

// 5) Favicon — SADELEŞTİRİLMİŞ sürüm. Tam amblem 16-20px'te bulanıklaşıyor
//    (ölçüldü); favicon zaten hep o boyutta görünüyor.
await png(kucuk({ boyut: 256, gradyanId: 'f1' }), 256, 'assets/favicon.png');

await tarayici.close();
console.log('\nTamam — hepsi tek kaynaktan üretildi.');
