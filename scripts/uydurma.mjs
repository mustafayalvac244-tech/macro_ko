// UYDURMA AYIKLAYICILAR — metinden tarih, tutar ve madde atıfı çıkarır.
// ---------------------------------------------------------------------------
// AYRI MODÜL, ÇÜNKÜ TESTİ VAR. Bu üç ayıklayıcı, ölçümün en ağır kararını
// veriyor: "bu taslakta UYDURMA veri var". Yanlış pozitif, aslında temiz bir
// taslağı kusurlu gösterip düzeltilecek gerçek hataları gölgeler; yanlış
// negatif ise mahkemeye yanlış tarihle giden bir dilekçeyi onaylar. İkisi de
// pahalı, ikisi de sessizdir — bu yüzden tests/ altında sınanır.
//
// Ölçüm sırasında görülen gerçek tuzaklar:
//   • "3 × 12.000 = 36.000 TL" meşrudur; toplam ve katlar uydurma sayılmamalı.
//   • "HMK m.119/1-d" tek bir maddedir; "119/1" ayrı bir madde numarası değil.
//   • "İİK m.62/son" da öyle: bent/fıkra eki, madde numarasının parçası değil.
//   • "5 yıllık zamanaşımı" bir tutar değildir; para birimi olmadan sayı alınmaz.

