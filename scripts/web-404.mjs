// GITHUB PAGES İÇİN SPA GERİ DÜŞÜŞÜ.
//
// BULUNAN HATA (canlıda ölçüldü, 12.09.2026):
//   https://vekilpro.app/app/                 → 200
//   https://vekilpro.app/app/forgot-password  → 404
//
// Uygulama tek sayfalık (SPA) dışa aktarılıyor: yalnız index.html var, yollar
// tarayıcıda çözülüyor. GitHub Pages statik sunucu olduğu için böyle bir dosya
// bulamıyor.
//
// NEDEN ÖNEMLİ, ÜSTELİK TAM BU AKIŞTA. Kullanıcı "Şifremi unuttum"a
// tıkladığında adres çubuğu /app/forgot-password oluyor (ölçüldü). Kod
// ekranındayken sayfayı YENİLERSE — e-postaya bakmak için sekme değiştiren
// biri bunu sık yapar — 404 alıyor, akışın başına dönüyor, elindeki kod çöp
// oluyor ve yeni kod için gönderim sınırını bekliyor.
//
// ── İLK DENEMEM YANLIŞTI, KAYDA GEÇİYOR ──────────────────────────────────
// Önce docs/app/404.html ürettim. GitHub Pages 404.html'i YALNIZ YAYIN
// KÖKÜNDEN okur; alt klasördeki dosya hiç bakılmadan geçilir. Daha kötüsü,
// doğrulama için yazdığım taklit sunucu alt klasördeki 404'ü sunuyordu —
// yani sınavı ben yazdım, ben geçtim ve "doğrulandı" dedim. Canlıda
// GitHub'ın kendi hata sayfası çıktı. Taklit sunucu artık Pages'in gerçek
// davranışını uyguluyor (scripts/site-404-sina.mjs).
//
// ── ŞİMDİKİ ÇÖZÜM ────────────────────────────────────────────────────────
// İki parça:
//
// 1) docs/404.html — KÖKTE. Küçük bir sayfa. Yol /app/ ile başlıyorsa yolu
//    sessionStorage'a yazıp /app/ adresine gider. Başlamıyorsa (ör.
//    /rastgele) uygulamayı hiç yüklemez, düzgün bir "sayfa bulunamadı"
//    gösterir. Uygulamanın index.html'ini olduğu gibi köke kopyalamak da
//    işe yarardı ama o zaman tanıtım sitesindeki HER yanlış adres
//    uygulamayı açardı; bu, hata sayfası olmayan bir site demek.
//
// 2) docs/app/index.html'e KÜÇÜK BİR GERİ YÜKLEME BETİĞİ enjekte edilir.
//    Uygulama paketi yüklenmeden ÖNCE çalışır, saklanan yolu okur ve
//    history.replaceState ile adresi geri koyar. Böylece expo-router
//    açıldığında adres zaten /app/forgot-password olur ve doğru ekranı
//    açar. Betik paketten önce gelmeli; yoksa router kökü okur ve ana
//    ekranı açar.
//
// KULLANIM: npm run export:web bunu kendiliğinden çağırır.

import { readFile, writeFile, stat, rm } from 'node:fs/promises';

const UYG_INDEX = 'docs/app/index.html';
const KOK_404 = 'docs/404.html';
const ESKI_404 = 'docs/app/404.html'; // ilk denememden kalan, işe yaramayan dosya

const IM = 'vekilpro_derin_yol';

// Enjekte edilen geri yükleme betiği. İki kez eklenmesin diye işaretli.
const ISARET = 'vekil-derin-yol-geri-yukle';
const GERI_YUKLE = `<script id="${ISARET}">
// 404.html'in sakladığı derin yolu, uygulama paketi yüklenmeden ÖNCE geri
// koyar. Sıra önemli: router adresi okuduğunda doğru yol yerinde olmalı.
(function () {
  try {
    var y = sessionStorage.getItem(${JSON.stringify(IM)});
    if (!y) return;
    sessionStorage.removeItem(${JSON.stringify(IM)});
    // Yalnız kendi sitemizin /app/ altındaki yolları kabul edilir; dışarıdan
    // gelen bir değerle adres çubuğunu oynatmayız.
    if (y.charAt(0) !== '/' || y.indexOf('/app/') !== 0 || y.indexOf('//') === 0) return;
    history.replaceState(null, '', y);
  } catch (e) {}
})();
</script>`;

