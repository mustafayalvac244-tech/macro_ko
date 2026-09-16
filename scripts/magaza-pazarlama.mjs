// MAĞAZA PAZARLAMA GÖRSELLERİ — ham ekran görüntüsünü VİTRİN görseline çevirir.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR BETİK. `magaza-ekranlari.mjs` uygulamanın GERÇEK ekranını
// çekiyor ve öyle kalmalı — o dosyanın işi doğruluk. Bu betik ise o ham PNG'yi
// alıp başlık, arka plan, çerçeve ve etiketlerle vitrin görseline çeviriyor.
// Süslenmiş bir görüntüyle hata aramak imkânsızdır; ikisi karışmamalı.
//
// ÜRÜN SAHİBİ (16.09.2026): "abi reklam bu, orda şov yapman lazım" +
// "rakiplerden fazla olan özellikleri vurgula."
//
// ŞOV: lacivert blok + ALTIN vurgulu başlık (altın, logodaki kefe rengi),
// gerçek telefon çerçevesi bloktan taşarak çıkıyor, ekrandaki özelliğe işaret
// eden altın etiketler, arkada ince defter çizgileri, öne çıkan görselde iki
// telefon üst üste.
//
// VURGU: sıra ve başlıklar, depoda BELGELENMİŞ farklara göre —
//   • Künye denetimi: AI'ın verdiği her madde/karar künyesi doğrulanır,
//     havuzda yok ya da olamaz diye işaretlenir (BEKLEME-PENCERESI.md:
//     "hiçbir rakip bunu denetlediğini söylemiyor"). BAŞ SIRADA.
//   • Duruşma çıkışında süreyi tebligat/tefhim ayrımıyla türetme
//     (KOSGEB.md 4.6, app/durusma-cikisi.tsx).
//   • UYAP UDF/PDF'ten künye okuyup dosya açma (app/dosya-aktar.tsx).
//   • Mevzuat cihazda — adliyede internet yokken de (src/data/laws).
// "Rakiplerde yok" CÜMLESİ GÖRSELE YAZILMADI: Ticari Reklam Yönetmeliği
// karşılaştırmalı reklamı nesnel kanıta bağlıyor ve iki mağaza da rakip
// adı/iması istemiyor. Vurgu, o özelliklere baş sırayı ve büyük başlığı
// vererek yapılıyor — rakibi anarak değil.
//
// KURAL: EKRAN GÖRÜNTÜSÜ HER ZAMAN GERÇEK. Etiket ve başlık ETRAFINA konur,
// ekranın İÇİNE dokunulmaz. İki mağaza da bunu şart koşuyor.
//
// SAYI VE FİYAT YOK — ürün sahibi kararı (16.09.2026): "şu sikko verileri
// yazma; 399/ay, 66.000 karar… adamlar yalan malan yazıyor." Önceki sürümde
// öne çıkan görselde üç sayı çipi vardı (karar sayısı, madde atfı, aylık
// fiyat). Hepsi çıkarıldı; yerine üç ÖZELLİK çipi kondu. Gerekçe ikili:
// (a) rakamla yarışan vitrin, abartan rakiplerle aynı rafa koyar;
// (b) rakam eskir — korpus saatte büyüyor, fiyat değişebilir — ve eskiyen
// rakam yalan olur. Özellik eskimez.
//
// NE ÜRETİR
//   play/  1080×1920 ×N + feature-1024x500.png (Play "öne çıkan", ZORUNLU)
//   ios/   1290×2796 ×N (App Store 6.7", zorunlu boyut)
//
// PALET: ürünün Gece (dark) teması — ürün sahibi ekran görüntüsüyle seçti.
// Ekranlar da aynı temayla çekiliyor (VP_TEMA=dark).

import { chromium } from 'playwright-core';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const HAM = join(KOK, 'magaza-gorselleri');
const CIKTI = join(KOK, 'magaza-pazarlama');