/** Metindeki tarihleri tek biçime indirger: 01.02.2026 / 1/2/2026 / 2026-02-01 */
export function tarihler(metin) {
  const bulunan = new Set();
  const d = String(metin ?? '');
  for (const m of d.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
    bulunan.add(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`);
  }
  for (const m of d.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) bulunan.add(`${m[1]}-${m[2]}-${m[3]}`);
  return bulunan;
}

/**
 * Metindeki para tutarları (sayı olarak). "12.000 TL", "12 000 TL", "36.000,00 TL".
 * Yalnız TL/₺ ile birlikte geçenler alınır; madde numarası ya da yıl sayılmasın.
 *
 * KURUŞ KISMI ÖNCEDEN GÖRÜNMÜYORDU. İlk yazılışta kuruş ayracı (virgül) desene
 * hiç girmemişti: "36.000,00 TL" yazan bir tutar HİÇ eşleşmiyordu ve uydurma
 * denetiminden sessizce geçiyordu. Bu, testi yazarken çıktı — yani denetimin
 * kendisi denetlenmemişti. Resmî dilekçe dilinde tutarlar tam da bu biçimde
 * yazılır; kaçırılan hâl, istisna değil KURALDI.
 */
export function tutarlar(metin) {
  const bulunan = new Set();
  for (const m of String(metin ?? '').matchAll(
    /([\d][\d.\s ]*\d|\d)(?:,(\d{1,2}))?\s*(?:TL|₺|Türk Lirası)/gi
  )) {
    const tam = Number(String(m[1]).replace(/[.\s ]/g, ''));
    const kurus = m[2] ? Number(String(m[2]).padEnd(2, '0')) / 100 : 0;
    const sayi = tam + kurus;
    if (Number.isFinite(sayi) && sayi > 0) bulunan.add(sayi);
  }
  return bulunan;
}

/**
 * Olayda geçen tutarlardan MEŞRU sayılacakların kümesi: tutarların kendisi ve
 * katları. "Aylık 12.000 TL kira, üç ay ödenmedi" anlatımında taslağın
 * "36.000 TL" yazması hesaptır, uydurma değildir.
 */
export function mesruTutarlar(olayTutarlari, enCokKat = 24) {
  const k = new Set(olayTutarlari);
  for (const a of olayTutarlari) for (let i = 2; i <= enCokKat; i++) k.add(a * i);
  return k;
}

/** Havuzdaki kanun kısaltmaları ve metinde geçebilecek yazılışları. */
const KANUN_ADLARI = {
  TBK: ['tbk', 'turk borclar kanunu', 'borclar kanunu', '6098'],
  TMK: ['tmk', 'turk medeni kanunu', 'medeni kanun', '4721'],
  TTK: ['ttk', 'turk ticaret kanunu', 'ticaret kanunu', '6102'],
  HMK: ['hmk', 'hukuk muhakemeleri kanunu', '6100'],
  İİK: ['iik', 'icra ve iflas kanunu', 'icra iflas kanunu', '2004'],
  TCK: ['tck', 'turk ceza kanunu', '5237'],
  CMK: ['cmk', 'ceza muhakemesi kanunu', '5271'],
  İşK: ['isk', 'is kanunu', '4857'],
  İYUK: ['iyuk', 'idari yargilama usulu kanunu', '2577'],
  AY: ['ay', 'anayasa', 'turkiye cumhuriyeti anayasasi', '2709'],
  TKHK: ['tkhk', 'tuketicinin korunmasi hakkinda kanun', '6502'],
  AvK: ['avk', 'avukatlik kanunu', '1136'],
  AATUHK: ['aatuhk', 'amme alacaklarinin tahsil usulu hakkinda kanun', '6183'],
  SSGSS: ['ssgss', 'sosyal sigortalar ve genel saglik sigortasi kanunu', '5510'],
  İşMK: ['ismk', 'is mahkemeleri kanunu', '7036'],
  KamK: ['kamk', 'kamulastirma kanunu', '2942'],
  AYMK: ['aymk', 'anayasa mahkemesinin kurulusu', '6216'],
};

function sadeAd(v) {
  return String(v ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ğüşıöçâîû]/g, (c) => ({ ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' })[c])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Yazılıştan kısaltmaya çözüm tablosu. Uzun yazılışlar önce denenir ki
// "icra ve iflas kanunu" ararken "2004" (yıl gibi görünen numara) kaçmasın.
const COZUM = Object.entries(KANUN_ADLARI)
  .flatMap(([kisa, adlar]) => adlar.map((a) => [sadeAd(a), kisa]))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Metindeki kanun-madde atıflarını çıkarır: [{ kanun, madde }].
 *
 * Yakalanan biçimler:
 *   "TBK m.146", "TBK md. 146", "HMK m. 119/1-d", "İİK m.62/son"
 *   "4857 sayılı Kanun'un 17. maddesi", "İş Kanunu m.21"
 * Fıkra/bent ekleri (/1-d, /son) ATILIR: madde numarası bunlar değildir.
 */
export function maddeAtiflari(metin) {
  const d = String(metin ?? '');
  const cikan = [];
  const ekle = (hamAd, hamNo) => {
    const ad = sadeAd(hamAd);
    const kanun = COZUM.find(([yazilis]) => ad === yazilis || ad.endsWith(' ' + yazilis))?.[1];
    if (!kanun) return;
    // Madde numarası harf ekli olabilir (İİK m.68/a); fıkra eki değil, madde
    // numarasının parçası olan harf korunur — ikisi ayırt edilemediğinde
    // numaranın SADE hâli alınır, çünkü yanlış pozitif üretmek istemiyoruz.
    const no = String(hamNo).replace(/\s+/g, '');
    if (!/^\d+$/.test(no)) return;
    cikan.push({ kanun, madde: no });
  };

  // "TBK m.146", "İş Kanunu md. 21", "HMK 119"
  for (const m of d.matchAll(
    /([A-Za-zÇĞİÖŞÜçğıiöşü.’'\s]{2,45}?)\s*(?:m\.|md\.|madde\s*|maddesi\s*)\s*(\d{1,3})\b/g
  )) ekle(m[1], m[2]);
  // "4857 sayılı Kanun'un 17. maddesi"
  for (const m of d.matchAll(/\b(\d{4})\s*say[ıi]l[ıi][^.\n]{0,40}?\b(\d{1,3})\s*[./]?\s*madde/gi))
    ekle(m[1], m[2]);
  // Yinelenenleri at
  const anahtar = new Set();
  return cikan.filter((a) => {
    const k = `${a.kanun}#${a.madde}`;
    if (anahtar.has(k)) return false;
    anahtar.add(k);
    return true;
  });
}
