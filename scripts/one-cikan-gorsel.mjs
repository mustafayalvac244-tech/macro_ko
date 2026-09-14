// ÖNE ÇIKAN GÖRSEL (Feature graphic) — 1024×500 PNG üretir.
// ---------------------------------------------------------------------------
// NEDEN VAR. Google Play mağaza kaydında zorunlu. Listede ve uygulama
// sayfasının tepesinde görünür; küçülterek gösterildiği için içine çok şey
// koymak onu okunmaz yapar.
//
// NEDEN HTML + PLAYWRIGHT. Depoda tasarım aracı yok ama marka varlıkları var:
// amblem SVG'si, üç font (Dancing Script imza yazısı, Playfair, Manrope) ve
// tema renkleri. Bunları tarayıcıda dizip ekran görüntüsü almak, hem gerçek
// markayı kullanmayı hem de tek satır değiştirip yeniden üretmeyi sağlıyor.
//
// FONTLAR GÖMÜLÜ. Render sırasında ağa çıkılmıyor; TTF'ler node_modules'ten
// okunup data URI olarak yerleştiriliyor. Aksi hâlde sistem fontuna düşer ve
// marka yazısı kaybolur — sessizce.

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const CIKTI = join(KOK, 'magaza-gorselleri');
if (!existsSync(CIKTI)) mkdirSync(CIKTI, { recursive: true });

const font = (yol) =>
  `data:font/ttf;base64,${readFileSync(join(KOK, 'node_modules/@expo-google-fonts', yol)).toString('base64')}`;

const IMZA = font('dancing-script/700Bold/DancingScript_700Bold.ttf');
const BASLIK = font('playfair-display/700Bold/PlayfairDisplay_700Bold.ttf');
const GOVDE = font('manrope/600SemiBold/Manrope_600SemiBold.ttf');
const GOVDE_KALIN = font('manrope/800ExtraBold/Manrope_800ExtraBold.ttf');

/** Amblemin terazi kısmı — kendi SVG'mizden alındı, kutusu olmadan. */
const TERAZI = `
<g class="kiris" fill="none" stroke="var(--cizgi)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
  <line x1="140" y1="150" x2="372" y2="150"/>
  <line x1="256" y1="168" x2="256" y2="402"/>
  <line x1="156" y1="156" x2="110" y2="300"/>
  <line x1="156" y1="156" x2="202" y2="300"/>
  <line x1="356" y1="156" x2="310" y2="300"/>
  <line x1="356" y1="156" x2="402" y2="300"/>
  <line x1="186" y1="402" x2="326" y2="402"/>
  <circle cx="256" cy="150" r="16"/>
</g>
<path d="M110 300 A46 46 0 0 0 202 300 Z" fill="var(--altin)"/>
<path d="M310 300 A46 46 0 0 0 402 300 Z" fill="var(--altin)"/>`;

/* DENENDİ VE GERİ ALINDI (14.09.2026): kefelerin içine "büro" ve "içtihat"
   anlamına gelsin diye küçük dikdörtgenler kondu. Fikir sloganın görsel
   karşılığıydı ama BU ÖLÇEKTE YÜRÜMEDİ: şekiller dosya ya da kitap diye
   okunmuyor, rastgele blok — hatta çubuk grafik — gibi duruyor ve temiz
   teraziyi kirletiyordu. Küçültülmüş önizlemede iyice lekeye dönüşüyordu.
   Not bırakılıyor ki aynı fikir tekrar denenip aynı yere varılmasın. */

export function sayfa({ kunyeler, slogan, vaat }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Imza';src:url('${IMZA}') format('truetype');font-weight:700}
@font-face{font-family:'Baslik';src:url('${BASLIK}') format('truetype');font-weight:700}
@font-face{font-family:'Govde';src:url('${GOVDE}') format('truetype');font-weight:600}
@font-face{font-family:'Govde';src:url('${GOVDE_KALIN}') format('truetype');font-weight:800}
:root{
  --lacivert:#0B1F45; --lacivert-2:#173C7E; --derin:#06142E;
  --altin:#E3C275; --altin-koyu:#B8912F; --cizgi:#F0F4FC;
}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;
  font-family:'Govde',system-ui,sans-serif;background:var(--derin)}
