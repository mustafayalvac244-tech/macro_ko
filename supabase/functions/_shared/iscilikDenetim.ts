// İŞÇİLİK DİLEKÇESİ DENETİMİ — saf mantık, testli, PARA HARCAMAZ (model çağrısı yok).
// ---------------------------------------------------------------------------
// NEDEN (01.10.2026, canlıda ölçüldü). Sonnet'in deneme dilekçesinde iki hata
// müvekkilin ALEYHİNE işledi:
//   1. Ödenmeyen ücrete "yasal faiz" istendi. İş K. m.34: "Gününde ödenmeyen
//      ücretler için mevduata uygulanan en yüksek faiz oranı uygulanır."
//      Yargıtay 22. HD 20.10.2014: ücret alacağına en yüksek mevduat faizi
//      yerine başka faiz yürütülmesi "hatalı" (havuzumuzdaki karar).
//   2. Alacak davasına "son tutanaktan itibaren 2 hafta" süresi yazıldı. İş K.
//      m.20: bu süre YALNIZ İŞE İADE davası içindir. Hatanın kaynağı BİZİM kural
//      metnimizdi (arabuluculuk_dava_sarti_kapsam, 0164'te düzeltildi).
//   Ayrıca 2019'dan beri süren fazla çalışma talebinde zamanaşımı hiç anılmadı.
//
// Model bu hataları ileride de yapabilir; talimat tek başına yetmiyor (bkz.
// _shared/kural.ts). Bu denetim çıktıyı OKUR ve avukata uyarı üretir.
// YALNIZ UYARI — metni değiştirmez, hak düşürmez. Son söz kullanıcının.
//
// Kaynaklar depoda: src/data/laws/is-kanunu.json (m.20, m.34, m.120, Ek m.3).

function cumleler(metin: string): string[] {
  return String(metin ?? '')
    .toLocaleLowerCase('tr')
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

const YASAL_FAIZ = /yasal\s+faiz/;
const EN_YUKSEK = /en\s+yüksek/;
// Ücretin kendisi; "fazla çalışma ücreti" ve "izin ücreti" ayrı kalemlerdir.
const UCRET_ALACAGI = /(ödenmeyen|ödenmemiş|birikmiş)\s+(\S+\s+){0,6}ücret|ücret\s+alaca/;
const AYRI_KALEM = /fazla\s+(çalışma|mesai)|izin\s+ücret|ihbar/;

export const ISCILIK_UYARI = {
  ucretFaiz:
    'Ödenmeyen ÜCRET alacağına "yasal faiz" istenmiş. İş Kanunu m.34: gününde ödenmeyen ücretler için ' +
    'mevduata uygulanan EN YÜKSEK faiz uygulanır. Faiz türünü kontrol edin.',
  kidemFaiz:
    'KIDEM tazminatına "yasal faiz" istenmiş. Kıdem tazminatında bankalarca mevduata uygulanan EN YÜKSEK ' +
    'faiz istenir (1475 s. Kanun m.14, İş K. m.120 ile yürürlükte). Faiz türünü kontrol edin.',
  ikiHafta:
    'Dilekçede "2 hafta" dava açma süresi geçiyor. Arabuluculuk son tutanağından itibaren 2 haftalık süre ' +
    'YALNIZ İŞE İADE davası içindir (İş K. m.20); işçilik ALACAK davalarında böyle bir süre yoktur.',
  zamanasimi:
    'Fazla çalışma/ücret talebinde ZAMANAŞIMI değerlendirilmemiş. Ücret niteliğindeki alacaklarda zamanaşımı ' +
    '5 yıldır (TBK m.147); dava tarihinden geriye 5 yılı aşan dönemi kontrol edin.',
} as const;

/** İşçilik dilekçesinde bilinen hata kalıplarını arar; bulunan her biri için bir uyarı döner. */
export function iscilikUyarilari(metin: string): string[] {
  const liste = cumleler(metin);
  const tum = liste.join(' ');
  const uyarilar: string[] = [];

  const ucretYasal = liste.some(
    (c) => UCRET_ALACAGI.test(c) && !AYRI_KALEM.test(c) && YASAL_FAIZ.test(c) && !EN_YUKSEK.test(c)
  );
  if (ucretYasal) uyarilar.push(ISCILIK_UYARI.ucretFaiz);

  const kidemYasal = liste.some((c) => /kıdem/.test(c) && YASAL_FAIZ.test(c) && !EN_YUKSEK.test(c));
  if (kidemYasal) uyarilar.push(ISCILIK_UYARI.kidemFaiz);

  const ikiHafta = liste.some((c) => /(2|iki)\s*hafta/.test(c) && /(dava|tutanak|arabulucu)/.test(c));
  if (ikiHafta && !/işe\s+iade/.test(tum)) uyarilar.push(ISCILIK_UYARI.ikiHafta);

  if (/fazla\s+(çalışma|mesai)/.test(tum) && !/zamanaşım/.test(tum)) uyarilar.push(ISCILIK_UYARI.zamanasimi);

  return uyarilar;
}
