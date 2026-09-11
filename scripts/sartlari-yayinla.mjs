#!/usr/bin/env node
// KULLANIM KOŞULLARI SAYFASINI UYGULAMA İÇİ METİNDEN ÜRET
// ---------------------------------------------------------------------------
// NEDEN VAR. docs/terms.html elle yazılmıştı ve app/terms.tsx güncellendikçe
// GERİDE KALIYORDU. Ölçüm (2026-09-11): uygulama içi metinde 16 madde vardı,
// yayınlanan sayfada yeni maddelerin HİÇBİRİ yoktu.
//
// BU BİR HUKUKİ RİSKTİR, biçimsel bir tutarsızlık değil: App Store'a ve
// kullanıcıya gösterilen "Kullanım Koşulları" ile uygulamanın kabul ettirdiği
// metin farklıysa, bir uyuşmazlıkta hangisinin bağlayıcı olduğu tartışılır ve
// bu tartışma bizim aleyhimize işler. Tek kaynak app/terms.tsx olmalıdır.
//
// KULLANIM: node scripts/sartlari-yayinla.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Kaynak dosyalardan sayısal sabitleri okur.
 * app/terms.tsx doğrudan import EDİLEMEZ: react-native bileşenleri çekiyor,
 * Node'da çalışmaz. Bu yüzden sabitler metinden okunup gövdeye enjekte edilir.
 */
async function sabitleriOku() {
  const oku = (yol) => readFile(join(kok, yol), 'utf8');
  const trial = await oku('src/hooks/useTrialStatus.ts');
  const planlar = await oku('src/config/planlar.ts');
  const bayraklar = await oku('src/config/features.ts');

  const sayi = (metin, ad) => {
    const m = metin.match(new RegExp(`export const ${ad}\\s*=\\s*(\\d+)`));
    if (!m) throw new Error(`${ad} bulunamadı`);
    return Number(m[1]);
  };
  const limitBlok = planlar.slice(planlar.indexOf('export const UCRETSIZ_LIMIT'));
  const alan = (ad) => {
    const m = limitBlok.match(new RegExp(`${ad}\\s*:\\s*(\\d+)`));
    if (!m) throw new Error(`UCRETSIZ_LIMIT.${ad} bulunamadı`);
    return Number(m[1]);
  };

  // Özellik bayrakları: koşul metni "mütalaa şu an kapalı" gibi cümleleri
  // bayrağa göre kuruyor. Bayrak değişirse yayınlanan metin de değişmeli.
  const bayrak = (ad) => {
    const m = bayraklar.match(new RegExp(`export const ${ad}\\s*=\\s*(true|false)`));
    if (!m) throw new Error(`${ad} bulunamadı`);
    return m[1] === 'true';
  };

  return {
    AI_DILEKCE_ENABLED: bayrak('AI_DILEKCE_ENABLED'),
    AI_BELGE_ENABLED: bayrak('AI_BELGE_ENABLED'),
    AI_MUTALAA_ENABLED: bayrak('AI_MUTALAA_ENABLED'),
    AI_AKTARMA_ENABLED: bayrak('AI_AKTARMA_ENABLED'),
    AI_ICTIHAT_ANALIZ_ENABLED: bayrak('AI_ICTIHAT_ANALIZ_ENABLED'),
    AI_ENABLED: bayrak('AI_ENABLED'),
    MONTHLY_PRICE_TRY: sayi(trial, 'MONTHLY_PRICE_TRY'),
    AI_PRICE_TRY: sayi(trial, 'AI_PRICE_TRY'),
    AI_SORU_HAKKI: sayi(trial, 'AI_SORU_HAKKI'),
    AI_MUTALAA_HAKKI: sayi(trial, 'AI_MUTALAA_HAKKI'),
    DENEME_SORU_HAKKI: sayi(trial, 'DENEME_SORU_HAKKI'),
    UCRETSIZ_LIMIT: { dava: alan('dava'), muvekkil: alan('muvekkil'), belge: alan('belge') },
  };
}

/** TS tek tırnaklı dize kaçışlarını gerçek karaktere çevirir. */
function coz(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\\/g, '\\');
}

/** Gövde ifadesini sabitleri enjekte ederek değerlendirir. */
function govdeDegerlendir(ifade, sabitler) {
  const adlar = Object.keys(sabitler);
  const fn = new Function(...adlar, `return (${ifade.replace(/,\s*$/, '')});`);
  const sonuc = fn(...adlar.map((a) => sabitler[a]));
  if (typeof sonuc !== 'string') throw new Error('Gövde metne çözülmedi: ' + ifade.slice(0, 60));
  return sonuc;
}

