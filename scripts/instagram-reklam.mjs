// INSTAGRAM REKLAM GÖRSELLERİ — 04.10.2026 (ürün sahibi: "çok profesyonel").
// HTML → PNG, Playwright (Chromium önceden kurulu). Marka: uygulama/site ile
// aynı — lacivert zemin, altın vurgu, Manrope. Her sayı ölçülmüş: 11.280.850
// karar (03.10, Bedesten + UYAP Emsal), 10 ücretsiz soru (UCRETSIZ_DENEME_HAKKI).
// Künyeler MASKELİ (20██/████): reklamda gerçek ya da uydurma künye yazılmaz.
//   node scripts/instagram-reklam.mjs            → magaza-pazarlama/instagram/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CIKTI = path.join(KOK, 'magaza-pazarlama/instagram');
const FONT = (w) => `file://${path.join(KOK, `node_modules/@expo-google-fonts/manrope/${w}/Manrope_${w}.ttf`)}`;
const EKRAN = (ad) => `file://${path.join(KOK, 'magaza-pazarlama/ios', ad)}`;
const LOGO = fs.readFileSync(path.join(KOK, 'docs/index.html'), 'utf8').match(/<svg class="m"[\s\S]*?<\/svg>/)[0].replace('class="m"', 'class="logo"');

const CSS = `
@font-face{font-family:M;src:url(${FONT('400Regular')});font-weight:400}
@font-face{font-family:M;src:url(${FONT('600SemiBold')});font-weight:600}
@font-face{font-family:M;src:url(${FONT('700Bold')});font-weight:700}
@font-face{font-family:M;src:url(${FONT('800ExtraBold')});font-weight:800}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--w);height:var(--h);overflow:hidden;background:#0A0C10}
body{font-family:M,system-ui,sans-serif;color:#F0F4FC;position:relative}
.bg{position:absolute;inset:0;background:
  radial-gradient(900px 700px at 85% -10%,rgba(227,194,117,.18),transparent 60%),
  radial-gradient(1000px 800px at -10% 110%,rgba(23,60,126,.55),transparent 60%),
  linear-gradient(180deg,#0E1A33 0%,#0A0C10 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px);background-size:100% 56px;mask-image:linear-gradient(180deg,transparent,#000 20%,#000 80%,transparent)}
.pad{position:absolute;inset:0;padding:var(--p)}
.marka{display:flex;align-items:center;gap:18px;font-weight:800;letter-spacing:.14em;font-size:30px}
.marka .logo{width:56px;height:56px;border-radius:14px}
.rozet{display:inline-flex;align-items:center;gap:12px;border:1.5px solid rgba(227,194,117,.5);color:#E3C275;border-radius:999px;padding:12px 22px;font-weight:700;font-size:24px;letter-spacing:.08em}
.rozet::before{content:'';width:10px;height:10px;border-radius:50%;background:#E3C275}
h1{font-weight:800;line-height:1.02;letter-spacing:-.025em;text-wrap:balance}
h1 em{font-style:normal;color:#E3C275}
.alt{color:#B6C0D4;font-weight:500;line-height:1.35}
.kart{background:rgba(13,20,36,.92);border:1.5px solid rgba(255,255,255,.1);border-radius:34px;padding:38px 40px;box-shadow:0 40px 90px rgba(0,0,0,.55)}
.kart .bas{display:flex;align-items:center;gap:14px;color:#B6C0D4;font-weight:700;font-size:26px;letter-spacing:.06em;margin-bottom:26px}
.satir{display:flex;gap:18px;align-items:flex-start;border-radius:22px;padding:22px 24px;margin-top:16px;font-size:28px;line-height:1.3}
.satir .ik{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:28px}
.kirmizi{background:rgba(248,81,73,.13);color:#FFB4AE}.kirmizi .ik{background:#F85149;color:#fff}
.yesil{background:rgba(63,185,80,.14);color:#B7F0C0}.yesil .ik{background:#3FB950;color:#06130a}
.mavi{background:rgba(88,166,255,.14);color:#C9E1FF}.mavi .ik{background:#58A6FF;color:#061427}
.satir b{display:block;font-weight:800;color:#fff}
.satir small{display:block;font-size:22px;opacity:.85;margin-top:4px}
.mono{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.mask{display:inline-block;vertical-align:-2px;height:.78em;border-radius:6px;background:rgba(255,255,255,.22);margin:0 1px}
.mask.k{width:1.4em}.mask.u{width:2.6em}
.ara{display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);border-radius:22px;padding:24px 28px;font-size:30px;color:#B6C0D4}
.ara .l{margin-left:auto;color:#E3C275;font-weight:800}
.cip{display:inline-flex;border:1.5px solid rgba(255,255,255,.16);border-radius:999px;padding:10px 20px;font-size:24px;color:#B6C0D4;margin:18px 12px 0 0}
.sonuc{display:flex;gap:16px;align-items:center;padding:18px 0;border-top:1px solid rgba(255,255,255,.08);font-size:27px}
.sonuc .d{color:#E3C275;font-weight:800;min-width:150px}.sonuc .o{color:#8C96AA;margin-left:auto;font-size:23px}
.cta{display:inline-flex;align-items:center;gap:16px;background:#E3C275;color:#0A0C10;font-weight:800;font-size:34px;padding:26px 44px;border-radius:999px}
.cta span{font-weight:700;opacity:.75;font-size:26px}
.alt-not{color:#8C96AA;font-size:22px;line-height:1.4}
.appstore{display:inline-flex;align-items:center;gap:14px;border:1.5px solid rgba(255,255,255,.25);border-radius:16px;padding:14px 22px;font-weight:700;font-size:24px;color:#fff}
.appstore .a{font-size:30px}
.telefon{position:absolute;border-radius:62px;border:10px solid #1C2028;background:#000;box-shadow:0 60px 120px rgba(0,0,0,.6);overflow:hidden}
.telefon img{width:100%;display:block}
.sayi{font-weight:800;letter-spacing:-.04em;line-height:.95;color:#fff}
.sayi em{font-style:normal;color:#E3C275}
.adim{display:flex;gap:26px;align-items:flex-start;margin-top:30px}
.adim .n{flex:none;width:72px;height:72px;border-radius:20px;background:rgba(227,194,117,.16);border:1.5px solid rgba(227,194,117,.5);color:#E3C275;display:grid;place-items:center;font-weight:800;font-size:34px}
.adim b{display:block;font-size:36px;font-weight:800;line-height:1.15}
.adim span{display:block;color:#B6C0D4;font-size:27px;margin-top:8px;line-height:1.35}
.alt-cizgi{height:6px;width:140px;background:linear-gradient(90deg,#E3C275,transparent);border-radius:3px}
`;

