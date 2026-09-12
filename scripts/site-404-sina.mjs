// DERİN BAĞLANTI SINAMASI — GITHUB PAGES'İN GERÇEK DAVRANIŞIYLA.
//
// NEDEN BU DOSYA VAR. Derin bağlantı düzeltmesini bir kez yanlış yaptım ve
// daha kötüsü, YANLIŞ BİR SINAVLA "doğrulandı" dedim: taklit sunucum
// docs/app/404.html dosyasını sunuyordu, oysa GitHub Pages 404.html'i YALNIZ
// YAYIN KÖKÜNDEN okur. Canlıda GitHub'ın kendi hata sayfası çıktı.
//
// Buradaki sunucu Pages'in gerçek kurallarını uyguluyor:
//   • Dosya varsa onu sunar.
//   • /x/ isteğinde /x/index.html varsa onu sunar.
//   • Hiçbiri yoksa YALNIZCA KÖKTEKİ 404.html'i 404 koduyla sunar.
//     (Alt klasördeki 404.html'e BAKMAZ — kırılan varsayım buydu.)
//
// KULLANIM: node scripts/site-404-sina.mjs

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const KOK = 'docs';
const TIP = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
  '.xml': 'application/xml', '.map': 'application/json',
};

const sunucu = createServer(async (istek, cevap) => {
  const yol = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
  const adaylar = yol.endsWith('/') ? [join(KOK, yol, 'index.html')] : [join(KOK, yol), join(KOK, yol, 'index.html')];

  for (const d of adaylar) {
    try {
      const s = await stat(d);
      if (s.isFile()) {
        cevap.writeHead(200, { 'content-type': TIP[extname(d)] ?? 'application/octet-stream' });
        return cevap.end(await readFile(d));
      }
    } catch {}
  }

  // PAGES BURADA YALNIZ KÖKTEKİ 404.html'E BAKAR.
  try {
    const g = await readFile(join(KOK, '404.html'));
    cevap.writeHead(404, { 'content-type': 'text/html' });
    return cevap.end(g);
  } catch {
    cevap.writeHead(404, { 'content-type': 'text/plain' });
    cevap.end('404');
  }
});

await new Promise((c) => sunucu.listen(0, c));
const port = sunucu.address().port;
const ADRES = `http://127.0.0.1:${port}`;

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

const cYolu = chromiumBul();
const tarayici = await chromium.launch(cYolu ? { executablePath: cYolu } : {});
const sayfa = await tarayici.newPage();

const basarisiz = [];
const sina = (ad, gecti, ek = '') => {
  console.log(`  ${gecti ? '✓' : '✗'} ${ad}${gecti || !ek ? '' : ` — ${ek}`}`);
  if (!gecti) basarisiz.push(ad);
};

async function ac(yol) {
  const c = await sayfa.goto(ADRES + yol, { waitUntil: 'networkidle' });
  await sayfa
    .waitForFunction(() => !/Uygulama yükleniyor|Bağlantınız yavaş/.test(document.body.innerText), null, {
      timeout: 20000,
    })
    .catch(() => {});
  await sayfa.waitForTimeout(600);
  return { kod: c.status(), metin: await sayfa.evaluate(() => document.body.innerText), adres: sayfa.url() };
}

console.log('\n── DERİN BAĞLANTI (Pages kuralları) ────────────────────────');

let r = await ac('/app/forgot-password');
sina('şifre sıfırlama ekranı açılıyor', /Kod Gönder|Şifre Sıfırlama/i.test(r.metin), r.metin.slice(0, 140));
sina(
  'adres çubuğunda yol korunuyor',
  r.adres.endsWith('/app/forgot-password'),
  r.adres
);

r = await ac('/app/(auth)/signup');
sina('kayıt ekranı açılıyor', /Ad Soyad|Hesap Oluştur/i.test(r.metin), r.metin.slice(0, 140));

r = await ac('/app/');
sina('uygulama kökü hâlâ 200', r.kod === 200, String(r.kod));

r = await ac('/');
sina('tanıtım sayfası hâlâ 200', r.kod === 200, String(r.kod));
sina('tanıtım sayfası doğru içerik', /Uydurma karar numarası/i.test(r.metin));

// UYGULAMA DIŞI 404 GERÇEKTEN 404 SAYFASI OLMALI — uygulamayı açmamalı.
r = await ac('/boyle-bir-sayfa-yok');
sina('site içi yanlış adres düzgün 404 gösteriyor', /bulamadık/i.test(r.metin), r.metin.slice(0, 140));
sina('yanlış adres uygulamayı AÇMIYOR', !/Kod Gönder|Ad Soyad/i.test(r.metin));

await tarayici.close();
sunucu.close();

if (basarisiz.length) {
  console.error(`\n${basarisiz.length} sınama başarısız.`);
  process.exit(1);
}
console.log('\nTümü geçti.');
