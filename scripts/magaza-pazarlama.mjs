// MAĞAZA PAZARLAMA GÖRSELLERİ — ham ekran görüntüsünü vitrin görseline çevirir.
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR BETİK. `magaza-ekranlari.mjs` uygulamanın GERÇEK ekranını
// çekiyor ve öyle kalmalı — o dosyanın işi doğruluk. Bu betik ise o ham PNG'yi
// alıp başlık, arka plan ve çerçeveyle vitrin görseline dönüştürüyor. İkisini
// tek dosyada birleştirmek, "ekranı süslemek" ile "ekranı ölçmek" işlerini
// karıştırırdı; süslenmiş bir görüntüyle hata aramak imkânsızdır.
//
// NE ÜRETİR
//   play/     1080×1920  — Google Play telefon ekran görüntüsü
//   ios/      1290×2796  — App Store 6.7" (zorunlu boyut)
//   play/feature-1024x500.png — Play "öne çıkan görsel", ZORUNLU ve tek boyut
//
// TASARIM KAYNAĞI: ürünün kendi Terminal paleti (src/theme/palettes.ts).
// Vitrin görseli uygulamadan başka bir dünya gibi durmamalı; mağazada gördüğü
// yeşil-siyahı açtığında da görsün.
//
// YAZI TİPİ: üründe JetBrains Mono kullanılıyor ama burada yerelde kurulu
// olmayabilir. Google Fonts denenir, düşerse sistem monospace'ine iner —
// görsel yine çıkar, yalnız harfler değişir. Betiği bir yazı tipi yüzünden
// düşürmek, hiç görsel üretmemek demek olurdu.

import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const HAM = join(KOK, 'magaza-gorselleri');
const CIKTI = join(KOK, 'magaza-pazarlama');

// Terminal paleti — src/theme/palettes.ts ile aynı olmalı.
const R = {
  bg: '#0A0C10',
  yuzey: '#0E1116',
  cizgi: '#1C2028',
  metin: '#D7DCE4',
  soluk: '#7C8798',
  yesil: '#3FB950',
  altin: '#D29922',
};

/**
 * VİTRİN METİNLERİ.
 *
 * Her başlık, o ekranda GERÇEKTEN görünen şeyi anlatır — mağaza görselinde
 * ekranda olmayan bir şeyi vaat etmek, indirme sonrası ilk hayal kırıklığıdır
 * ve iki mağazada da yanıltıcı tanıtım sayılır.
 *
 * "66.000+" sayısı bilerek YUVARLAK VE DÜŞÜK: korpus saatte ~570 büyüyor
 * (16.09.2026'da 66.870 ölçüldü), yani bu sayı her geçen gün daha da doğru
 * hâle gelir. Tam sayı yazmak, görseli bir hafta içinde yanlış yapardı.
 */
const KARTLAR = [
  { dosya: '01-pano.png',       ust: 'Gününüz tek ekranda', alt: 'Duruşma, süre ve emsal karar — sabah açtığınızda hepsi karşınızda.' },
  { dosya: '02-davalar.png',    ust: 'Dosyalarınız düzende', alt: 'Aşama, mahkeme ve karşı taraf bilgisiyle tam dizin.' },
  { dosya: '03-takvim.png',     ust: 'Süre kaçırmayın',      alt: 'Duruşma ve süreler takvimde, hatırlatmalarıyla birlikte.' },
  { dosya: '06-ictihat.png',    ust: '66.000+ karar',        alt: 'Yargıtay ve Danıştay kararlarında tam metin araması.' },
  { dosya: '04-dava-detay.png', ust: 'Dosyanın tam geçmişi', alt: 'Duruşmalar, süreler, belgeler ve çalışma kayıtları bir arada.' },
  { dosya: '05-finans.png',     ust: 'Vekâlet ücreti hesaplı', alt: 'KDV ve stopaj otomatik; serbest meslek makbuzu hazır.' },
];

/** Ham PNG'yi data URI'ye çevirir — dosya yolu vermek tarayıcıda CSP'ye takılıyor. */
async function dataUri(yol) {
  const b = await readFile(yol);
  return `data:image/png;base64,${b.toString('base64')}`;
}

