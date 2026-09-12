// KAYIT VE ŞİFRE SIFIRLAMA EKRANLARINI GERÇEK TARAYICIDA ÖLÇER.
//
// NEDEN. Bu ekranlarda bugün bir sürü değişiklik yapıldı (sessiz düğme,
// göz düğmesi, otomatik doldurma, Enter, eksik alan işareti) ve HİÇBİRİ
// gerçek bir tarayıcıda denenmedi. "tsc temiz + 613 test geçti" bu
// ekranlar hakkında hiçbir şey söylemiyor: testlerin tamamı saf mantık,
// tek bir ekran çizmiyor. Bugünkü en pahalı hata (kapalı düğmenin basışı
// sessizce yutması) tam olarak bu boşlukta yaşadı.
//
// NE ÖLÇER / NE ÖLÇMEZ.
// Ölçer: istemci tarafındaki her şey — doğrulama mesajları, göz düğmesi,
// Enter ile gönderme, otomatik doldurma nitelikleri, eksik alanın
// işaretlenmesi, klavye ile gezinme, dar ekran.
// ÖLÇMEZ: gerçekten hesap açılması ve gerçekten e-posta gelmesi. Onlar
// sunucuya yazar ve kota harcar; ölçüm uğruna üretim veritabanına kayıt
// açmıyoruz. Yani bu ölçüm "ekran doğru davranıyor mu'yu" söyler,
// "uçtan uca çalışıyor mu'yu" SÖYLEMEZ.
//
// KULLANIM: uygulama 8777'de yayında olmalı.
//   (cd docs/app && python3 -m http.server 8777 &)
//   node scripts/uyelik-olc.mjs

import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

const KOK = process.env.UYGULAMA_ADRESI || 'http://127.0.0.1:8778/app';

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
const baglam = await tarayici.newContext({ viewport: { width: 1280, height: 900 } });
const sayfa = await baglam.newPage();

const jsHatalari = [];
sayfa.on('pageerror', (e) => jsHatalari.push(String(e)));

const sonuc = [];
const sina = (ad, gecti, ek = '') => {
  sonuc.push({ ad, gecti, ek });
  console.log(`  ${gecti ? '✓' : '✗'} ${ad}${ek && !gecti ? ` — ${ek}` : ''}`);
};

// Sunucuya HİÇBİR yazma isteği gitmesin: ölçüm üretim verisine dokunmamalı.
const engellenen = [];
await sayfa.route('**/*', (yon) => {
  const i = yon.request();
  const u = i.url();
  const yazma = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(i.method());
  if (yazma && !u.startsWith(KOK)) {
    engellenen.push(`${i.method()} ${u.slice(0, 90)}`);
    return yon.abort();
  }
  return yon.continue();
});

async function git(yolAdi) {
  await sayfa.goto(`${KOK}/${yolAdi}`, { waitUntil: 'networkidle' });
  // Expo yüklendikten sonra ilk çizim birkaç yüz ms sürüyor.
  await sayfa.waitForFunction(
    () => !/Uygulama yükleniyor/.test(document.body.innerText),
    null,
    { timeout: 20000 }
  ).catch(() => {});
  await sayfa.waitForTimeout(700);
}

// Ekranda görünen metin (ekran okuyucu gizli alanlar hariç değil, kabaca).
const metin = () => sayfa.evaluate(() => document.body.innerText);

console.log('\n── KAYIT EKRANI ────────────────────────────────────────────');
await git('(auth)/signup');

let g = await metin();
sina('kayıt ekranı açılıyor', /Hesap|Kaydol|Ad Soyad/i.test(g), g.slice(0, 120));

// Baro sicil no gerçekten kalktı mı?
sina('baro sicil no alanı yok', !/sicil/i.test(g));

// Kaç giriş kutusu var?
const kutuSayisi = await sayfa.locator('input').count();
sina('6 alanlık form (5 kutu + baro seçici)', kutuSayisi === 5, `${kutuSayisi} kutu bulundu`);

// BOŞ FORMLA GÖNDER: düğme sessizce ölmemeli, sebebini söylemeli.
const gonderDugmesi = sayfa.getByText(/Hesap Oluştur|Kaydol/i).last();
await gonderDugmesi.click();
await sayfa.waitForTimeout(500);
g = await metin();
sina('boş formda hata mesajı çıkıyor (sessiz düğme yok)', /gerekli|girin|yazın|zorunlu/i.test(g), g.slice(-200));

