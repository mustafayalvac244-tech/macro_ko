// SİTE ADRESİNİ TEK KOMUTLA DEĞİŞTİR.
//
// NEDEN VAR. Adres üç ayrı yerde yazılı ve üçü birlikte değişmezse site ya
// beyaz açılır ya yanlış yere yönlendirir:
//   1. app.json → experiments.baseUrl   (web derlemesinin varlık yolları)
//   2. src/config/web.ts → WEB_ADRESI    (uygulamadaki tanıtım kartı, üyelik kapısı)
//   3. docs/index.html → canonical + og:url + sitemap  (paylaşım ve arama)
// Ayrıca özel alan adında docs/CNAME gerekir, alt alan adı barındırmada
// (pages.dev / netlify.app) GEREKMEZ — varsa GitHub Pages'i bozar.
//
// Bunları elle güncellemek bir öncekinde de unutuldu; unutulan her biri sessiz
// bir arıza üretiyor. Betik hepsini birlikte yazar.
//
// KULLANIM:
//   node scripts/web-adres.mjs https://vekilpro.pages.dev        # kökten servis
//   node scripts/web-adres.mjs https://vekilpro.com --cname      # özel alan adı
//   node scripts/web-adres.mjs --github                          # eski hâle dön
//
// Sonrasında MUTLAKA: npm run export:web  (baseUrl derlemeye gömülüdür;
// yeniden derlenmezse eski yol kalır ve uygulama 404 verir).

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const GITHUB = 'https://mustafayalvac244-tech.github.io/macro_ko';

const githubaDon = args.includes('--github');
const cnameIste = args.includes('--cname');
const ham = args.find((a) => !a.startsWith('--'));

if (!githubaDon && !ham) {
  console.error('Adres verin. Örnek: node scripts/web-adres.mjs https://vekilpro.pages.dev');
  process.exit(1);
}

/** Sondaki eğik çizgiyi at; "https://x/" ile "https://x" aynı adrestir. */
const temizle = (u) => u.replace(/\/+$/, '');
const kokAdres = githubaDon ? GITHUB : temizle(ham);

let u;
try {
  u = new URL(kokAdres);
} catch {
  console.error(`Geçersiz adres: ${kokAdres}`);
  process.exit(1);
}
if (u.protocol !== 'https:') {
  console.error('Adres https olmalı.');
  process.exit(1);
}

// Sitenin kökten mi bir alt yoldan mı servis edildiği: GitHub Pages proje
// sayfasında "/macro_ko", kendi alan adında ya da pages.dev'de "".
const yolOneki = temizle(u.pathname) === '' ? '' : temizle(u.pathname);
const baseUrl = `${yolOneki}/app`;
const uygulamaAdresi = `${kokAdres}/app`;

// ── 1. app.json ────────────────────────────────────────────────────────────
const appYol = join(kok, 'app.json');
const appHam = readFileSync(appYol, 'utf8');
const app = JSON.parse(appHam);
const oncekiBase = app.expo?.experiments?.baseUrl;
app.expo.experiments.baseUrl = baseUrl;
// Dosya sonundaki satır sonunu OLDUĞU GİBİ bırak: app.json'ı EAS derlemesi de
// okuyor; gereksiz bir bayt farkı diff'i gürültüye boğar.
writeFileSync(appYol, JSON.stringify(app, null, 2) + (appHam.endsWith('\n') ? '\n' : ''));

// ── 2. src/config/web.ts ───────────────────────────────────────────────────
const webYol = join(kok, 'src/config/web.ts');
let web = readFileSync(webYol, 'utf8');
const desen = /export const WEB_ADRESI = '[^']*';/;
if (!desen.test(web)) {
  console.error('src/config/web.ts içinde WEB_ADRESI bulunamadı — elle bakın.');
  process.exit(1);
}
web = web.replace(desen, `export const WEB_ADRESI = '${uygulamaAdresi}';`);
writeFileSync(webYol, web);

// ── 3. docs/index.html (canonical + og:url) ────────────────────────────────
const indexYol = join(kok, 'docs/index.html');
let html = readFileSync(indexYol, 'utf8');
// "değişmedi" ile "bulunamadı" AYRI ŞEYLER: aynı adrese ikinci kez koşulunca
// hiçbir şey değişmez ve bu bir uyarı sebebi değildir. Etiketin VARLIĞINA
// bakılır — yoksa sessizce geçmek, paylaşım kartını bozar.
for (const [ad, desen2, yeni] of [
  ['canonical', /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${kokAdres}/">`],
  ['og:url', /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${kokAdres}/">`],
  ['og:image', /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${kokAdres}/paylasim.png">`],
]) {
  if (!desen2.test(html)) {
    console.error(`docs/index.html içinde ${ad} etiketi yok — elle ekleyin.`);
    process.exit(1);
  }
  html = html.replace(desen2, yeni);
}
writeFileSync(indexYol, html);

// ── 4. sitemap.xml ─────────────────────────────────────────────────────────
const sitemapYol = join(kok, 'docs/sitemap.xml');
const bugun = new Date().toISOString().slice(0, 10);
const sayfalar = ['/', '/terms.html', '/privacy.html'];
writeFileSync(
  sitemapYol,
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sayfalar
      .map((s) => `  <url><loc>${kokAdres}${s}</loc><lastmod>${bugun}</lastmod></url>\n`)
      .join('') +
    '</urlset>\n'
);

// ── 5. robots.txt ──────────────────────────────────────────────────────────
writeFileSync(
  join(kok, 'docs/robots.txt'),
  `# Paylaşım görselinin kaynağı taranmasın: sayfa değil, şablon.\nUser-agent: *\nAllow: /\nDisallow: /og.html\n\nSitemap: ${kokAdres}/sitemap.xml\n`
);

// ── 6. CNAME ───────────────────────────────────────────────────────────────
// YALNIZ GitHub Pages + özel alan adı ikilisinde gerekir. pages.dev /
// netlify.app gibi barındırmalarda dosya varsa GitHub Pages'i karıştırır.
const cnameYol = join(kok, 'docs/CNAME');
if (cnameIste) {
  writeFileSync(cnameYol, u.hostname + '\n');
} else if (existsSync(cnameYol)) {
  rmSync(cnameYol);
}

console.log(`adres      : ${kokAdres}`);
console.log(`uygulama   : ${uygulamaAdresi}`);
console.log(`baseUrl    : ${oncekiBase} → ${baseUrl}`);
console.log(`CNAME      : ${cnameIste ? u.hostname : 'yok'}`);
console.log('');
console.log('ŞİMDİ ŞART: npm run export:web   (baseUrl derlemeye gömülüdür)');
