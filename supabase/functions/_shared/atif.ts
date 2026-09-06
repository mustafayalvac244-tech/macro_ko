// KANUN-MADDE ATIFLARI — metinden çıkarma. Saf mantık, testli.
// ---------------------------------------------------------------------------
// NEDEN SUNUCUYA TAŞINDI. Bu ayıklayıcı bugüne kadar YALNIZ ölçüm betiğinde
// vardı (scripts/uydurma.mjs). Yani uydurma madde atfını ÖLÇÜYORDUK ama
// kullanıcıyı ondan KORUMUYORDUK: ölçümde "UYDURMA MADDE" satırını biz
// görüyorduk, aynı metni ekranda gören avukat hiçbir şey görmüyordu.
//
// Ölçülen gerçek arıza (mütalaa koşusu): serbest katman modeli "Yönetim Kanunu
// ve Yönetim Mahkemeleri Kanunu" diye var olmayan kanunlar yazdı ve gerçek
// kanunlara var olmayan madde numaraları verdi. Avukat için bu, en pahalı hata
// türüdür: uydurma madde GERÇEK GÖRÜNÜR — biçimi doğrudur, numarası vardır,
// cümlesi hukukçu gibi kurulmuştur. Yanlış olduğu ancak mahkemede anlaşılır.
//
// Ölçüm ile ürün arasındaki bu asimetri, ölçümün kendisini de yanıltıyordu:
// "kusurlu" saydığımız çıktı kullanıcıya kusursuz gibi gidiyordu.
//
// Deno API'si KULLANMAZ; hem uç işlevi hem vitest içeri alabilsin.

/** Havuzdaki kanun kısaltmaları ve metinde geçebilecek yazılışları. */
export const KANUN_ADLARI: Record<string, string[]> = {
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

function sadeAd(v: unknown): string {
  const harf: Record<string, string> = { ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
  return String(v ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ğüşıöçâîû]/g, (c) => harf[c])
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Yazılıştan kısaltmaya çözüm tablosu. Uzun yazılışlar önce denenir ki
// "icra ve iflas kanunu" ararken "2004" (yıl gibi görünen numara) kaçmasın.
const COZUM: Array<[string, string]> = Object.entries(KANUN_ADLARI)
  .flatMap(([kisa, adlar]) => adlar.map((a) => [sadeAd(a), kisa] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length);

export interface Atif {
  kanun: string;
  madde: string;
}

/**
 * Metindeki kanun-madde atıflarını çıkarır.
 *
 * Yakalanan biçimler:
 *   "TBK m.146", "TBK md. 146", "HMK m. 119/1-d", "İİK m.62/son"
 *   "4857 sayılı Kanun'un 17. maddesi", "İş Kanunu m.21"
 * Fıkra/bent ekleri (/1-d, /son) ATILIR: madde numarası bunlar değildir.
 */
export function maddeAtiflari(metin: string): Atif[] {
  const d = String(metin ?? '');
  const cikan: Atif[] = [];
  const ekle = (hamAd: string, hamNo: string) => {
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

  for (const m of d.matchAll(
    /([A-Za-zÇĞİÖŞÜçğıiöşü.’'\s]{2,45}?)\s*(?:m\.|md\.|madde\s*|maddesi\s*)\s*(\d{1,3})\b/g
  )) ekle(m[1], m[2]);
  for (const m of d.matchAll(/\b(\d{4})\s*say[ıi]l[ıi][^.\n]{0,40}?\b(\d{1,3})\s*[./]?\s*madde/gi))
    ekle(m[1], m[2]);

  const anahtar = new Set<string>();
  return cikan.filter((a) => {
    const k = `${a.kanun}#${a.madde}`;
    if (anahtar.has(k)) return false;
    anahtar.add(k);
    return true;
  });
}

/**
 * Atıfları, havuzda VAR OLAN maddelerle karşılaştırıp uydurma olanları döner.
 *
 * İKİ KOŞUL BİRLİKTE ARANIR ve ikisi de kasıtlıdır:
 *   1. Kanun havuzda OLMALI. Havuzda olmayan bir kanuna (örn. KTK) yapılan
 *      atfı "uydurma" saymak, bizim eksiğimizi kullanıcının hatasıymış gibi
 *      göstermek olur — üstelik doğru bir atfı yanlış diye işaretleriz.
 *   2. Madde havuzda OLMAMALI. Kanun bizde tam olduğuna göre, o numaranın
 *      yokluğu gerçekten yokluktur.
 *
 * Yanlış pozitif burada pahalıdır: doğru bir atfı "uydurma" diye işaretlemek,
 * uyarıyı gürültüye çevirir ve avukat bir daha hiçbirine bakmaz.
 */
export function uydurmaMaddeler(
  atiflar: Atif[],
  havuzKanunlari: Set<string>,
  havuzMaddeleri: Set<string>
): string[] {
  return atiflar
    .filter((a) => havuzKanunlari.has(a.kanun) && !havuzMaddeleri.has(`${a.kanun}#${a.madde}`))
    .map((a) => `${a.kanun} m.${a.madde}`);
}
