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

// playwright-core, depodaki geliştirme bağımlılığı. Önce 'playwright'
// deneniyordu ama o kurulu değil; betik her koşuda "kurulu değil" deyip
// çıkıyordu — yani paylaşım kartı aylardır elle bile üretilemiyordu.
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core kurulu değil. Kur: npm i -D playwright-core');
  process.exit(1);
}

// TARAYICI YOLU ARANIR, SABİT YAZILMAZ. '/opt/pw-browsers/chromium' diye bir
// dizin yok; gerçek ad sürüm numarası taşıyor (chromium-1194). Sabit yol
// tutmadığı için betik sessizce varsayılana düşüp indirme deniyordu.
const { existsSync, readdirSync } = await import('node:fs');
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

const sayfa = await tarayici.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await sayfa.goto('file://' + join(kok, 'docs/og.html'), { waitUntil: 'load' });
// Yazı tipleri ağdan geliyor; boyanmadan çekersek kart bozuk çıkar.
await sayfa.waitForTimeout(1500);
const hedef = join(kok, 'docs/paylasim.png');
await sayfa.screenshot({ path: hedef });
await tarayici.close();
console.log('yazıldı:', hedef);