const marka = `<div class="marka">${LOGO}<span>VEKİL PRO</span></div>`;
const appstore = `<div class="appstore"><span class="a"></span><span>App Store'da · iPhone ve web</span></div>`;
const denetimKarti = (boy = 1) => `
<div class="kart" style="zoom:${boy}">
  <div class="bas">⚖ KARAR ATFI DENETİMİ · METİNDE 3 KÜNYE</div>
  <div class="satir kirmizi"><div class="ik">✕</div><div><b>Yargıtay 9. HD · E. 20<i class="mask k"></i>/<i class="mask u"></i> K. 20<i class="mask k"></i>/<i class="mask u"></i></b><small>Ne havuzumuzda ne UYAP'ta bulundu → metinden çıkarıldı</small></div></div>
  <div class="satir yesil"><div class="ik">✓</div><div><b>Yargıtay 22. HD · E. 20<i class="mask k"></i>/<i class="mask u"></i> K. 20<i class="mask k"></i>/<i class="mask u"></i></b><small>UYAP'ta canlı doğrulandı</small></div></div>
  <div class="satir mavi"><div class="ik">→</div><div><b>Yerine önerilen gerçek karar</b><small>Cümleniz için 11 milyon kararda bulundu — okuyup siz ekleyin</small></div></div>
</div>`;

const sayfa = (w, h, p, govde) => `<!doctype html><html><head><meta charset="utf-8"><style>:root{--w:${w}px;--h:${h}px;--p:${p}px}${CSS}</style></head><body><div class="bg"></div><div class="grid"></div><div class="pad">${govde}</div></body></html>`;