// src/theme/palettes.ts > dark (Gece) ile birebir. Ürün sahibi 16.09.2026'da
// Gece temasının ekran görüntüsünü gönderip "bunu kullan" dedi: lacivert
// zemin, altın vurgu, Manrope. Ekranlar da aynı temayla çekiliyor
// (VP_TEMA=dark). `lacivert`/`derin` blok gradyanı, `altin` logodaki kefe.
const R = {
  bg: '#0E1A2E', yuzey: '#13203A', cizgi: '#1C2D48', metin: '#ECF2FC', soluk: '#A5B4CD',
  lacivert: '#13203A', derin: '#070E1B', altin: '#E3C275', altinKoyu: '#B8944A',
};

/**
 * KARTLAR — sıra vurgudur: en ayırt edici özellik en önde.
 *
 * `vurgu` başlığın altınla yazılan kelimesi. Etiketlerin `y` değeri telefon
 * ekranının yüzdesi (0 üst), `taraf` çıkış kenarı. Konumlar 16.09.2026'daki
 * ekran düzenine göre — düzen değişirse etiket yanlış yere işaret eder;
 * ÜRETTİKTEN SONRA GÖZLE BAK.
 *
 * Başlıklar ekranda GERÇEKTEN görünen şeyi anlatır; garanti veren fiil yok.
 */
const KARTLAR = [
  {
    dosya: '06-ictihat.png',
    ust: 'Uydurmayan', vurgu: 'yapay zekâ',
    alt: 'Verilen her kanun maddesi ve karar künyesi denetlenir: doğrulandı, havuzda yok ya da olamaz.',
    etiketler: [
      { y: 23, taraf: 'sag', metin: 'Olayı anlatın, içtihadı bulsun' },
      { y: 75, taraf: 'sol', metin: 'Her künye denetlenir' },
    ],
  },
  {
    // KISA EKRAN: içerik üst %54'te bitiyor, gerisi boş zemin. `kes` ile
    // yalnız o kısım gösterilir; telefon tam çerçeveli ve ortalı çizilir.
    dosya: '07-durusma-cikisi.png', kes: 0.60,
    ust: 'Duruşmadan çıkın,', vurgu: 'süre hazır',
    alt: 'Ne olduğunu seçin; tebligat/tefhim ayrımıyla süre türetilir ve takvime düşer.',
    etiketler: [
      { y: 27, taraf: 'sag', metin: 'Takvime düşer' },
      { y: 39.5, taraf: 'sol', metin: 'Karar açıklandı → süre otomatik' },
    ],
  },
  {
    dosya: '08-dosya-aktar.png', kes: 0.40,
    ust: 'UYAP dosyasını atın,', vurgu: 'künye hazır',
    alt: 'UDF ya da PDF\'ten esas no, mahkeme ve taraflar okunur; dosya tek dokunuşla açılır.',
    etiketler: [
      { y: 19.5, taraf: 'sag', metin: 'Otomatik okunur' },
      { y: 34, taraf: 'sol', metin: 'UDF / PDF' },
    ],
  },
  {
    dosya: '01-pano.png',
    ust: 'Gününüz', vurgu: 'tek bakışta',
    alt: 'Sabah açtığınızda duruşma, süre ve davanıza emsal karar hazır.',
    etiketler: [
      { y: 44, taraf: 'sag', metin: 'Bugünün duruşması ve süresi' },
      { y: 64, taraf: 'sol', metin: 'Davanıza emsal — otomatik' },
    ],
  },
  {
    dosya: '05-finans.png',
    ust: 'Vekâlet ücreti', vurgu: 'hesaplı',
    alt: 'KDV ve stopaj otomatik; serbest meslek makbuzu bilgileri hazır.',
    etiketler: [
      { y: 30, taraf: 'sag', metin: 'KDV + stopaj otomatik' },
    ],
  },
  {
    dosya: '03-takvim.png',
    ust: 'Süreler', vurgu: 'takvimde',
    alt: 'Duruşma ve süreler hatırlatmalarıyla birlikte — mevzuat cihazda, adliyede internet olmasa da.',
    etiketler: [
      { y: 40, taraf: 'sag', metin: 'Duruşma günü işaretli' },
    ],
  },
];

