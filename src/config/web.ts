// WEB SÜRÜMÜNÜN ADRESİ VE ERİŞİM KURALI — tek yerden.
// ---------------------------------------------------------------------------
// NEDEN TEK DOSYA. Adres üç yerde birden geçiyor: uygulamadaki tanıtım kartı,
// web'de üyelik kapısının metni ve derleme yolu (app.json → experiments.baseUrl).
// Üçü ayrışırsa kullanıcıya çalışmayan bir bağlantı gösteririz.
//
// ALAN ADI HENÜZ ALINMADI. Bugünkü yayın GitHub Pages üzerinde ve adres
// kullanıcıya gösterilecek gibi değil:
//     https://mustafayalvac244-tech.github.io/macro_ko/app
// Kendi alan adı alındığında YAPILACAKLAR (üçü birden, yoksa site açılmaz):
//   1. Buradaki WEB_ADRESI yeni adrese çekilir.
//   2. app.json → experiments.baseUrl "/macro_ko/app" yerine "/app" olur
//      (özel alan adında site kökten servis edilir; baseUrl eski kalırsa
//      bütün JS/CSS yolları 404 verir ve sayfa beyaz açılır).
//   3. docs/CNAME dosyasına alan adı yazılır ve DNS'te A/ALIAS kayıtları
//      GitHub Pages'e yönlendirilir. Sonra `npm run export:web` ile yeniden
//      derlenip depoya işlenir.
// Bu üç adım GitHub Pages'te kalmaya devam edildiği varsayımıyla yazıldı.

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