function sayfa({ genislik, yukseklik, ust, alt, img, telefonGenislik }) {
  // Ölçüler orana göre türetiliyor ki aynı şablon hem 1080×1920 hem 1290×2796
  // üretebilsin. Sabit piksel yazmak, ikinci boyutta her şeyi bozardı.
  const bas = Math.round(genislik * 0.062);
  const altP = Math.round(genislik * 0.034);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@400;600&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${genislik}px;height:${yukseklik}px;background:${R.bg};
       display:flex;flex-direction:column;align-items:center;overflow:hidden;
       font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
  /* Arka planda çok hafif bir ışık — düz siyah, mağaza ızgarasında ölü durur. */
  .isik{position:absolute;top:-18%;left:50%;transform:translateX(-50%);
        width:${genislik * 1.3}px;height:${genislik * 1.3}px;border-radius:50%;
        background:radial-gradient(circle,${R.yesil}22 0%,transparent 62%)}
  .metin{position:relative;text-align:center;padding:${Math.round(genislik * 0.085)}px ${Math.round(genislik * 0.07)}px ${Math.round(genislik * 0.03)}px}
  h1{font-size:${bas}px;font-weight:700;color:${R.metin};letter-spacing:-.02em;line-height:1.12;text-wrap:balance}
  h1 em{font-style:normal;color:${R.yesil}}
  p{margin-top:${Math.round(genislik * 0.022)}px;font-family:Manrope,system-ui,sans-serif;
    font-size:${altP}px;font-weight:400;color:${R.soluk};line-height:1.45;text-wrap:balance}
  .cerceve{position:relative;margin-top:auto;width:${telefonGenislik}px;
           border:${Math.round(genislik * 0.004)}px solid ${R.cizgi};
           border-radius:${Math.round(genislik * 0.035)}px ${Math.round(genislik * 0.035)}px 0 0;
           border-bottom:none;overflow:hidden;background:${R.yuzey};
           box-shadow:0 0 ${Math.round(genislik * 0.09)}px ${R.yesil}1f}
  .cerceve img{display:block;width:100%}
</style></head><body>
  <div class="isik"></div>
  <div class="metin"><h1>${ust}</h1><p>${alt}</p></div>
  <div class="cerceve"><img src="${img}"></div>
</body></html>`;
}

/**
 * Play "öne çıkan görsel" — 1024×500, ZORUNLU ve tek kabul edilen boyut.
 *
 * İKİ DÜZELTME (16.09.2026, ilk üretimde gözle görüldü):
 *  • Başlık üç satıra kırılıyordu ve kırılma yeri anlamsızdı ("takvimi" tek
 *    başına satırda kalmıştı). Metin kısaltıldı, `<br>` kaldırıldı ve
 *    genişlik iki satıra oturacak şekilde ayarlandı.
 *  • Sağ yarı boştu; sadece zayıf bir ışık vardı ve görsel dengesiz
 *    duruyordu. Oraya gerçek bir ekran görüntüsü kondu — hem boşluğu
 *    dolduruyor hem de mağaza ızgarasında ürünün ne olduğunu tek bakışta
 *    gösteriyor.
 */
function oneCikan(img) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@400;600&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;background:${R.bg};overflow:hidden;position:relative;
       display:flex;align-items:center;gap:40px;padding:0 0 0 64px;
       font-family:'JetBrains Mono',ui-monospace,monospace}
  .isik{position:absolute;right:16%;top:-46%;width:700px;height:700px;border-radius:50%;
        background:radial-gradient(circle,${R.yesil}2e 0%,transparent 64%)}
  .sol{position:relative;width:560px;flex:none}
  .marka{font-size:25px;font-weight:700;color:${R.metin};letter-spacing:-.01em}
  .marka span{color:${R.yesil}}
  h1{margin-top:18px;font-size:44px;font-weight:700;color:${R.metin};
     line-height:1.14;letter-spacing:-.025em}
  h1 em{font-style:normal;color:${R.yesil}}
  p{margin-top:15px;font-family:Manrope,system-ui,sans-serif;font-size:18px;
    color:${R.soluk};line-height:1.5;max-width:500px}
  .rozetler{margin-top:22px;display:flex;gap:9px}
  .rozet{font-size:13px;color:${R.metin};border:1px solid ${R.cizgi};background:${R.yuzey};
         border-radius:4px;padding:6px 12px;white-space:nowrap}
  /* Ekran görüntüsü sağda, alttan taşacak şekilde — tam sığdırmak onu
     okunamayacak kadar küçültürdü. */
  .telefon{position:relative;flex:none;width:268px;margin-top:96px;
           border:3px solid ${R.cizgi};border-bottom:none;
           border-radius:22px 22px 0 0;overflow:hidden;background:${R.yuzey};
           box-shadow:0 0 70px ${R.yesil}26}
  .telefon img{display:block;width:100%}
</style></head><body>
  <div class="isik"></div>
  <div class="sol">
    <div class="marka">⚖ Vekil <span>Pro</span></div>
    <h1>Avukatın dosyası,<br>takvimi ve <em>içtihadı</em></h1>
    <p>Duruşma ve süre takibi, müvekkil yönetimi, vekâlet ücreti hesabı
       ve 66.000+ Yargıtay-Danıştay kararında arama.</p>
    <div class="rozetler">
      <div class="rozet">Duruşma &amp; süre</div>
      <div class="rozet">İçtihat araması</div>
      <div class="rozet">Vekâlet ücreti</div>
    </div>
  </div>
  <div class="telefon"><img src="${img}"></div>
</body></html>`;
}

