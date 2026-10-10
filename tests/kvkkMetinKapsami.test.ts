import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_KAPSAM_DISI, ALICILAR, KVKK_SURUM, RIZA_ZORUNLU } from '../src/config/kvkk';

/**
 * AYDINLATMA METNİ, KODUN GERÇEKTE YAPTIĞI ŞEYİN HEPSİNİ SÖYLÜYOR MU?
 * (10.10.2026 denetimi, ajan 27 — hiçbiri kullanıcı bildirimi değil.)
 *
 * tests/webMetinTutarlilik.test.ts yalnız bilinen kalıpları denetliyordu
 * (rıza bayrağı, SecureStore, TC no). Aşağıdakiler denetimde KOD OKUNARAK
 * bulundu ve metinde yoktu:
 *
 *  1) Kayıt kaynağı (platform + utm + yönlendiren alan adı) hesabın üstverisine
 *     yazılıyor (src/store/authStore.ts, src/lib/kullanim.ts) — veri kategorisi
 *     olarak sayılmıyordu.
 *  2) Bildirim adresi (Expo push token) kaydediliyor (src/lib/notifications.ts)
 *     ve Expo'nun servisine gidiyor (0161) — ne kategori ne alıcı olarak vardı.
 *  3) Doğrulama / şifre sıfırlama e-postaları Resend üzerinden gidiyor
 *     (scripts/auth-smtp.mjs) — alıcı olarak yoktu.
 *  4) Yapay zekâ sorusu / içtihat arama ifadesi Bedesten'e (Adalet Bakanlığı)
 *     arama terimi olarak gidiyor (supabase/functions/_shared/uyapCanli.ts,
 *     ictihat/index.ts) — alıcı olarak yoktu.
 *  5) Duruşma Brifi, kullanıcının yazmadığı dava alanlarını (mahkeme, tür,
 *     konu, taraf adları) isteğe uygulama tarafından ekleyerek yapay zekâya
 *     gönderiyor (src/utils/briefEngine.ts) — "yalnız sizin girdiğiniz metin
 *     gönderilir" cümlesi bunu kapsamıyordu.
 *  6) app/privacy.tsx hâlâ "mesajlaşma, Tevkil ilanları"ndan söz ediyordu;
 *     o özellikler 26.09.2026'da kapatıldı (0158), ekran rotası yok.
 *  7) KvkkMetin.tsx "oturum bilgilerinin cihazda şifreli alanda saklanması"
 *     diyordu; kod oturumu AsyncStorage'a yazıyor (privacy.tsx bunu zaten
 *     açıkça söylüyor).
 *  8) KVKK_SURUM, metin özde değiştiği hâlde artırılmamıştı (14.09'dan beri).
 *     Aşağıdaki mühür bunu bir daha unutturmaz.
 *
 * NE YAPMAZ: metnin hukuken yeterli olduğunu söylemez; yalnız "kodun yaptığı
 * şey metinde geçiyor mu" sorusunu yanıtlar.
 */

const KOK = new URL('..', import.meta.url).pathname;
const oku = (...yol: string[]) => readFileSync(join(KOK, ...yol), 'utf8');
const govde = (ham: string) => ham.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');

const kvkkMetin = govde(oku('src', 'components', 'KvkkMetin.tsx'));
const gizlilikEkrani = govde(oku('app', 'privacy.tsx'));
const guvenlikSayfasi = govde(oku('docs', 'guvenlik.html'));
const alicilar = ALICILAR.map((a) => a.ad).join(' | ');

