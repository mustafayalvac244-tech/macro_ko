// ANASAYFADAKİ CANLI DENETİMİ GERÇEK TARAYICIDA SINAR.
//
// NEDEN. "esbuild hata vermedi" ve "tsc temiz" ile "sayfa tarayıcıda
// çalışıyor" aynı şey değil. Bugün tam bu farktan bir hata çıktı: kod
// doğruydu, kullanıcının ekranında hiçbir şey olmuyordu. Anasayfa artık
// ürünün ÇALIŞTIĞINI iddia ediyor; iddianın kendisi sınanmadan yayına
// gitmemeli.
//
// Chromium bu ortamda kurulu (PLAYWRIGHT_BROWSERS_PATH). Sayfa dosya
// sisteminden açılır, sunucu gerekmez.
//
// KULLANIM: node scripts/site-denetim-sina.mjs

import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

const adres = pathToFileURL(resolve('docs/index.html')).href;

/**
 * Chromium'u bulur — AMA BULAMAZSA PES ETMEZ.
 *
 * İki ayrı ortam var ve yolları farklı:
 *   • Geliştirme kabı: Chromium hazır kurulu, /opt/pw-browsers altında ve
 *     dizin adı sürüm numarası taşıyor (chromium-1194). İndirme İSTEMİYORUZ.
 *   • CI: `playwright-core install` tarayıcıyı ~/.cache/ms-playwright altına
 *     indirir ve Playwright onu kendisi bulur.
 *
 * İlk sürümde burada yalnız /opt/pw-browsers aranıyor, bulunamayınca
 * process.exit(1) çağrılıyordu — CI tarayıcıyı indirmiş olmasına rağmen iş
 * akışı "Chromium bulunamadı" diyerek düştü. Doğrusu: özel bir yol bulursak
 * onu kullan, bulamazsak Playwright'ın kendi çözümüne bırak.
 */
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
console.log(yol ? `Chromium: ${yol}` : 'Chromium: Playwright kendi kurulumunu kullanıyor');
const tarayici = await chromium.launch(yol ? { executablePath: yol } : {});
const sayfa = await tarayici.newPage();

const konsolHatalari = [];
sayfa.on('pageerror', (e) => konsolHatalari.push(String(e)));

await sayfa.goto(adres);

const basarisiz = [];
const sina = (ad, kosul, ek = '') => {
  if (kosul) console.log(`  ✓ ${ad}`);
  else {
    console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ''}`);
    basarisiz.push(ad);
  }
};

// 1) Derlenen paket yüklendi mi?
const yuklendi = await sayfa.evaluate(() => Boolean(window.VekilDenetim?.kararAtiflari));
sina('denetim.js yüklendi', yuklendi);

// 2) Boş kutuda gizlilik cümlesi duruyor mu?
const bosNot = await sayfa.textContent('#dn-not');
sina('boşken gizlilik notu var', /hiçbir yere gönderilmez/.test(bosNot ?? ''));

// 3) "Uydurma künye örneği" düğmesi olanaksız atfı KIRMIZI gösteriyor mu?
await sayfa.click('[data-ornek="uydurma"]');
await sayfa.waitForSelector('.dn.kirmizi', { timeout: 3000 }).catch(() => {});
const kirmiziMetin = (await sayfa.textContent('#dn-sonuc')) ?? '';
sina('uydurma örnekte "OLAMAZ" uyarısı çıkıyor', /BU ATIF OLAMAZ/.test(kirmiziMetin));
sina(
  'sebep yazılı: karar yılı esas yılından önce',
  /karar yılı esas yılından önce/.test(kirmiziMetin)
);
sina('sebep yazılı: var olmayan daire', /daire hiç var olmadı/.test(kirmiziMetin));

// 4) Gerçek künye YANLIŞLIKLA "olamaz" diye işaretlenmiyor mu?
//    Bu, testlerin en önemlisi: gerçek bir kararı uydurma ilan etmek,
//    kaçırmaktan daha pahalıdır — avukat uyarıya bir daha bakmaz.
await sayfa.click('[data-ornek="gercek"]');
await sayfa.waitForTimeout(150);
const gercekMetin = (await sayfa.textContent('#dn-sonuc')) ?? '';
sina('gerçek künye "olamaz" diye işaretlenmiyor', !/BU ATIF OLAMAZ/.test(gercekMetin));
sina('gerçek künye listeleniyor', /2015\/38005/.test(gercekMetin));

// 5) Künyesiz metinde sessiz kalıyor mu?
await sayfa.fill('#dn-girdi', 'Bu paragrafta hiçbir karar künyesi yok.');
await sayfa.waitForTimeout(150);
sina(
  'künyesiz metinde uyarı üretmiyor',
  /künye bulunamadı/.test((await sayfa.textContent('#dn-sayac')) ?? '')
);

// 6) Metin HTML olarak yorumlanmıyor mu? (kendi sayfamıza enjeksiyon)
await sayfa.fill('#dn-girdi', '<img src=x onerror=window.__sizdi=1> 2021/4412 E., 2019/1180 K.');
await sayfa.waitForTimeout(150);
const sizdi = await sayfa.evaluate(() => window.__sizdi === 1);
sina('girilen metin HTML olarak çalıştırılmıyor', !sizdi);

// 7) Sayfada JavaScript hatası var mı?
sina('sayfada JS hatası yok', konsolHatalari.length === 0, konsolHatalari.join(' | '));

// 8) Dar ekranda sayfa yana kaymıyor mu?
await sayfa.setViewportSize({ width: 390, height: 800 });
await sayfa.waitForTimeout(120);
const tasma = await sayfa.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
sina('390px genişlikte yatay taşma yok', tasma <= 1, `taşma ${tasma}px`);

await tarayici.close();

if (basarisiz.length) {
  console.error(`\n${basarisiz.length} sınama başarısız.`);
  process.exit(1);
}
console.log('\nTümü geçti.');