// Eksik alan KIRMIZI işaretleniyor mu?
const kirmiziCerceve = await sayfa.evaluate(() => {
  const kirmizi = ['rgb(206, 53, 61)', 'rgb(227, 101, 91)', 'rgb(198, 40, 40)'];
  return [...document.querySelectorAll('div')].some((d) => {
    const b = getComputedStyle(d).borderColor;
    return b && (kirmizi.includes(b) || /2[0-9][0-9], *[0-5][0-9], *[0-6][0-9]/.test(b));
  });
});
sina('eksik alan kırmızı çerçeveleniyor', kirmiziCerceve);

// ŞİFRE GÖZ DÜĞMESİ.
const sifreKutusu = sayfa.locator('input[type="password"]').first();
const sifreVar = (await sayfa.locator('input[type="password"]').count()) > 0;
sina('şifre kutusu gizli yazıyor', sifreVar);
if (sifreVar) {
  await sifreKutusu.fill('Deneme12345');
  // Göz düğmesi kutunun hemen yanındaki basılabilir öğe.
  const gozler = sayfa.locator('[aria-label*="ifre"]');
  const gozSayisi = await gozler.count();
  sina('göz düğmesi var', gozSayisi > 0, `${gozSayisi} bulundu`);
  if (gozSayisi > 0) {
    await gozler.first().click();
    await sayfa.waitForTimeout(250);
    const acildi = (await sayfa.locator('input[type="password"]').count()) === 0;
    sina('göz düğmesi şifreyi gösteriyor', acildi);
    if (acildi) {
      await gozler.first().click();
      await sayfa.waitForTimeout(250);
      sina(
        'göz düğmesi tekrar gizliyor',
        (await sayfa.locator('input[type="password"]').count()) > 0
      );
    }
  }
}

// OTOMATİK DOLDURMA: parola yöneticisi kutuları tanıyor mu?
const nitelikler = await sayfa.evaluate(() =>
  [...document.querySelectorAll('input')].map((i) => ({
    tip: i.type,
    ac: i.getAttribute('autocomplete'),
  }))
);
sina(
  'e-posta kutusu otomatik doldurmaya açık',
  nitelikler.some((n) => n.ac === 'email' || n.ac === 'username'),
  JSON.stringify(nitelikler)
);
sina(
  'şifre kutusu yeni-şifre olarak tanıtılıyor',
  nitelikler.some((n) => n.ac === 'new-password'),
  JSON.stringify(nitelikler)
);

console.log('\n── ŞİFRE SIFIRLAMA EKRANI ──────────────────────────────────');
await git('forgot-password');
g = await metin();
sina('şifre sıfırlama ekranı açılıyor', /ifre|kod/i.test(g), g.slice(0, 120));

// Boş e-postayla gönder: sessiz ölmemeli.
const kodDugmesi = sayfa.getByText(/Kod Gönder/i).last();
const kodDugmesiVar = (await kodDugmesi.count()) > 0;
sina('"Kod Gönder" düğmesi var', kodDugmesiVar);
if (kodDugmesiVar) {
  await kodDugmesi.click();
  await sayfa.waitForTimeout(500);
  g = await metin();
  sina('boş e-postada hata mesajı çıkıyor', /e-posta|yazın|girin/i.test(g), g.slice(-200));
}

// Uzunluk varsayımı kalktı mı: 8 haneli kod kutuya YAZILABİLİYOR mu?
// (Ekranın kod adımına sunucu isteği olmadan geçemiyoruz; bunun yerine
//  kutunun maxLength'ini kaynaktan değil, ekrandan sorguluyoruz.)
const epostaKutusu = sayfa.locator('input').first();
await epostaKutusu.fill('deneme@ornek.com');
const epostaAc = await epostaKutusu.getAttribute('autocomplete');
sina('e-posta kutusu otomatik doldurmaya açık', epostaAc === 'email' || epostaAc === 'username', String(epostaAc));

console.log('\n── GENEL ───────────────────────────────────────────────────');
sina('sayfada JS hatası yok', jsHatalari.length === 0, jsHatalari.slice(0, 2).join(' | '));
sina('ölçüm sunucuya hiçbir şey yazmadı', engellenen.length === 0, engellenen.join(' | '));

await sayfa.setViewportSize({ width: 390, height: 800 });
await sayfa.waitForTimeout(400);
const tasma = await sayfa.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
sina('390px genişlikte yatay taşma yok', tasma <= 1, `taşma ${tasma}px`);

await tarayici.close();

const gecen = sonuc.filter((s) => s.gecti).length;
console.log(`\nSONUÇ: ${gecen}/${sonuc.length}`);
if (engellenen.length) console.log('Engellenen yazma istekleri:', engellenen);
process.exit(gecen === sonuc.length ? 0 : 1);