// ── FEED 4:5 (1080×1350) ──────────────────────────────────────────────────
const feed = {
  '01-kunye': sayfa(1080, 1350, 72, `
    <div style="display:flex;justify-content:space-between;align-items:center">${marka}<div class="rozet">YAPAY ZEKÂ · DENETİMLİ</div></div>
    <h1 style="font-size:88px;margin-top:70px">Uydurma karar künyesi<br><em>dilekçene giremez.</em></h1>
    <p class="alt" style="font-size:32px;margin-top:28px;max-width:900px">Üretilen her künye önce havuzda, bulunamazsa canlı UYAP'ta aranır. Doğrulanamayan metinden çıkar.</p>
    <div style="margin-top:54px">${denetimKarti()}</div>
    <div style="position:absolute;left:72px;right:72px;bottom:72px;display:flex;justify-content:space-between;align-items:center">
      <div class="cta">10 soru ücretsiz <span>kart yok</span></div>${appstore}
    </div>`),
  '02-karar': sayfa(1080, 1350, 72, `
    ${marka}
    <div style="margin-top:70px" class="alt-cizgi"></div>
    <div class="sayi mono" style="font-size:150px;margin-top:30px">11.280.850</div>
    <div style="font-size:52px;font-weight:800;margin-top:6px">karar, <em style="font-style:normal;color:#E3C275">tek aramada.</em></div>
    <p class="alt" style="font-size:31px;margin-top:26px;max-width:900px">Yargıtay ve Danıştay kararlarında tam metin arama; olayınızı anlatın, ilgili içtihat gelsin. Ücretsiz ve sınırsız — kampanya değil, ürünün kalıcı kuralı.</p>
    <p class="alt-not" style="margin-top:22px">Bedesten + UYAP Emsal, 03.10.2026 ölçümü.</p>
    <div class="kart" style="margin-top:44px;padding:30px 34px">
      <div class="ara">🔍 kira tespit davası · hakkaniyet indirimi <span class="l">Ara</span></div>
      <div><span class="cip">Yargıtay</span><span class="cip">Danıştay</span><span class="cip">Son 2 yıl</span><span class="cip">Künye ile bul</span></div>
      <div style="margin-top:22px">
        <div class="sonuc"><span class="d">3. HD</span><span>E. 20<i class="mask k"></i>/<i class="mask u"></i> K. 20<i class="mask k"></i>/<i class="mask u"></i></span><span class="o">tam metin</span></div>
        <div class="sonuc"><span class="d">6. HD</span><span>E. 20<i class="mask k"></i>/<i class="mask u"></i> K. 20<i class="mask k"></i>/<i class="mask u"></i></span><span class="o">özet · kaynaklı</span></div>
      </div>
    </div>
    <div style="position:absolute;left:72px;right:72px;bottom:72px;display:flex;justify-content:space-between;align-items:center">
      <div class="cta">Hemen ara <span>kayıt gerekmez</span></div>${appstore}
    </div>`),
  '03-dilekce': sayfa(1080, 1350, 72, `
    ${marka}
    <h1 style="font-size:78px;margin-top:60px;max-width:620px">Olayı anlat,<br><em>dilekçe taslağı</em><br>gelsin.</h1>
    <div style="margin-top:36px;max-width:560px">
      <div class="adim"><div class="n">1</div><div><b>Vakıalar numaralı</b><span>Tarih sırasıyla, delili yanında.</span></div></div>
      <div class="adim"><div class="n">2</div><div><b>Hukuki sebepler madde numarasıyla</b><span>Dosyada olmayan madde uydurulmaz.</span></div></div>
      <div class="adim"><div class="n">3</div><div><b>Netice-i talep eksiksiz</b><span>Saydığınız her talep ayrı kalem.</span></div></div>
      <div class="adim"><div class="n">4</div><div><b>UDF olarak indir</b><span>UYAP'ın dilekçe biçiminde.</span></div></div>
    </div>
    <div class="telefon" style="width:420px;right:52px;top:340px;height:900px"><img src="${EKRAN('08-dilekce-uret.png')}"></div>
    <div style="position:absolute;left:72px;bottom:72px;display:flex;gap:26px;align-items:center"><div class="cta">10 dilekçe ücretsiz</div></div>`),
  '04-ucretsiz': sayfa(1080, 1350, 72, `
    <div style="display:flex;justify-content:space-between;align-items:center">${marka}<div class="rozet">ÜCRETSİZ BAŞLA</div></div>
    <h1 style="font-size:92px;margin-top:90px">10 soru.<br><em>Kart yok, şart yok.</em></h1>
    <p class="alt" style="font-size:33px;margin-top:30px;max-width:880px">Hesap açın, yapay zekâya sorun ya da dilekçe yazdırın. Beğenmezseniz hiçbir şey ödemezsiniz; içtihat araması zaten hep ücretsiz.</p>
    <div class="kart" style="margin-top:60px">
      <div class="adim" style="margin-top:0"><div class="n">1</div><div><b>Hesap açın</b><span>E-posta ve baro yeter.</span></div></div>
      <div class="adim"><div class="n">2</div><div><b>Sorun ya da dilekçe yazdırın</b><span>Her künye denetlenir.</span></div></div>
      <div class="adim"><div class="n">3</div><div><b>Dosyanızı taşıyın</b><span>Dava, duruşma, müvekkil, finans — tek yerde.</span></div></div>
    </div>
    <div style="position:absolute;left:72px;right:72px;bottom:72px;display:flex;justify-content:space-between;align-items:center">
      <div class="cta">Ücretsiz dene</div>${appstore}
    </div>`),
};

