// ANASAYFADAKİ CANLI DENETİMİ DERLER.
//
// NE YAPAR. supabase/functions/_shared/kararAtif.ts dosyasını tarayıcıda
// çalışan tek bir JS dosyasına çevirir (docs/denetim.js).
//
// NEDEN KOPYALAMIYORUZ. Aynı mantığı elle bir kez daha yazmak, iki sürümün
// zamanla birbirinden ayrılması demektir: sunucu bir atfı "olamaz" sayarken
// site "sorun yok" der ve anasayfa ürün hakkında YALAN söylemeye başlar.
// Burada tek kaynak var; site, sunucunun çalıştırdığı kodun ta kendisini
// çalıştırıyor. Site "bu gerçekten çalışıyor" diyorsa, kanıtı budur.
//
// NE DERLENMEZ. Havuz sorgusu (bir atfın veritabanımızda bulunup bulunmadığı)
// tarayıcıya inmez — o, sunucudaki 14 bin kararlık veriyi gerektirir.
// Anasayfadaki demo bu yüzden YALNIZ havuzdan bağımsız olanaksızlık
// denetimini yapar ve ekranda bunu açıkça yazar.
//
// KULLANIM: node scripts/site-denetim-derle.mjs

import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const KAYNAK = 'supabase/functions/_shared/kararAtif.ts';
const HEDEF = 'docs/denetim.js';

const sonuc = await build({
  entryPoints: [KAYNAK],
  outfile: HEDEF,
  bundle: true,
  minify: true,
  format: 'iife',
  // window.VekilDenetim.kararAtiflari(...) / .tutarsizKararlar(...)
  globalName: 'VekilDenetim',
  target: ['es2019'],
  banner: {
    js: '/* Bu dosya ELLE YAZILMAZ. Kaynak: ' + KAYNAK +
        ' — üretici: scripts/site-denetim-derle.mjs */',
  },
  logLevel: 'warning',
});

if (sonuc.errors.length) process.exit(1);

const boyut = (await readFile(HEDEF)).length;
console.log(`${HEDEF} yazıldı — ${boyut} bayt (kaynak: ${KAYNAK})`);

// DOĞRULAMA: dosyanın gerçekten çalıştığını burada sınıyoruz. "esbuild hata
// vermedi" ile "tarayıcıda çalışıyor" aynı şey değil; globalName yanlışsa ya
// da hedef sürüm bir sözdizimini düşürürse bunu ancak burada yakalarız.
const kod = await readFile(HEDEF, 'utf8');
// Paket `var VekilDenetim = ...` üretiyor; `var` işlev kapsamında kalır, bu
// yüzden sahte bir global nesneye yazılmasını beklemek yerine değeri
// doğrudan döndürtüyoruz. (Tarayıcıda dosya en üst kapsamda çalıştığı için
// orada gerçekten window'a yazılır.)
const D = new Function(`${kod}\nreturn VekilDenetim;`)();
if (!D?.kararAtiflari || !D?.tutarsizKararlar) {
  console.error('DOĞRULAMA BAŞARISIZ: beklenen işlevler dışa aktarılmamış.');
  process.exit(1);
}
const a = D.kararAtiflari('Yargıtay 9. HD 2021/4412 E., 2019/1180 K.');
const t = D.tutarsizKararlar(a, new Date().getFullYear());
if (a.length !== 1 || t.length !== 1 || t[0].sebep !== 'karar_esastan_once') {
  console.error('DOĞRULAMA BAŞARISIZ: derlenen kod beklenen sonucu vermedi.', { a, t });
  process.exit(1);
}
console.log('Doğrulandı: derlenen dosya, olanaksız atfı sunucudaki kodla aynı sebeple işaretledi.');
