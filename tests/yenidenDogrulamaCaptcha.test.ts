import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// ŞİFREYLE YENİDEN DOĞRULAMA + CAPTCHA (09.10.2026).
//
// Hesap silme (app/hesap-sil.tsx) ve şifre değiştirme (app/change-password.tsx)
// kimliği signInWithPassword ile yeniden doğruluyor. GoTrue bu isteği
// captcha'ya tabi tutar: supabase/auth kaynağında
//     r.With(api.verifyCaptcha).Post("/token", api.Token)
// ve verifyCaptcha yalnız pkce / refresh_token / id_token için atlanır,
// `password` için ATLANMAZ (internal/api/api.go + middleware.go, master dalı
// 09.10.2026'da okundu). Jeton yoksa 400 "captcha failed" döner.
//
// Bugün captcha iki tarafta da kapalı (yayındaki web paketinde
// TURNSTILE_SITE_KEY boş; sunucu tarafı MAGAZA.md B2'ye göre açılmadı —
// ÖLÇÜLMEDİ). MAGAZA.md'deki açma sırası izlendiği gün bu iki ekran jetonsuz
// istek atıp "şifre doğrulanamadı" der ve hesap SİLİNEMEZ olurdu (Apple
// 5.1.1(v) hesap silmeyi zorunlu tutuyor). Bu test, signInWithPassword çağıran
// HER yerin captcha jetonu taşımasını ister.

const KOK = join(__dirname, '..');

function dosyalar(dizin: string): string[] {
  const sonuc: string[] = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) sonuc.push(...dosyalar(yol));
    else if (/\.(ts|tsx)$/.test(ad)) sonuc.push(yol);
  }
  return sonuc;
}

/** `ad(` ile başlayan çağrının parantez içini (iç içe parantezler dahil) verir. */
function cagriGovdeleri(metin: string, ad: string): string[] {
  const govdeler: string[] = [];
  let i = metin.indexOf(`${ad}(`);
  while (i !== -1) {
    const bas = i + ad.length + 1;
    let derinlik = 1;
    let j = bas;
    for (; j < metin.length && derinlik > 0; j++) {
      if (metin[j] === '(') derinlik++;
      else if (metin[j] === ')') derinlik--;
    }
    govdeler.push(metin.slice(bas, j - 1));
    i = metin.indexOf(`${ad}(`, j);
  }
  return govdeler;
}

const cagrilar = [...dosyalar(join(KOK, 'app')), ...dosyalar(join(KOK, 'src'))]
  .map((yol) => ({ yol: relative(KOK, yol), metin: readFileSync(yol, 'utf8') }))
  .filter((d) => d.metin.includes('signInWithPassword('));

describe('şifreyle doğrulayan her istek captcha jetonu taşır', () => {
  it('çağrı yerleri bulundu (giriş + hesap silme + şifre değiştirme)', () => {
    const yollar = cagrilar.map((c) => c.yol).sort();
    expect(yollar).toEqual(['app/change-password.tsx', 'app/hesap-sil.tsx', 'src/store/authStore.ts']);
  });

  for (const { yol, metin } of cagrilar) {
    it(`${yol}: signInWithPassword captchaToken gönderiyor`, () => {
      for (const govde of cagriGovdeleri(metin, 'signInWithPassword')) {
        expect(govde, govde).toMatch(/captchaToken/);
      }
    });
  }

  for (const { yol, metin } of cagrilar.filter((c) => c.yol.startsWith('app/'))) {
    it(`${yol}: jetonu üreten Captcha bileşeni ekranda`, () => {
      expect(metin).toContain("from '@/components/Captcha'");
      expect(metin).toMatch(/<Captcha\b/);
    });
  }
});
