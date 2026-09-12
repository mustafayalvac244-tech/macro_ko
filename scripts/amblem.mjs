// VEKİL PRO AMBLEMİ — TEK KAYNAK.
//
// NEDEN BU DOSYA VAR. Amblem üç ayrı yerde ayrı ayrı çiziliyordu ve üçü de
// birbirinden farklıydı: tanıtım sayfasında Playfair fontuyla yazılmış düz
// bir "V" kutusu, uygulamada ince çizgili bir terazi (VekilLogo.tsx),
// mağaza ikonlarında ise üçüncü bir şey. Kullanıcı farkı gördü.
//
// ESKİ TERAZİ NEDEN KÜÇÜLTÜLEMİYORDU. 13 birim kalınlığında ~20 ayrı çizgi
// ve 8 daire taşıyordu; 34px'lik başlık ambleminde hepsi birbirine giriyor,
// faviconda tanınmaz hâle geliyordu. Ayrıca çizgi rengi lacivert sabitti —
// koyu temada zeminle aynı renge düşüyordu. Tanıtım sayfasında düz "V"
// kutusu kullanılmasının sebebi buydu.
//
// YENİ AMBLEM. Dört aday çizilip 20/24/34/48/96 px'te, açık ve koyu temada
// gerçek tarayıcıda karşılaştırıldı. Kazanan: "V + onay".
//   • "V" harfi Vekil'in baş harfi.
//   • Sağ kol sol koldan YÜKSEK bitiyor — şekil aynı anda bir onay
//     işaretidir. Ürünün tek iddiası ("verdiğimiz her künye denetlenir")
//     ile amblem aynı şeyi söylüyor.
//   • Altındaki kısa kiriş, terazi tabanını andırır ve şekli yere basar.
// Üç çizgi: 20px'te bile okunur, tek renk olduğu için faviconda, baskıda ve
// tek renkli Android ikonunda da çalışır.
//
// KULLANIM: node scripts/amblem.mjs   → varlıkları üretir (bkz. aşağıda)

export const LACIVERT = '#173C7E';
export const LACIVERT_KOYU = '#0B1F45';
export const ALTIN = '#E7C871';

/**
 * Amblemin kendisi — yalnız çizgiler, kutu YOK.
 * 64×64 kutusuna göre çizilmiştir.
 */
export function isaret(renk = ALTIN, kalinlik = 5.2) {
  return `<g fill="none" stroke="${renk}" stroke-width="${kalinlik}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 17 L29 42 L47 13"/>
</g>
<line x1="21" y1="51" x2="43" y2="51" stroke="${renk}" stroke-width="${kalinlik * 0.77}" stroke-linecap="round"/>`;
}

/** Yuvarlak köşeli kutu içinde amblem — başlık, favicon, mağaza ikonu. */
export function kutulu({ boyut = 64, radius = 15, renk = ALTIN, gradyanId = 'vg' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 64 64" role="img" aria-label="Vekil Pro">
  <defs><linearGradient id="${gradyanId}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${LACIVERT}"/><stop offset="1" stop-color="${LACIVERT_KOYU}"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="${radius}" fill="url(#${gradyanId})"/>
  ${isaret(renk)}
</svg>`;
}

/** Kutusuz, saydam zeminli amblem — Android uyarlanabilir ikonun ön katmanı. */
export function sade({ boyut = 64, renk = ALTIN, olcek = 1 } = {}) {
  const k = 5.2 * olcek;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 64 64" role="img" aria-label="Vekil Pro">
  ${isaret(renk, k)}
</svg>`;
}

// ── Varlık üretimi ────────────────────────────────────────────────────────
// Bu bölüm yalnız doğrudan çalıştırıldığında koşar; import edenler etkilenmez.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir('docs', { recursive: true });
  // Tanıtım sayfası ve favicon için SVG.
  await writeFile('docs/amblem.svg', kutulu({ boyut: 64 }), 'utf8');
  console.log('docs/amblem.svg yazıldı');
}