async function dataUri(yol, tip = 'image/png') {
  const b = await readFile(yol);
  return `data:${tip};base64,${b.toString('base64')}`;
}

/**
 * YAZI TİPİ YERELDEN. İlk üretimde Google Fonts bağlantısı bu ortamda
 * gelmedi ve başlık sistem fontuna düştü — ekrandaki Manrope ile
 * çelişiyordu. Uygulama Manrope'u zaten node_modules'ta taşıyor
 * (@expo-google-fonts/manrope); aynı dosyalar @font-face ile gömülüyor.
 * Bulunamazsa Google Fonts'a düşer; o da gelmezse sistem fontu — betik
 * yazı tipi yüzünden asla düşmez.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
function fontBul(kok, ad) {
  try {
    for (const e of readdirSync(kok)) {
      const y = join(kok, e);
      if (statSync(y).isDirectory()) { const b = fontBul(y, ad); if (b) return b; }
      else if (e === ad) return y;
    }
  } catch { /* klasör yok */ }
  return null;
}
const FONT_KOK = join(KOK, 'node_modules', '@expo-google-fonts', 'manrope');
const FONTLAR = [
  { w: 400, dosya: 'Manrope_400Regular.ttf' },
  { w: 600, dosya: 'Manrope_600SemiBold.ttf' },
  { w: 800, dosya: 'Manrope_800ExtraBold.ttf' },
].map((f) => ({ ...f, yol: fontBul(FONT_KOK, f.dosya) }));
const fontCss = FONTLAR.filter((f) => f.yol).map((f) =>
  `@font-face{font-family:Manrope;font-weight:${f.w};src:url(data:font/ttf;base64,${readFileSync(f.yol).toString('base64')}) format('truetype')}`
).join('\n');
const fontLink = fontCss ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap">';
console.log(fontCss ? `  yazı tipi: yerel Manrope (${FONTLAR.filter((f) => f.yol).length}/3 ağırlık)` : '  yazı tipi: yerel bulunamadı, Google Fonts deneniyor');

function bas() {
  return `<meta charset="utf-8">${fontLink}
<style>${fontCss}
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--bg:${R.bg};--yuzey:${R.yuzey};--cizgi:${R.cizgi};--metin:${R.metin};--soluk:${R.soluk};
        --lacivert:${R.lacivert};--derin:${R.derin};--altin:${R.altin};--altinK:${R.altinKoyu}}
  body{font-family:Manrope,system-ui,-apple-system,sans-serif;overflow:hidden;position:relative;background:var(--bg)}
  .defter{position:absolute;inset:0;background-image:linear-gradient(var(--cizgi) 1px,transparent 1px);
          background-size:100% 56px;opacity:.7}
  .altinCizgi{height:4px;background:linear-gradient(90deg,var(--altin),transparent);border-radius:2px}
</style>`;
}

