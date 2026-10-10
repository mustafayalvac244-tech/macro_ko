import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';
import { TEKRAR_GONDERIM_SN } from '../src/lib/authBekleme';

/**
 * DOĞRULAMA E-POSTASINI TEKRAR GÖNDER (09.10.2026 denetimi).
 *
 * Üç kusur vardı:
 *  1) Kayıt ekranında geri sayım EKRAN AÇILDIĞI AN başlıyordu (useState(25)),
 *     posta gönderildiğinde değil. Formu doldurmak 25 sn'den uzun sürdüğü için
 *     doğrulama ekranına gelindiğinde düğme hemen basılabiliyordu; basınca
 *     sunucu "güvenlik nedeniyle bekleyin" diyordu.
 *  2) Giriş ekranındaki tekrar gönderme hatası BAŞARI renginde (yeşil)
 *     yazılıyordu ve orada hiç geri sayım yoktu.
 *  3) Kayıttan sonra e-postayı yanlış yazdığını gören kullanıcının formdaki
 *     bilgilerini kaybetmeden adresi düzeltebileceği bir yol yoktu.
 *
 * Ekranlar React Native bileşeni olduğu için (vitest node'da render edemez)
 * bu dosya depodaki diğer ekran testleri gibi kaynağı okur.
 */
const kok = join(__dirname, '..');
const oku = (...p: string[]) => readFileSync(join(kok, ...p), 'utf8');
const kayit = oku('app', '(auth)', 'signup.tsx');
const giris = oku('app', '(auth)', 'login.tsx');

describe('kayıt ekranı — doğrulama postası', () => {
  it('geri sayım ekran açılışında başlamaz (başlangıç 0)', () => {
    const m = /\[tekrarBekleme, setTekrarBekleme\] = useState\(([^)]*)\)/.exec(kayit);
    expect(m, 'tekrarBekleme durumu bulunamadı').not.toBeNull();
    expect(m![1].trim()).toBe('0');
  });

  it('geri sayım posta gönderildiği an (doğrulama ekranına geçerken) başlar', () => {
    const dal = kayit.slice(kayit.indexOf("sonuc === 'dogrulama-gerekli'"), kayit.indexOf('setDogrulamaBekliyor(true)') + 30);
    expect(dal).toMatch(/setTekrarBekleme\(TEKRAR_GONDERIM_SN\)/);
  });

  it('e-postayı düzeltme yolu var: forma, doldurulmuş bilgilerle dönülür', () => {
    expect(kayit).toMatch(/t\('auth\.verifyFixEmail'\)/);
    expect(kayit).toMatch(/setDogrulamaBekliyor\(false\)/);
    expect(tr['auth.verifyFixEmail' as keyof typeof tr]).toBeTruthy();
    expect(en['auth.verifyFixEmail' as keyof typeof en]).toBeTruthy();
  });
});

describe('giriş ekranı — doğrulama postası', () => {
  it('tekrar gönderme hatası başarı mesajı gibi (yeşil) yazılmaz', () => {
    expect(giris).not.toMatch(/setTekrarBilgi\(sonuc\.hata/);
    expect(giris).toMatch(/setTekrarHata\(sonuc\.hata\)/);
    expect(giris).toMatch(/<Text style=\{styles\.error\}>\{tekrarHata\}<\/Text>/);
  });

  it('giriş ekranında da geri sayım var; sunucunun söylediği süre kullanılır', () => {
    expect(giris).toMatch(/t\('auth\.resendVerifyIn'/);
    expect(giris).toMatch(/disabled=\{tekrarBekleme > 0 \|\| tekrarGonderiliyor\}/);
    expect(giris).toMatch(/if \(sonuc\.bekle > 0\) setTekrarBekleme\(sonuc\.bekle\)/);
    expect(giris).toMatch(/setTekrarBekleme\(TEKRAR_GONDERIM_SN\)/);
  });

  it('bekleme süresi tek yerden ve makul', () => {
    expect(TEKRAR_GONDERIM_SN).toBeGreaterThan(0);
    expect(TEKRAR_GONDERIM_SN).toBeLessThanOrEqual(60);
  });
});
