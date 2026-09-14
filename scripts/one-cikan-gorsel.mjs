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

export function sayfa({ kunyeler, slogan, ustBaslik }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Imza';src:url('${IMZA}') format('truetype');font-weight:700}
@font-face{font-family:'Baslik';src:url('${BASLIK}') format('truetype');font-weight:700}
@font-face{font-family:'Govde';src:url('${GOVDE}') format('truetype');font-weight:600}
@font-face{font-family:'Govde';src:url('${GOVDE_KALIN}') format('truetype');font-weight:800}
:root{
  --murekkep:#081A38;      /* derin mürekkep — parlak değil, DOLU */
  --murekkep-2:#050F24;
  --altin:#C9A75E;         /* varak altını: ekran altını (#E3C275) fazla parlak,
                              varak daha mat ve daha pahalı okunuyor */
  --altin-parlak:#E3C275;
  --kagit:#EEF3FB;
}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;
  font-family:'Govde',system-ui,sans-serif;background:var(--murekkep-2)}

/* ZEMİN: PARILTI YOK. Işıltılı radyal gradyan tüketici uygulaması dilidir;
   hukuk dili DOLU ve SAKİN mürekkeptir. Yalnız çok hafif bir diyagonal
   derinlik var, o kadar. */
.tuval{position:relative;width:1024px;height:500px;overflow:hidden;
  background:linear-gradient(148deg,#0b2145 0%,#081a38 46%,#050f24 100%)}

/* DOKU KALDIRILDI. Kâğıt dokusu olsun diye çapraz/dikey ince çizgiler
   konmuştu ama 4px aralıkla ızgaraya dönüşüp SİNEKLİK gibi göründü —
   malzeme hissi değil, render hatası gibi. Derin ve düz mürekkep zaten
   daha pahalı okunuyor; doku eklemek burada kaybettiriyordu. */
.doku{display:none}

/* ÇERÇEVE: ince altın çift cetvel. Diplomanın, beratın, mahkeme kararının
   kenarındaki çizgi. Tek başına "resmî belge" diye okunuyor ve hiçbir
   süs eklemeden görseli sınıf atlatıyor. */
.cerceve{position:absolute;inset:22px;border:1px solid rgba(201,167,94,.5);
  pointer-events:none}
.cerceve::after{content:'';position:absolute;inset:5px;
  border:1px solid rgba(201,167,94,.22)}

/* KÜNYE DOKUSU KALDIRILDI. Arka planda Yargıtay künyelerinden bir doku
   vardı; fikir doğruydu (bir avukat "9. HD · 2024/1177 E." satırını bir
   bakışta tanır) ama MÜHRÜN İÇİNDEN geçiyordu ve orada leke gibi duruyordu.
   Maskeyle kurtarmak yerine kaldırıldı: bu görselde konuyu zaten mühür ve
   "AVUKATLIK BÜRO YÖNETİMİ" satırı söylüyor, üçüncü bir işaret fazlalık.
   Zarafet burada eklemekten değil, çıkarmaktan geliyor. */
.kunye{display:none}

.sol{position:absolute;left:82px;top:50%;transform:translateY(-50%);width:520px}

/* ÜST SATIR: harfleri açılmış küçük serif. Kartvizit ve antet dilidir;
   markanın önünde durmadan ona bir sınıf verir. */
/* TÜRKÇE BÜYÜK HARF TUZAĞI. Burada CSS'in uppercase dönüşümü VARDI ve
   "Yönetimi" kelimesini "YÖNETIMI" yapıyordu: CSS, Türkçenin i→İ kuralını
   bilmez, noktasız I üretir. Türk avukata gösterilecek bir görselde Türkçe
   imla hatası, anlatmaya çalıştığımız özenin tam tersini söyler.
   Çözüm: dönüşümü CSS'e bırakmayıp metni ZATEN büyük yazmak. */
.ust{font-family:'Baslik';font-size:15px;letter-spacing:.34em;
  color:var(--altin);margin-bottom:20px;padding-left:3px}
.ad{font-family:'Imza';font-size:96px;color:#fff;line-height:.92;
  text-shadow:0 2px 20px rgba(0,0,0,.45)}
/* Cetvel: iki uca da gitmeyen, ölçülü bir çizgi. */
.cizgi{width:172px;height:1.5px;margin:28px 0 24px 4px;
  background:linear-gradient(90deg,var(--altin-parlak) 0%,rgba(201,167,94,.12) 100%)}
.slogan{font-family:'Baslik';font-size:33px;color:#E4ECFA;line-height:1.28;
  letter-spacing:-.005em;font-weight:400}

/* MÜHÜR. Terazi artık bir arayüz ikonu değil, bir MÜHÜR: altın halka içinde,
   gravür gibi. Hukukun görsel dilinde mühür en güçlü işarettir ve
   küçültüldüğünde bile tanınır — ince ayrıntıya değil, SİLUETE dayanıyor. */
.muhur{position:absolute;right:104px;top:50%;transform:translateY(-50%);
  width:334px;height:334px;border-radius:50%;
  border:1.5px solid rgba(201,167,94,.68);
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 40% 34%,rgba(255,255,255,.045) 0%,rgba(255,255,255,0) 62%)}
.muhur::before{content:'';position:absolute;inset:14px;border-radius:50%;
  border:1px solid rgba(201,167,94,.4)}
.muhur svg{width:224px;height:224px}
.muhur .kiris{stroke:#E8EFFC}
</style></head><body>
<div class="tuval">
  <div class="doku"></div>
  <div class="kunye">${kunyeler}</div>
  <div class="muhur"><svg viewBox="0 0 512 512">${TERAZI}</svg></div>
  <div class="cerceve"></div>
  <div class="sol">
    <div class="ust">${ustBaslik}</div>
    <div class="ad">Vekil Pro</div>
    <div class="cizgi"></div>
    <div class="slogan">${slogan}</div>
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
  ustBaslik: 'AVUKATLIK BÜRO YÖNETİMİ',
  slogan: 'Büronuz ve içtihat<br>araştırmanız tek yerde.',
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