.tuval{position:relative;width:1024px;height:500px;overflow:hidden;
  background:
    radial-gradient(70% 120% at 74% 50%, rgba(30,72,148,.55) 0%, rgba(11,31,69,0) 62%),
    linear-gradient(155deg,#0e2856 0%,#091a36 55%,#050e20 100%)}

/* KÜNYE DOKUSU — v1'de gürültü yapıyordu: opaklık yüksekti, maske çalışmıyordu
   ve başlığın İÇİNDEN geçiyordu. Artık YALNIZ sağ üçte birde, çok daha sönük
   ve terazinin arkasında kalıyor. Amaç fark edilmek değil; bir avukatın
   "burada künye var" diye HİSSETMESİ. */
.kunye{position:absolute;right:0;top:0;width:430px;height:500px;
  opacity:.045;color:#BFD6FF;font-size:13px;line-height:27px;
  letter-spacing:.06em;white-space:pre;padding-top:10px;
  -webkit-mask-image:radial-gradient(70% 60% at 60% 50%,#000 0%,transparent 78%);
          mask-image:radial-gradient(70% 60% at 60% 50%,#000 0%,transparent 78%)}

/* SAĞDAKİ TERAZİ — v1'de gri bir hayaletti. Artık ALTIN ve kendinden emin;
   kompozisyonun ağırlık merkezi o. Kasten sağdan taşıyor ki çerçeveye
   sıkışmış bir logo değil, arkada duran bir NESNE gibi okunsun. */
/* TAMAMEN ÇERÇEVE İÇİNDE. Bir ara sağdan taşırıldı ve kefe kenarda
   kesildi — kasıtlı kırpma gibi değil, kaza gibi duruyordu. Ayrıca Play bu
   görseli bazı yerleşimlerde KENDİ kırpıyor; kenara dayamak o kırpmada
   telafisi olmayan bir kayıp demek. */
.dev{position:absolute;right:38px;top:50%;transform:translateY(-50%);
  width:462px;height:462px}
.dev svg{width:100%;height:100%;
  filter:drop-shadow(0 20px 54px rgba(0,0,0,.5)) drop-shadow(0 0 22px rgba(227,194,117,.14))}
.dev .kiris{stroke:#DCE7FA}
.parilti{position:absolute;right:34px;top:50%;transform:translateY(-50%);
  width:470px;height:470px;border-radius:50%;
  background:radial-gradient(circle,rgba(227,194,117,.16) 0%,rgba(227,194,117,0) 66%)}

/* Vinyet — kenarları hafif karartıp gözü merkeze topluyor. Play bu görseli
   farklı zeminlerin üstünde gösteriyor; kenarları koyulaştırmak görselin
   zeminle karışıp dağılmasını engelliyor. */
.vinyet{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(118% 96% at 50% 48%,rgba(0,0,0,0) 52%,rgba(0,0,0,.34) 100%)}
.sol{position:absolute;left:78px;top:50%;transform:translateY(-50%);width:560px}
.ad{font-family:'Imza';font-size:104px;color:#fff;line-height:.9;
  text-shadow:0 4px 26px rgba(0,0,0,.4)}
.cizgi{width:190px;height:3px;margin:30px 0 26px 3px;border-radius:2px;
  background:linear-gradient(90deg,var(--altin) 0%,rgba(227,194,117,.05) 100%)}
.slogan{font-family:'Baslik';font-size:44px;color:#EDF3FF;line-height:1.16;
  letter-spacing:-.015em}
.vaat{margin-top:28px;font-size:21px;font-weight:800;color:var(--altin);
  letter-spacing:.05em}
.vaat span{opacity:.45;margin:0 11px;font-weight:600}
</style></head><body>
<div class="tuval">
  <div class="kunye">${kunyeler}</div>
  <div class="vinyet"></div>
  <div class="parilti"></div>
  <div class="dev"><svg viewBox="0 0 512 512">${TERAZI}</svg></div>
  <div class="sol">
    <div class="ad">Vekil Pro</div>
    <div class="cizgi"></div>
    <div class="slogan">${slogan}</div>
    <div class="vaat">${vaat.join('<span>·</span>')}</div>
  </div>
</div>
</body></html>`;
}

/** Arka plandaki künye dokusu — gerçekçi ama KURGU künyeler. */
function kunyeDokusu() {
  const daireler = ['9. HD', '22. HD', '11. HD', '3. HD', '2. HD', '13. HD', '4. HD', '15. HD', 'HGK', '12. HD'];
  const satirlar = [];
  for (let i = 0; i < 16; i += 1) {
    const parca = [];
    for (let j = 0; j < 5; j += 1) {
      const d = daireler[(i * 5 + j) % daireler.length];
      const e = `${2019 + ((i + j) % 7)}/${1000 + ((i * 37 + j * 91) % 8999)}`;
      const k = `${2020 + ((i + j) % 6)}/${100 + ((i * 53 + j * 17) % 899)}`;
      parca.push(`${d} · ${e} E. · ${k} K.`);
    }
    satirlar.push(parca.join('    '));
  }
  return satirlar.join('\n');
}

const TASARIM = {
  kunyeler: kunyeDokusu(),
  slogan: 'Büronuz ve içtihat<br>araştırmanız tek yerde.',
  vaat: ['Dava takibi', 'Süre hesabı', 'İçtihat'],
};

async function main() {
  const html = sayfa(TASARIM);
  writeFileSync(join(CIKTI, '.one-cikan.html'), html);

  const tarayici = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const sayfaNesnesi = await tarayici.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  await sayfaNesnesi.setContent(html, { waitUntil: 'load' });
  await sayfaNesnesi.evaluate(() => document.fonts.ready);
  await sayfaNesnesi.waitForTimeout(400);
  const hedef = join(CIKTI, 'one-cikan-1024x500.png');
  await sayfaNesnesi.screenshot({ path: hedef });
  await tarayici.close();
  console.log('üretildi →', hedef);
}

main().catch((e) => { console.error(e); process.exit(1); });
