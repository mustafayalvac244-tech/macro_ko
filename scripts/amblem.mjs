// VEKİL PRO AMBLEMİ — TEK KAYNAK.
//
// NEDEN BU DOSYA VAR. Amblem üç ayrı yerde ayrı ayrı çiziliyordu ve üçü de
// birbirinden farklıydı: tanıtım sayfasında Playfair fontuyla yazılmış düz
// bir "V" kutusu, uygulamada terazi (src/components/ui/VekilLogo.tsx),
// mağaza ikonlarında üçüncü bir şey. Kullanıcı farkı gördü.
//
// AMBLEM: "TEKNOLOJİK TERAZİ". Uygulamanın açılış/giriş ekranındaki logo.
// Geometri VekilLogo.tsx ile BİREBİR AYNI olmak zorunda — burası web,
// favicon ve mağaza ikonlarını üretiyor; ikisi ayrışırsa marka yine ikiye
// bölünür. Bir tarafı değiştiren diğerini de değiştirmeli.
//
// RENK PARAMETRE — SABİT DEĞİL. Uygulamadaki sürümde çizgi rengi lacivert
// SABİTTİ ve koyu temada zeminle aynı renge düşüp kayboluyordu. Burada
// çizgi rengi dışarıdan veriliyor: açık zeminde lacivert, koyu zeminde
// açık ton. Şekil aynı, yalnız görünürlük korunuyor.

export const LACIVERT = '#1C3A5E';
export const LACIVERT_KOYU = '#0B1F45';
export const LACIVERT_ORTA = '#173C7E';
export const ALTIN = '#C6A24A';
export const ALTIN_ACIK = '#E3C275';

/**
 * Terazinin kendisi — 512×512 kutusuna göre, VekilLogo.tsx ile aynı.
 *
 * @param cizgi  Ana çizgi rengi (koyu zeminde açık bir ton verin).
 * @param altin  Vurgu rengi.
 * @param dugum  Halka içlerinin dolgusu — arkadaki yüzeyle aynı olmalı.
 */
export function terazi(cizgi = LACIVERT, altin = ALTIN, dugum = '#FFFFFF') {
  return `
  <path d="M110 300 A46 46 0 0 0 202 300 Z" fill="${altin}"/>
  <path d="M310 300 A46 46 0 0 0 402 300 Z" fill="${altin}"/>
  <g fill="none" stroke="${cizgi}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
    <line x1="140" y1="150" x2="372" y2="150"/>
    <line x1="256" y1="168" x2="256" y2="402"/>
    <line x1="156" y1="156" x2="110" y2="300"/>
    <line x1="156" y1="156" x2="202" y2="300"/>
    <line x1="356" y1="156" x2="310" y2="300"/>
    <line x1="356" y1="156" x2="402" y2="300"/>
    <line x1="110" y1="300" x2="202" y2="300"/>
    <line x1="310" y1="300" x2="402" y2="300"/>
    <line x1="196" y1="436" x2="316" y2="436"/>
    <path d="M226 182 L226 206 L286 206 L286 182"/>
  </g>
  <path d="M238 402 L274 402 L292 436 L220 436 Z" fill="${cizgi}"/>
  <circle cx="256" cy="86" r="17" fill="none" stroke="${cizgi}" stroke-width="13"/>
  <circle cx="256" cy="86" r="6" fill="${altin}"/>
  <circle cx="256" cy="150" r="18" fill="${dugum}" stroke="${cizgi}" stroke-width="13"/>
  <circle cx="256" cy="150" r="6" fill="${altin}"/>
  <circle cx="140" cy="150" r="17" fill="${dugum}" stroke="${cizgi}" stroke-width="13"/>
  <circle cx="140" cy="150" r="6" fill="${altin}"/>
  <circle cx="372" cy="150" r="17" fill="${dugum}" stroke="${cizgi}" stroke-width="13"/>
  <circle cx="372" cy="150" r="6" fill="${altin}"/>
  <line x1="256" y1="103" x2="256" y2="132" stroke="${cizgi}" stroke-width="13" stroke-linecap="round"/>
  <rect x="222" y="238" width="14" height="14" rx="2" fill="${altin}"/>
  <rect x="276" y="238" width="14" height="14" rx="2" fill="${altin}"/>`;
}