describe('aydınlatma metni kapsamı', () => {
  it('kayıt kaynağı hesapla ilişkilendirildiği için veri kategorisi olarak sayılıyor', () => {
    expect(oku('src', 'store', 'authStore.ts')).toContain('kayit_kaynagi: kayitKaynagi()');
    expect(kvkkMetin).toMatch(/Kayıt kaynağı:/);
    expect(kvkkMetin).toMatch(/Registration source:/);
    expect(gizlilikEkrani).toMatch(/Kayıt kaynağı:/);
    expect(gizlilikEkrani).toMatch(/Registration source:/);
  });

  it('bildirim adresi (push token) hem kategori hem alıcı olarak geçiyor', () => {
    expect(oku('src', 'lib', 'notifications.ts')).toContain("'push_cihaz_kaydet'");
    expect(kvkkMetin).toMatch(/Bildirim adresi/);
    expect(kvkkMetin).toMatch(/Notification address/);
    expect(gizlilikEkrani).toMatch(/Bildirim adresi/);
    expect(gizlilikEkrani).toMatch(/Notification address/);
    expect(alicilar).toMatch(/Expo/);
    expect(guvenlikSayfasi).toMatch(/Expo/);
  });

  it('e-posta sağlayıcısı (Resend) alıcı olarak sayılıyor', () => {
    // auth-smtp.mjs depoda olduğu sürece Supabase Auth e-postaları Resend'den
    // gidebilir; bu betik/iş akışı kaldırılırsa bu beklenti de gevşetilmeli.
    expect(existsSync(join(KOK, 'scripts', 'auth-smtp.mjs'))).toBe(true);
    expect(alicilar).toMatch(/Resend/);
    expect(guvenlikSayfasi).toMatch(/Resend/);
  });

  it('içtihat arama ifadesinin gittiği Bedesten alıcı olarak sayılıyor', () => {
    const uc = oku('supabase', 'functions', '_shared', 'uyapCanli.ts');
    expect(uc).toContain('bedesten.adalet.gov.tr');
    expect(oku('supabase', 'functions', 'ai-chat', 'index.ts')).toContain('canliIctihat(');
    expect(alicilar).toMatch(/Bedesten/);
    expect(guvenlikSayfasi).toMatch(/Bedesten/);
  });

  it('Turnstile (Cloudflare) anahtarı derlemeye girerse alıcı olarak eklenmek zorunda', () => {
    // 04.10.2026'da anahtar derlemede yoktu (KARAR-DEFTERI): Captcha bileşeni
    // çizilmiyor, Cloudflare'a istek gitmiyor. Anahtar eas.json ya da bir iş
    // akışına girdiği an bu test, Cloudflare'ın listede olmasını ister.
    const adaylar = [
      oku('eas.json'),
      ...['ios-dagit.yml', 'android-dagit.yml', 'ota-yayinla.yml'].map((f) => oku('.github', 'workflows', f)),
    ].map(govde);
    const anahtarVar = adaylar.some((m) => /TURNSTILE_SITE_KEY/.test(m));
    if (anahtarVar) expect(alicilar).toMatch(/Cloudflare/);
    else expect(anahtarVar).toBe(false);
  });

  it('Duruşma Brifi\'nin dava alanlarını kendiliğinden eklediği söyleniyor', () => {
    const brif = oku('src', 'utils', 'briefEngine.ts');
    expect(brif).toMatch(/invoke\('ai-chat'/);
    expect(brif).toMatch(/c\.opposing_party/);
    for (const [ad, metin] of Object.entries({
      'app/privacy.tsx': gizlilikEkrani,
      'docs/guvenlik.html': guvenlikSayfasi,
    })) {
      expect(/Duruşma Brif/i.test(metin), `${ad}: Brif dava alanlarını kendisi ekliyor ama metin söylemiyor`).toBe(true);
    }
    // KvkkMetin istisnayı kvkk.ts'teki sabitlerden alıyor (TR + EN).
    expect(kvkkMetin).toContain('BRIF_ISTISNASI_TR');
    expect(kvkkMetin).toContain('BRIF_ISTISNASI_EN');
    expect(oku('src', 'config', 'kvkk.ts')).toMatch(/İSTİSNA — DURUŞMA BRİFİ/);
    expect(AI_KAPSAM_DISI.join(' ')).toMatch(/Duruşma Brif/);
  });

  it('kapalı Tevkil/mesajlaşma özelliği gizlilik ekranında paylaşım diye anlatılmıyor', () => {
    if (existsSync(join(KOK, 'app', 'tevkil.tsx'))) return; // pano geri açılırsa metin yeniden yazılır
    expect(/Tevkil|mesajlaşma|job board|messages,/i.test(gizlilikEkrani)).toBe(false);
  });

  it('KvkkMetin oturum anahtarı için olmayan şifreli alan iddia etmiyor', () => {
    expect(oku('src', 'lib', 'supabase.ts')).toContain('storage: AsyncStorage');
    expect(/Oturum bilgilerinin cihazda şifreli alanda/i.test(kvkkMetin)).toBe(false);
    expect(/Encrypted session storage on device/i.test(kvkkMetin)).toBe(false);
  });

  it('alıcı listesi / kapsam dışı listesi değişirse KVKK_SURUM da değişmek zorunda (mühür)', () => {
    // Sürüm, rızası olan HERKESE "metin güncellendi" notu gösterir
    // (KvkkRizaKarti). Alıcı grubu eklenmesi gibi ÖZDE değişikliklerde artırılır;
    // yazım düzeltmesinde artırılmaz — bu yüzden mühür yalnız bu iki listeyi
    // ve rıza bayrağını kapsar. Bu test düştüyse: (1) sürümü artır,
    // (2) aşağıdaki iki değeri yeni duruma getir.
    const ozet = createHash('sha256')
      .update(JSON.stringify({ ALICILAR, AI_KAPSAM_DISI, RIZA_ZORUNLU }))
      .digest('hex')
      .slice(0, 12);
    expect({ surum: KVKK_SURUM, ozet }).toEqual({ surum: '2026-10-1', ozet: '4d0d8f95dce6' });
  });
});