// ── STORY 9:16 (1080×1920) — üst 250 / alt 340 px güvenli alan boş ─────────
const story = {
  '01-kunye': sayfa(1080, 1920, 80, `
    <div style="margin-top:200px">${marka}</div>
    <h1 style="font-size:96px;margin-top:50px">Uydurma künye<br><em>dilekçene giremez.</em></h1>
    <p class="alt" style="font-size:34px;margin-top:28px">Her künye 11 milyon kararda aranır. Bulunamayan metinden çıkar, yerine gerçek karar önerilir.</p>
    <div style="margin-top:44px">${denetimKarti(0.9)}</div>
    <div style="position:absolute;left:80px;right:80px;bottom:330px;display:flex;flex-direction:column;gap:22px;align-items:flex-start">
      <div class="cta">10 soru ücretsiz <span>kart yok</span></div>${appstore}
    </div>`),
  '02-karar': sayfa(1080, 1920, 80, `
    <div style="margin-top:200px">${marka}</div>
    <div class="alt-cizgi" style="margin-top:140px"></div>
    <div class="sayi mono" style="font-size:176px;margin-top:40px;line-height:1">11.280.850</div>
    <div style="font-size:64px;font-weight:800;margin-top:14px">karar, <span style="color:#E3C275">tek aramada.</span></div>
    <p class="alt" style="font-size:36px;margin-top:50px">Yargıtay ve Danıştay. Olayınızı anlatın, ilgili içtihat gelsin. Ücretsiz, sınırsız, kalıcı.</p>
    <p class="alt-not" style="margin-top:28px;font-size:24px">Bedesten + UYAP Emsal, 03.10.2026 ölçümü.</p>
    <div style="position:absolute;left:80px;right:80px;bottom:380px;display:flex;flex-direction:column;gap:22px;align-items:flex-start">
      <div class="cta">Hemen ara <span>kayıt gerekmez</span></div>${appstore}
    </div>`),
  '03-dilekce': sayfa(1080, 1920, 80, `
    <div style="margin-top:200px">${marka}</div>
    <h1 style="font-size:92px;margin-top:60px">Olayı anlat,<br><em>dilekçe taslağı</em> gelsin.</h1>
    <div class="telefon" style="width:560px;left:260px;top:620px;height:760px"><img src="${EKRAN('08-dilekce-uret.png')}"></div>
    <div style="position:absolute;left:80px;right:80px;bottom:380px;display:flex;flex-direction:column;gap:22px;align-items:flex-start">
      <div class="cta">10 dilekçe ücretsiz</div>${appstore}
    </div>`),
};

// ── CAROUSEL 4:5, 3 kare ───────────────────────────────────────────────────
const carousel = {
  '01-sorun': sayfa(1080, 1350, 72, `
    ${marka}
    <div class="rozet" style="margin-top:110px">1 / 3 · SORUN</div>
    <h1 style="font-size:84px;margin-top:40px">Yapay zekâ dilekçene<br><em>olmayan bir karar</em><br>yazdı.</h1>
    <p class="alt" style="font-size:34px;margin-top:40px;max-width:900px">Numarası gerçek gibi, dairesi gerçek gibi. İlk fark eden karşı vekil olur; ikincisi hâkim.</p>
    <div style="position:absolute;right:72px;bottom:72px;color:#E3C275;font-weight:800;font-size:30px">Kaydır →</div>`),
  '02-cozum': sayfa(1080, 1350, 72, `
    ${marka}
    <div class="rozet" style="margin-top:110px">2 / 3 · ÇÖZÜM</div>
    <h1 style="font-size:70px;margin-top:40px">Vekil Pro her künyeyi<br><em>11 milyon kararda arar.</em></h1>
    <div style="margin-top:44px">${denetimKarti()}</div>
    <div style="position:absolute;right:72px;bottom:72px;color:#E3C275;font-weight:800;font-size:30px">Kaydır →</div>`),
  '03-teklif': sayfa(1080, 1350, 72, `
    ${marka}
    <div class="rozet" style="margin-top:110px">3 / 3 · BAŞLA</div>
    <h1 style="font-size:92px;margin-top:40px">10 soru<br><em>ücretsiz.</em></h1>
    <p class="alt" style="font-size:34px;margin-top:36px;max-width:900px">Soru sorun, dilekçe yazdırın, dosyanızı taşıyın. Kart istenmez. iPhone'da ve tarayıcıda.</p>
    <div style="position:absolute;left:72px;right:72px;bottom:72px;display:flex;justify-content:space-between;align-items:center">
      <div class="cta">Ücretsiz dene</div>${appstore}
    </div>`),
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (const [grup, set, w, h] of [['feed', feed, 1080, 1350], ['story', story, 1080, 1920], ['carousel', carousel, 1080, 1350]]) {
  for (const [ad, html] of Object.entries(set)) {
    const tmp = path.join(CIKTI, `.${grup}-${ad}.html`);
    fs.writeFileSync(tmp, html);
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`file://${tmp}`);
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(CIKTI, `${grup}-${ad}.png`);
    await page.screenshot({ path: out, type: 'png' });
    fs.unlinkSync(tmp);
    console.log(`${grup}-${ad}.png ${w}×${h} ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
}
await b.close();