/** Telefon kartı: lacivert blok + altın başlık + çerçeveli telefon + etiketler. */
function kart({ genislik: G, yukseklik: Y, ust, vurgu, alt, etiketler, img, kes }) {
  const px = (n) => Math.round(n * (G / 1080));
  // Kırpılmış (kısa) ekranda telefon daha geniş: tam boy telefon kanvasın
  // altından taşıp doluluk verir, kırpılmış olan taşmaz — aynı genişlikte
  // kalsa altta büyük boş zemin kalırdı (ilk üretimde görüldü).
  const telW = kes ? px(840) : px(760), blokH = px(600), telUst = px(430), cerceve = px(14);
  // Ham ekran 1079×2397; telefon genişliğine ölçeklenmiş tam yüksekliği:
  const ekranH = Math.round(telW * 2397 / 1079);
  // Etiket konumu EKRAN PİKSELİNE göre — ekranın % kaçında olduğu, kanvasa
  // göre değil. Böylece kırpılmış ve tam boy kartlarda aynı formül çalışır.
  const etiketHtml = etiketler.map((e) => {
    return `<div class="etiket ${e.taraf}" data-y="${e.y}">
      <span class="nokta"></span><span class="ok"></span><span class="kutu">${e.metin}</span></div>`;
  }).join('');
  // KISA EKRAN: `kes` verilirse ekranın yalnız üst kısmı gösterilir ve
  // telefon dört köşesi de yuvarlak, tam çerçeveli çizilir. Tam boy
  // telefonda alt kenar kanvastan taşar; kırpılmışta taşacak şey yok, boş
  // zemin görünürdü — o yüzden çerçeve kapatılıyor.
  const gorunurH = kes ? Math.round(ekranH * kes) : null;
  const koseAlt = kes ? px(64) : 0;
  const ekranKoseAlt = kes ? px(50) : 0;
  return `<!doctype html><html><head>${bas()}<style>
  body{width:${G}px;height:${Y}px}
  .blok{position:absolute;left:0;right:0;top:0;height:${blokH}px;
        background:linear-gradient(160deg,var(--lacivert) 0%,var(--derin) 100%)}
  .blok:after{content:'';position:absolute;right:-${px(140)}px;top:-${px(160)}px;width:${px(520)}px;height:${px(520)}px;
        border-radius:50%;background:radial-gradient(circle,rgba(227,194,117,.28),transparent 62%)}
  .metin{position:absolute;left:${px(72)}px;right:${px(72)}px;top:${px(88)}px;color:#fff}
  .marka{display:flex;align-items:center;gap:${px(12)}px;font-weight:800;font-size:${px(26)}px;letter-spacing:.02em;opacity:.92}
  .marka i{display:inline-block;width:${px(30)}px;height:${px(30)}px;border-radius:${px(7)}px;background:var(--altin)}
  h1{margin-top:${px(26)}px;font-size:${px(84)}px;line-height:1.02;font-weight:800;letter-spacing:-.03em;text-wrap:balance}
  h1 em{font-style:normal;color:var(--altin)}
  p{margin-top:${px(18)}px;font-size:${px(29)}px;line-height:1.35;color:rgba(255,255,255,.84);max-width:${px(860)}px;text-wrap:balance}
  .altinCizgi{width:${px(120)}px;margin-top:${px(20)}px}
  .telefon{position:absolute;left:50%;transform:translateX(-50%);top:${telUst}px;width:${telW}px;
           padding:${cerceve}px;background:var(--derin);
           border-radius:${px(64)}px ${px(64)}px ${koseAlt}px ${koseAlt}px;
           box-shadow:0 ${px(30)}px ${px(80)}px rgba(0,0,0,.55),0 0 0 ${px(2)}px rgba(227,194,117,.35)}
  .telefon .ekran{border-radius:${px(50)}px ${px(50)}px ${ekranKoseAlt}px ${ekranKoseAlt}px;overflow:hidden;background:var(--yuzey);
                  ${gorunurH ? `height:${gorunurH}px;` : ''}}
  .telefon img{display:block;width:100%}
  .centik{position:absolute;left:50%;transform:translateX(-50%);top:${px(26)}px;width:${px(200)}px;height:${px(34)}px;
          border-radius:${px(20)}px;background:var(--derin);z-index:2}
  .etiket{position:absolute;display:flex;align-items:center;z-index:3}
  .etiket.sag{right:${px(24)}px;flex-direction:row-reverse}
  .etiket.sol{left:${px(24)}px}
  .kutu{background:var(--yuzey);color:var(--metin);font-weight:600;font-size:${px(24)}px;
        padding:${px(12)}px ${px(18)}px;border-radius:${px(10)}px;border:${px(2)}px solid var(--altin);
        box-shadow:0 ${px(8)}px ${px(24)}px rgba(0,0,0,.45);white-space:nowrap}
  .ok{width:${px(40)}px;height:${px(2)}px;background:var(--altinK)}
  .nokta{width:${px(14)}px;height:${px(14)}px;border-radius:50%;background:var(--altin);
         border:${px(3)}px solid var(--yuzey);box-shadow:0 0 0 ${px(2)}px var(--altinK)}
</style></head><body>
  <div class="defter"></div><div class="blok"></div>
  <div class="metin">
    <div class="marka"><i></i>VEKİL PRO</div>
    <h1>${ust} <em>${vurgu}</em></h1>
    <div class="altinCizgi"></div>
    <p>${alt}</p>
  </div>
  <div class="telefon"><div class="centik"></div><div class="ekran"><img src="${img}"></div></div>
  ${etiketHtml}
  <script>
    // TELEFON METNİN ALTINA, ÖLÇEREK. Sabit ${telUst}px, iki satırlık
    // başlıkta alt başlığın üstüne biniyordu (ilk üretimde 02 ve 03'te
    // görüldü). Metin bloğunun gerçek altı ölçülüp telefon onun altına
    // konuyor; lacivert blok da telefonu kapsayacak kadar uzatılıyor ki
    // telefon her zaman bloktan "çıkıyor" görünsün. Etiketler de aynı
    // ölçüme göre yerleşiyor — sunucu tarafında tahmin edilmiyor.
    document.fonts.ready.then(() => {
      const metin = document.querySelector('.metin').getBoundingClientRect();
      const top = Math.max(${telUst}, Math.round(metin.bottom + ${px(36)}));
      const tel = document.querySelector('.telefon');
      tel.style.top = top + 'px';
      document.querySelector('.blok').style.height = (top + ${px(170)}) + 'px';
      // TAM BOY TELEFON KANVASTAN TAŞMALI. iOS kanvası (1290×2796) Play'den
      // (1080×1920) orantılı olarak daha uzun; aynı genişlikteki telefon orada
      // kanvasın ortasında düz kesilmiş bir alt kenarla bitiyordu (ilk üretimde
      // görüldü). Genişlik, ekranın altı kanvasın altını geçecek şekilde
      // burada hesaplanıyor; Play'de gereken 760'ın altında kaldığı için
      // orada hiçbir şey değişmiyor. Kırpılmış kartlar tam çerçeveli, onlara
      // dokunulmuyor.
      let ekranH = ${ekranH};
      if (!${kes ? 'true' : 'false'}) {
        const gereken = Math.ceil((${Y} - top - ${cerceve} + ${px(40)}) * 1079 / 2397);
        const w = Math.min(Math.max(${telW}, gereken), ${G} - 2 * ${px(56)});
        tel.style.width = w + 'px';
        ekranH = Math.round(w * 2397 / 1079);
      }
      document.querySelectorAll('.etiket').forEach((e) => {
        e.style.top = (top + ${cerceve} + Math.round((Number(e.dataset.y) / 100) * ekranH)) + 'px';
      });
      document.body.dataset.hazir = '1';
    });
  </script>
</body></html>`;
}

