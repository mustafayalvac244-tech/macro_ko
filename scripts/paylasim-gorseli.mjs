// PAYLAŞIM GÖRSELİ ÜRETİMİ — docs/og.html → docs/paylasim.png (1200×630).
//
// NEDEN VAR. Tanıtım sayfası WhatsApp'ta ya da X'te paylaşıldığında hiçbir
// önizleme çıkmıyordu: bağlantı çıplak metin olarak gidiyordu ve kimse
// tıklamıyordu. og:image olmadan paylaşım kartı oluşmuyor.
//
// Görsel elle çizilmiş bir PNG değil, docs/og.html'in ekran görüntüsü: metni
// değiştirmek isteyen o HTML'i düzenleyip bu betiği yeniden koşturur, böylece
// görselle sayfa birbirinden ayrı düşmez.
//
// KULLANIM: node scripts/paylasim-gorseli.mjs
// Playwright kuruluysa çalışır; kurulu değilse ne yapılacağını söyler ve
// SESSİZCE BAŞARILI DÖNMEZ (eski görselle devam ettiğimizi sanmayalım).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright kurulu değil. Kur: npm i -D playwright');
  process.exit(1);
}

// Bu depoda tarayıcı önceden kurulu geliyor; yolu belirtmek indirme denemesini
// engelliyor. Yoksa varsayılan çözümlemeye düşülür.
const yol = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const { existsSync } = await import('node:fs');
const tarayici = await chromium.launch(existsSync(yol) ? { executablePath: yol } : {});

const sayfa = await tarayici.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await sayfa.goto('file://' + join(kok, 'docs/og.html'), { waitUntil: 'load' });
// Yazı tipleri ağdan geliyor; boyanmadan çekersek kart bozuk çıkar.
await sayfa.waitForTimeout(1500);
const hedef = join(kok, 'docs/paylasim.png');
await sayfa.screenshot({ path: hedef });
await tarayici.close();
console.log('yazıldı:', hedef);