/**
 * sectionsTr dizisindeki bölümleri çıkarır.
 *
 * İKİ GÖVDE BİÇİMİ VAR ve ilk yazdığım çıkarıcı ikincisini SESSİZCE ATLADI:
 *   body: '...'                             → düz tek tırnaklı metin
 *   body:\n  `... ${SABIT} ...` + '...'      → şablon dizesi + birleştirme
 * Ölçüm: 16 maddeden 14'ü yakalandı; "3. Abonelikler ve Ücretlendirme" ile
 * "5. Yapay Zekâ Kullanım Hakları" düştü. Yayınlanan koşullardan iki maddenin
 * sessizce kaybolması, bu betiğin önlemek için yazıldığı sorunun ta kendisiydi.
 *
 * Bu yüzden sayı tutmazsa betik HATA VERİP DURUR — eksik metin yayınlanmaz.
 */
function bolumleriCikar(src, sabitler) {
  const bas = src.indexOf('const sectionsTr');
  const son = src.indexOf('const sectionsEn');
  if (bas < 0 || son < 0) throw new Error('sectionsTr / sectionsEn bulunamadı');
  const blok = src.slice(bas, son);

  const bekleniyor = (blok.match(/^\s*title:\s*'/gm) ?? []).length;

  const out = [];
  const kalip = /title:\s*'((?:[^'\\]|\\.)*)'\s*,\s*\n\s*body:\s*([\s\S]*?)\n\s*\},/g;
  let m;
  while ((m = kalip.exec(blok))) {
    out.push({ baslik: coz(m[1]), govde: govdeDegerlendir(m[2], sabitler) });
  }

  if (out.length !== bekleniyor) {
    throw new Error(
      `Bölüm sayısı tutmuyor: kaynakta ${bekleniyor}, çıkarılan ${out.length}. ` +
        'Yayınlanan koşullardan madde düşerdi — üretim DURDURULDU.'
    );
  }
  return out;
}

function kacir(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const kaynak = await readFile(join(kok, 'app', 'terms.tsx'), 'utf8');
const sabitler = await sabitleriOku();
const bolumler = bolumleriCikar(kaynak, sabitler);

const bugun = new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vekil Pro — Kullanım Koşulları</title>
<meta name="description" content="Vekil Pro kullanım koşulları (EULA): abonelik şartları, yapay zekâ kullanımı, süre hatırlatmaları ve sorumluluk sınırları." />
<style>
  :root { --bg:#F4F6FA; --card:#FFFFFF; --ink:#14213D; --muted:#5A6785; --line:#E3E8F0; --accent:#173C7E; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0B1220; --card:#131C2E; --ink:#EAF0FB; --muted:#9AA8C2; --line:#243149; --accent:#5B8DEF; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding:32px 20px 64px; }
  main { max-width:720px; margin:0 auto; }
  h1 { font-size:26px; letter-spacing:-0.4px; margin:0 0 6px; }
  .updated { color:var(--muted); font-size:14px; margin:0; }
  .intro { background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:18px 20px; margin:22px 0 26px; color:var(--muted); }
  section { background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:18px 20px; margin-bottom:14px; }
  h2 { font-size:17px; margin:0 0 8px; color:var(--accent); }
  p { margin:0; white-space:pre-line; }
  footer { margin-top:28px; color:var(--muted); font-size:14px; text-align:center; }
  a { color:var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <h1>Vekil Pro — Kullanım Koşulları</h1>
    <p class="updated">Son güncelleme: ${bugun}</p>
  </header>

  <div class="intro">
    Bu sayfa, uygulama içindeki <strong>Ayarlar &rsaquo; Kullanım Koşulları</strong> ekranıyla
    AYNI kaynaktan üretilir; iki metin arasında fark oluşmaz.
    Uygulamayı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.
  </div>

${bolumler
  .map((b) => `  <section>\n    <h2>${kacir(b.baslik)}</h2>\n    <p>${kacir(b.govde)}</p>\n  </section>`)
  .join('\n')}

  <footer>
    Gizlilik metni için <a href="./privacy.html">Gizlilik ve KVKK</a> sayfasına bakınız.<br />
    Vekil Pro · ${new Date().getFullYear()}
  </footer>
</main>
</body>
</html>
`;

await writeFile(join(kok, 'docs', 'terms.html'), html, 'utf8');
console.log(`docs/terms.html üretildi: ${bolumler.length} madde`);