/** Play öne çıkan görsel — 1024×500, zorunlu tek boyut. İki telefon üst üste. */
function oneCikan({ pano, ictihat, logo }) {
  return `<!doctype html><html><head>${bas()}<style>
  body{width:1024px;height:500px;background:linear-gradient(135deg,var(--lacivert) 0%,var(--derin) 70%)}
  .defter{opacity:.08;background-image:linear-gradient(rgba(255,255,255,.9) 1px,transparent 1px)}
  .isik{position:absolute;right:120px;top:-260px;width:640px;height:640px;border-radius:50%;
        background:radial-gradient(circle,rgba(227,194,117,.32),transparent 62%)}
  .sol{position:absolute;left:56px;top:50px;width:470px;color:#fff}
  .marka{display:flex;align-items:center;gap:12px;font-weight:800;font-size:22px;letter-spacing:.02em}
  .marka img{width:38px;height:38px;border-radius:9px}
  h1{margin-top:20px;font-size:50px;line-height:1.04;font-weight:800;letter-spacing:-.03em}
  h1 em{font-style:normal;color:var(--altin)}
  .altinCizgi{width:96px;margin-top:14px}
  p{margin-top:12px;font-size:17px;line-height:1.45;color:rgba(255,255,255,.84);max-width:480px}
  .ozellikler{margin-top:20px;display:flex;gap:9px;flex-wrap:wrap}
  .ozellik{background:rgba(255,255,255,.06);border:1px solid rgba(227,194,117,.55);border-radius:8px;
           padding:9px 14px;font-size:14px;font-weight:600;color:var(--metin);white-space:nowrap}
  .tel{position:absolute;padding:9px;background:var(--derin);border-radius:34px 34px 0 0;
       box-shadow:0 20px 50px rgba(0,0,0,.45),0 0 0 1.5px rgba(227,194,117,.45)}
  .tel .ekran{border-radius:26px 26px 0 0;overflow:hidden;background:#fff}
  .tel img{display:block;width:100%}
  .arka{right:64px;top:120px;width:230px;transform:rotate(6deg);opacity:.92}
  .on{right:210px;top:74px;width:250px;transform:rotate(-4deg)}
</style></head><body>
  <div class="defter"></div><div class="isik"></div>
  <div class="sol">
    <div class="marka"><img src="${logo}">VEKİL PRO</div>
    <h1>Uydurmayan<br><em>yapay zekâ</em></h1>
    <div class="altinCizgi"></div>
    <p>Her karar künyesi denetlenir. Duruşma çıkışında süre otomatik. UYAP dosyasından künye tek dokunuşla.</p>
    <div class="ozellikler">
      <div class="ozellik">Her künye denetlenir</div>
      <div class="ozellik">Duruşma çıkışında süre</div>
      <div class="ozellik">UYAP'tan dosya aç</div>
    </div>
  </div>
  <div class="tel arka"><div class="ekran"><img src="${ictihat}"></div></div>
  <div class="tel on"><div class="ekran"><img src="${pano}"></div></div>
</body></html>`;
}