const BOYUTLAR = [
  { ad: 'play', genislik: 1080, yukseklik: 1920, telefonGenislik: 860 },
  { ad: 'ios',  genislik: 1290, yukseklik: 2796, telefonGenislik: 1010 },
];

// TARAYICI YOLU ELLE VERİLİYOR — magaza-ekranlari.mjs ile aynı sebep.
// playwright-core kendi indirdiği tarayıcıyı arıyor; bu ortamda tarayıcı
// /opt/pw-browsers altında hazır kurulu ve `npx playwright install` YASAK
// (ortam notu). Yol verilmezse betik "Executable doesn't exist" ile düşer.
const tarayici = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
try {
  for (const b of BOYUTLAR) {
    const klasor = join(CIKTI, b.ad);
    if (!existsSync(klasor)) await mkdir(klasor, { recursive: true });
    const sayfaNesnesi = await tarayici.newPage({
      viewport: { width: b.genislik, height: b.yukseklik },
      deviceScaleFactor: 1,
    });
    let i = 0;
    for (const k of KARTLAR) {
      const hamYol = join(HAM, k.dosya);
      if (!existsSync(hamYol)) { console.log(`  ! atlandı (ham yok): ${k.dosya}`); continue; }
      i += 1;
      const html = sayfa({ ...b, ust: k.ust, alt: k.alt, img: await dataUri(hamYol) });
      await sayfaNesnesi.setContent(html, { waitUntil: 'load' });
      // Yazı tipi ağdan geliyorsa yerleşmesini bekle; gelmezse zaman aşımı
      // görseli düşürmesin diye yutuluyor.
      await sayfaNesnesi.evaluate(() => document.fonts.ready).catch(() => {});
      await sayfaNesnesi.waitForTimeout(350);
      const ad = `${String(i).padStart(2, '0')}-${k.dosya.replace(/^\d+-/, '')}`;
      await sayfaNesnesi.screenshot({ path: join(klasor, ad) });
      console.log(`  ✓ ${b.ad}/${ad}`);
    }
    await sayfaNesnesi.close();
  }

  // Öne çıkan görsel — yalnız Play istiyor.
  const fp = await tarayici.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await fp.setContent(oneCikan(await dataUri(join(HAM, '01-pano.png'))), { waitUntil: 'load' });
  await fp.evaluate(() => document.fonts.ready).catch(() => {});
  await fp.waitForTimeout(350);
  await fp.screenshot({ path: join(CIKTI, 'play', 'feature-1024x500.png') });
  console.log('  ✓ play/feature-1024x500.png');
  await fp.close();
} finally {
  await tarayici.close();
}
console.log(`bitti → ${CIKTI}`);
