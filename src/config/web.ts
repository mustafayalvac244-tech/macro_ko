// WEB SÜRÜMÜNÜN ADRESİ VE ERİŞİM KURALI — tek yerden.
// ---------------------------------------------------------------------------
// NEDEN TEK DOSYA. Adres üç yerde birden geçiyor: uygulamadaki tanıtım kartı,
// web'de üyelik kapısının metni ve derleme yolu (app.json → experiments.baseUrl).
// Üçü ayrışırsa kullanıcıya çalışmayan bir bağlantı gösteririz.
//
// ADRES HÂLÂ GITHUB PAGES'TE ve kullanıcıya gösterilecek gibi değil:
//     https://mustafayalvac244-tech.github.io/macro_ko/app
//
// ADRESİ DEĞİŞTİRMEK İÇİN ELLE DÜZENLEME YAPMAYIN — üç dosya birden değişmek
// zorunda (burası, app.json → experiments.baseUrl, docs/index.html'deki
// canonical/og:url + sitemap) ve biri unutulursa site sessizce bozulur.
// Tek komut hepsini yazar:
//
//     node scripts/web-adres.mjs https://vekilpro.pages.dev
//     npm run export:web            # ŞART: baseUrl derlemeye gömülüdür
//
// Özel alan adı alındıysa `--cname` ekleyin (GitHub Pages'te kalınıyorsa
// docs/CNAME gerekir; pages.dev / netlify.app gibi barındırmalarda GEREKMEZ
// ve dosya kalırsa karışıklık çıkarır).
//
// ÜCRETSİZ SEÇENEK: vekilpro.pages.dev (Cloudflare Pages) ya da
// vekilpro.netlify.app. Depoda hazır ayar dosyaları var (wrangler.toml /
// netlify.toml), panelde ayar girmek gerekmiyor. Gerçek alan adı (vekilpro.app
// gibi) ÜCRETSİZ DEĞİLDİR — yıllık ücreti vardır.

/** Web sürümünün açık adresi (kullanıcıya gösterilir). */
export const WEB_ADRESI = 'https://mustafayalvac244-tech.github.io/macro_ko/app';

/** Kullanıcıya gösterilecek kısa hâli — "https://" ve son eğik çizgi olmadan. */
export const WEB_ADRESI_KISA = WEB_ADRESI.replace(/^https?:\/\//, '').replace(/\/+$/, '');

/**
 * Web sürümü YALNIZ ÜYELERE açıktır (ürün kararı, 2026-09-11).
 *
 * BU BİR GÜVENLİK SINIRI DEĞİLDİR, ürün kapısıdır. Verinin gerçek koruması
 * sunucudaki RLS politikalarıdır; buradaki kontrol yalnız arayüzü kapatır.
 * İkisini karıştırmamak önemli: bu bayrağı false yapmak hiçbir veriyi
 * açığa çıkarmaz, yalnız web arayüzünü herkese açar.
 *
 * KASITLI OLARAK "AÇIK TARAFA DÜŞER": profil okunamadıysa (ağ hatası,
 * sunucu yavaş) kapı KAPANMAZ. Ödeme yapmış bir avukatı geçici bir ağ
 * hatası yüzünden dışarıda bırakmak, ödememiş birinin arayüzü görmesinden
 * daha pahalıdır.
 */
export const WEB_YALNIZ_UYELERE = true;