const BOYUTLAR = [
  { ad: 'play', genislik: 1080, yukseklik: 1920 },
  { ad: 'ios',  genislik: 1290, yukseklik: 2796 },
];

// Tarayıcı yolu elle: bu ortamda /opt/pw-browsers hazır, `playwright install` yasak.
const tarayici = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
try {
  for (const b of BOYUTLAR) {
    const klasor = join(CIKTI, b.ad);
    if (!existsSync(klasor)) await mkdir(klasor, { recursive: true });
    const sayfa = await tarayici.newPage({ viewport: { width: b.genislik, height: b.yukseklik }, deviceScaleFactor: 1 });
    let i = 0;
    for (const k of KARTLAR) {
      const hamYol = join(HAM, k.dosya);
      if (!existsSync(hamYol)) { console.log(`  ! atlandı (ham yok): ${k.dosya}`); continue; }
      i += 1;
      await sayfa.setContent(kart({ ...b, ...k, img: await dataUri(hamYol) }), { waitUntil: 'load' });
      await sayfa.waitForSelector('body[data-hazir="1"]', { timeout: 8000 }).catch(() => {});
      await sayfa.waitForTimeout(250);
      const ad = `${String(i).padStart(2, '0')}-${k.dosya.replace(/^\d+-/, '')}`;
      await sayfa.screenshot({ path: join(klasor, ad) });
      console.log(`  ✓ ${b.ad}/${ad}`);
    }
    await sayfa.close();
  }
  const fp = await tarayici.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await fp.setContent(oneCikan({
    pano: await dataUri(join(HAM, '01-pano.png')),
    ictihat: await dataUri(join(HAM, '06-ictihat.png')),
    logo: await dataUri(join(KOK, 'docs', 'amblem.svg'), 'image/svg+xml'),
  }), { waitUntil: 'load' });
  await fp.evaluate(() => document.fonts.ready).catch(() => {});
  await fp.waitForTimeout(350);
  await fp.screenshot({ path: join(CIKTI, 'play', 'feature-1024x500.png') });
  console.log('  ✓ play/feature-1024x500.png');
  await fp.close();
} finally {
  await tarayici.close();
}
console.log(`bitti → ${CIKTI}`);