const KOK_GOVDE = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sayfa bulunamadı — Vekil Pro</title>
<meta name="robots" content="noindex">
<script>
// UYGULAMA YOLLARI: adres /app/ ile başlıyorsa bu bir hata değil, SPA'nın
// derin bağlantısıdır. Yolu saklayıp uygulamanın köküne gidiyoruz; uygulama
// açılmadan önce çalışan küçük bir betik adresi geri koyuyor.
(function () {
  var y = location.pathname + location.search + location.hash;
  if (location.pathname.indexOf('/app/') === 0) {
    try { sessionStorage.setItem(${JSON.stringify(IM)}, y); } catch (e) {}
    location.replace('/app/');
  }
})();
</script>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    background:#F4F7FC;color:#0E1B33;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
  @media (prefers-color-scheme: dark){ body{background:#070E1B;color:#EAF0FB} }
  .k{max-width:440px;text-align:center}
  h1{font-size:22px;margin:0 0 10px}
  p{margin:0 0 22px;line-height:1.6;opacity:.75;font-size:15px}
  a{display:inline-block;margin:0 6px;padding:11px 20px;border-radius:11px;
    text-decoration:none;font-weight:700;font-size:15px;background:#173C7E;color:#fff}
  a.ikincil{background:transparent;color:inherit;border:1px solid rgba(127,127,127,.35)}
</style>
</head>
<body>
  <div class="k">
    <h1>Bu sayfayı bulamadık</h1>
    <p>Adres değişmiş ya da yanlış yazılmış olabilir.</p>
    <a href="/">Ana sayfa</a>
    <a class="ikincil" href="/app/">Uygulamayı aç</a>
  </div>
</body>
</html>
`;

// 1) Kökteki 404.
await writeFile(KOK_404, KOK_GOVDE, 'utf8');

// 2) İlk denememden kalan işe yaramaz dosyayı temizle.
await rm(ESKI_404, { force: true });

// 3) Uygulamanın index.html'ine geri yükleme betiğini enjekte et.
let html;
try {
  html = await readFile(UYG_INDEX, 'utf8');
} catch {
  console.error(`${UYG_INDEX} yok — önce "expo export" çalışmalı.`);
  process.exit(1);
}

if (!html.includes(ISARET)) {
  // Paket betiğinden ÖNCE olmalı. </head> güvenli bir yer: bütün <script
  // src> etiketleri gövdenin sonunda ya da head'in daha altında duruyor
  // olsa bile, buradan sonra gelen her şey bundan sonra çalışır.
  if (!html.includes('</head>')) {
    console.error('DOĞRULAMA BAŞARISIZ: index.html içinde </head> yok.');
    process.exit(1);
  }
  html = html.replace('</head>', GERI_YUKLE + '\n</head>');
  await writeFile(UYG_INDEX, html, 'utf8');
}

// 4) Doğrulama — dosyalar gerçekten beklendiği gibi mi.
const k = await stat(KOK_404);
const kicerik = await readFile(KOK_404, 'utf8');
const uicerik = await readFile(UYG_INDEX, 'utf8');

const sorunlar = [];
if (k.size < 500) sorunlar.push('docs/404.html beklenenden küçük');
if (!kicerik.includes("indexOf('/app/') === 0")) sorunlar.push('404.html uygulama yolu yönlendirmesi içermiyor');
if (!uicerik.includes(ISARET)) sorunlar.push('index.html geri yükleme betiğini içermiyor');
// Betik, paket betiğinden ÖNCE mi?
const iBetik = uicerik.indexOf(ISARET);
const iPaket = uicerik.indexOf('/app/_expo/static/js/web/');
if (iPaket !== -1 && iBetik > iPaket) sorunlar.push('geri yükleme betiği uygulama paketinden SONRA duruyor');

if (sorunlar.length) {
  console.error('DOĞRULAMA BAŞARISIZ:\n  - ' + sorunlar.join('\n  - '));
  process.exit(1);
}

console.log(`${KOK_404} yazıldı — ${k.size} bayt.`);
console.log(`${UYG_INDEX} içine geri yükleme betiği enjekte edildi (paketten önce).`);
