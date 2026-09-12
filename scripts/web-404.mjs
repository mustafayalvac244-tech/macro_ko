// GITHUB PAGES İÇİN SPA GERİ DÜŞÜŞÜ: docs/app/404.html
//
// BULUNAN HATA (ölçüldü, 12.09.2026). Canlı sitede:
//   https://vekilpro.app/app/            → 200
//   https://vekilpro.app/app/forgot-password → 404
//   https://vekilpro.app/app/(auth)/signup   → 404
//
// Uygulama tek sayfalık (SPA) olarak dışa aktarılıyor: yalnız index.html var,
// yollar tarayıcıda çözülüyor. GitHub Pages ise statik dosya sunucusu —
// /app/forgot-password diye bir dosya olmadığı için 404 döndürüyor.
//
// NEDEN ÖNEMLİ, ÜSTELİK TAM BU AKIŞTA. Kullanıcı "Şifremi unuttum"a
// tıkladığında adres çubuğu /app/forgot-password oluyor (ölçüldü). Kod
// ekranındayken sayfayı YENİLERSE — ki e-postaya bakmak için sekme
// değiştiren biri bunu sık yapar — 404 alıyor ve akışın başına dönüyor.
// Elindeki kod çöpe gidiyor, yeni kod istemek için de gönderim sınırını
// bekliyor. Aynı şey, adresi biriyle paylaşan ya da yer imi koyan için de
// geçerli.
//
// ÇÖZÜM. GitHub Pages, bulunamayan bir yolda deponun 404.html dosyasını
// sunar. index.html'in aynısını 404.html olarak koyuyoruz: sunucu 404 kodu
// döndürse de tarayıcıya uygulamanın kendisi iniyor, uygulama adresi okuyup
// doğru ekranı açıyor. Varlık yolları mutlak (/app/...) olduğu için derin
// yollarda da doğru çözülüyor.
//
// KULLANIM: npm run export:web bunu kendiliğinden çağırır.

import { copyFile, stat } from 'node:fs/promises';

const KAYNAK = 'docs/app/index.html';
const HEDEF = 'docs/app/404.html';

try {
  await stat(KAYNAK);
} catch {
  console.error(`${KAYNAK} yok — önce "expo export" çalışmalı.`);
  process.exit(1);
}

await copyFile(KAYNAK, HEDEF);

// Doğrulama: kopya gerçekten uygulamayı yükleyecek mi? Boş ya da yarım bir
// dosya sessizce kopyalanırsa 404 sayfası bembeyaz kalır ve kimse fark etmez.
const { size } = await stat(HEDEF);
const icerik = await (await import('node:fs/promises')).readFile(HEDEF, 'utf8');
if (size < 1000 || !icerik.includes('/app/_expo/static/js/web/')) {
  console.error('DOĞRULAMA BAŞARISIZ: 404.html uygulama betiğini içermiyor.');
  process.exit(1);
}
console.log(`${HEDEF} yazıldı — ${size} bayt, uygulama betiği içeride.`);