/**
 * Yuvarlak köşeli lacivert kutu içinde amblem — başlık, favicon, mağaza ikonu.
 * Kutu koyu olduğu için çizgi AÇIK tonda veriliyor; sabit lacivert kalsaydı
 * şekil zeminle aynı renge düşerdi.
 */
export function kutulu({ boyut = 64, radius = 96, gradyanId = 'vg', kenar = 52 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 512 512" role="img" aria-label="Vekil Pro">
  <defs><linearGradient id="${gradyanId}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${LACIVERT_ORTA}"/><stop offset="1" stop-color="${LACIVERT_KOYU}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#${gradyanId})"/>
  <g transform="translate(256 256) scale(${(512 - kenar * 2) / 512}) translate(-256 -256)">
    ${terazi('#F0F4FC', ALTIN_ACIK, LACIVERT_KOYU)}
  </g>
</svg>`;
}

/** Kutusuz, saydam zeminli — Android uyarlanabilir ikonun ön katmanı. */
export function sade({ boyut = 512, cizgi = '#F0F4FC', altin = ALTIN_ACIK, dugum = 'none', olcek = 1 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 512 512" role="img" aria-label="Vekil Pro">
  <g transform="translate(256 256) scale(${olcek}) translate(-256 -256)">
    ${terazi(cizgi, altin, dugum)}
  </g>
</svg>`;
}

/**
 * KÜÇÜK BOY SÜRÜMÜ — yalnız favicon ve 24px altı için.
 *
 * Tam amblem 34px ve üstünde rahat okunuyor (ölçüldü: 20/24/34/48/96/160
 * px'te açık ve koyu zeminde bakıldı). 20px'e inince halka içlerindeki altın
 * noktalar, iki küçük kare ve kirişin altındaki köşeli parça birbirine
 * giriyor ve şekil bulanıklaşıyor.
 *
 * Bu sürüm o ÜÇ ayrıntıyı düşürüp iskeleti bırakıyor: kiriş, direk, iki kefe,
 * taban ve tepe halkası. Şekil aynı şey olarak okunuyor, yalnız gürültü yok.
 * Çizgiler de kalınlaştırılıyor — küçük boyda ince çizgi piksele oturmaz.
 *
 * Bu, markanın ikiye ayrılması DEĞİLDİR: köklü markaların çoğu faviconda
 * sadeleştirilmiş sürüm kullanır. Tam amblem her yerde, bu yalnız en küçük
 * yerde.
 */
export function kucuk({ boyut = 64, gradyanId = 'vk', cizgi = '#F0F4FC', altin = ALTIN_ACIK } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 512 512" role="img" aria-label="Vekil Pro">
  <defs><linearGradient id="${gradyanId}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${LACIVERT_ORTA}"/><stop offset="1" stop-color="${LACIVERT_KOYU}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="96" fill="url(#${gradyanId})"/>
  <g transform="translate(256 256) scale(0.82) translate(-256 -256)">
    <path d="M110 300 A46 46 0 0 0 202 300 Z" fill="${altin}"/>
    <path d="M310 300 A46 46 0 0 0 402 300 Z" fill="${altin}"/>
    <g fill="none" stroke="${cizgi}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
      <line x1="140" y1="150" x2="372" y2="150"/>
      <line x1="256" y1="150" x2="256" y2="402"/>
      <line x1="152" y1="158" x2="110" y2="300"/>
      <line x1="152" y1="158" x2="202" y2="300"/>
      <line x1="360" y1="158" x2="310" y2="300"/>
      <line x1="360" y1="158" x2="402" y2="300"/>
      <line x1="110" y1="300" x2="202" y2="300"/>
      <line x1="310" y1="300" x2="402" y2="300"/>
      <line x1="196" y1="436" x2="316" y2="436"/>
    </g>
    <path d="M238 402 L274 402 L292 436 L220 436 Z" fill="${cizgi}"/>
    <circle cx="256" cy="104" r="26" fill="${altin}"/>
  </g>
</svg>`;
}
