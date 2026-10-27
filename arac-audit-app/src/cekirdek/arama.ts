// ARAMA — parça ve hata tipi aramasının ortak kuralı (28.09.2026).
//
// Kullanılabilirlik sınamasında (üç ajan, web paketi) "sol ön kapı" araması
// dıştaki sol ön kapıyı BULMUYORDU. Eşleşme tek parça alt dize aramasıydı;
// parçanın adı "Ön kapı", tarafı yalnız bölge adında ("Dış · Sol yan"), sıra
// tutmadığı için yalnız iç döşeme ("Sol ön kapı döşemesi") çıkıyordu. Denetçi
// çıkan tek sonuca dokunup hatayı yanlış parçaya yazabilirdi.
//
// Kural:
//  - sorgudaki HER kelime aranır, sıra önemsiz ("ön kapı sol" = "sol ön kapı");
//  - kelime, metindeki bir kelimenin BAŞIYLA eşleşir: "sol" konSOL'u bulmaz;
//  - Türkçe karakter şart değil ("sag on kapi" → "Sağ ön kapı"): eldivenle ya
//    da Türkçe olmayan klavyeyle yazana göre.

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Küçük harf (Türkçe kuralıyla), Türkçe harfler Latin karşılığına, noktalama boşluğa. */
export function aramaSadelestir(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => HARF[c] ?? c)
    // "İ" Türkçe küçültmede "i" olur; Türkçe dışı bir motor "i̇" (i + nokta) bırakırsa noktayı at.
    .replace(/̇/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Aranacak metni kurar: verilen parçalar birleştirilip sadeleştirilir; iki
 * kelimelik kısaltmalar sorgudaki gibi birleşir ("t gate" → "tgate"), yoksa
 * eş anlamlıya yazılan "t gate spoiler" sorgudaki "T GATE SPOILER"ı bulmaz.
 */
export function aramaMetni(...parcalar: (string | null | undefined)[]): string {
  return sorguKelimeleri(parcalar.filter(Boolean).join(' ')).join(' ');
}

// HYUNDAI PARÇA KATALOĞU KISALTMALARI (27.10.2026). Ekibin Excel'i parça
// adlarını Hyundai'nin katalog dilinde yazıyor: "FRT BUMPER", "T GATE INR
// PNL", "C PAD-UPR", "RR DR W STRIP", "HOOD(FRT PNL)". Arama bunları
// tanımıyordu — ÖLÇÜLDÜ (ekibin dosyasındaki bütün parça etiketleri bu
// aramaya verildi, kayıt ağırlıklı): etiketlerin yalnız %13,5'i bir parça
// buluyordu; "FRT BUMPER" bile. Kısaltma, kelimenin KENDİSİNE EK OLARAK
// açılımıyla da eşleşir. Kısaltma kelimenin BAŞINA değil yalnız kendisine
// eşleşir: "dr" kapıdır, "DRL"yi getirmesin (ilk denemede getiriyordu).

/** İki kelimelik kısaltmalar tek kelimeye ("t gate" → "tgate"); sadeleştirmeden SONRA. */
const BIRLESIK: Readonly<Record<string, string>> = {
  't gate': 'tgate', 'w strip': 'wstrip', 'c pad': 'cpad', 'h lining': 'hlining', 'c lamp': 'kombilamba',
  'h lamp': 'hlamp', 'w shield': 'wshield', 'w glass': 'wshield', 'o s': 'disyuz', 'i s': 'icyuz',
  'mold g': 'moldg', 'clos g': 'closg', 'wir g': 'wirg', 'park g': 'parkg', 'str g': 'strg', 's whl': 'swhl',
  't m': 'tm', 'a con': 'acon', 'a c': 'acon', 'h rest': 'hrest', 's visor': 'svisor', 'a vent': 'avent',
};

/** Kısaltma → metinde aranacak açılımlar (kelime başı). Kısaltmanın kendisi de geçerli. */
const KISALTMA: Readonly<Record<string, readonly string[]>> = {
  frt: ['front', 'on'], fr: ['front', 'on'], rr: ['rear', 'arka'], dr: ['door', 'kapi'],
  pnl: ['panel'], inr: ['inner', 'ic'], otr: ['outer', 'dis'], upr: ['upper', 'ust'], lwr: ['lower', 'alt'],
  ctr: ['center', 'centre', 'orta'], qtr: ['quarter'], fdr: ['fender', 'camurluk'], hdl: ['handle', 'kol'],
  mold: ['mould', 'mold', 'cita'], moldg: ['mould', 'mold', 'cita'], tgate: ['tailgate'],
  wstrip: ['weatherstrip', 'fitil'], cpad: ['crash', 'ip', 'dashboard'], hlining: ['headlin'],
  kombilamba: ['tail', 'stop', 'combination'], hlamp: ['headlamp', 'far'], wshield: ['windshield'],
  disyuz: ['outside', 'outer', 'exterior'], icyuz: ['inside', 'inner', 'interior'], closg: ['closing'],
  wirg: ['wiring'], wir: ['wiring'], parkg: ['parking'], park: ['parking'], strg: ['steering'], swhl: ['steering'],
  whl: ['wheel'], plr: ['pillar'], tm: ['transmission', 'shift'], tgs: ['shift'], mtm: ['shift'],
  acon: ['hvac', 'klima', 'acon'], hrest: ['headrest'], svisor: ['visor'], avent: ['vent'],
  rpas: ['parking'], mfc: ['camera', 'kamera'], avn: ['infotainment', 'audio'], hmsl: ['high'],
  bmp: ['bumper'], bemper: ['bumper'], eng: ['engine'], rsvr: ['reservoir'], mtg: ['mounting'], brkt: ['bracket'],
};

/**
 * "Yumuşak" kelimeler: hiçbir parça tam eşleşmezse bunlar atlanarak yeniden
 * aranır (esnekSuz). Excel etiketleri parçanın adına konum/iş bilgisi ekliyor:
 * "FRT BUMPER LH", "T GATE CLOS'G", "SPOILER MTG NUT", "LH FRT DR OPENING".
 */
const YUMUSAK = new Set([
  'pnl', 'panel', 'assy', 'area', 'otr', 'outer', 'disyuz', 'body', 'piece', 'sub', 'all',
  'closg', 'closing', 'opening', 'mtg', 'mounting', 'nut', 'bolt', 'clip', 'clips', 'bracket', 'brkt',
  'black', 'gray', 'grey', 'tape', 'trim', 'garnish', 'to', 'and',
]);

/** Taraf kelimeleri: en son atlanır ("RH C LAMP-QTR PNL" önce sağ stopu bulsun). */
const TARAF = new Set(['lh', 'rh', 'sol', 'sag', 'left', 'right']);

/** Sorgunun kelimeleri: sadeleştirilmiş, iki kelimelik kısaltmalar birleştirilmiş. */
export function sorguKelimeleri(sorgu: string): string[] {
  const k = aramaSadelestir(sorgu).split(' ').filter(Boolean);
  const cikti: string[] = [];
  for (let i = 0; i < k.length; i++) {
    const ikili = i + 1 < k.length ? BIRLESIK[`${k[i]} ${k[i + 1]}`] : undefined;
    if (ikili) { cikti.push(ikili); i++; } else cikti.push(k[i]!);
  }
  return cikti;
}

function kelimeVar(q: string, kelimeler: readonly string[]): boolean {
  const acilim = KISALTMA[q];
  if (!acilim) return kelimeler.some((k) => k.startsWith(q));
  return kelimeler.some((k) => k === q || acilim.some((g) => k.startsWith(g)));
}

/**
 * Sorgunun her kelimesi `metin`deki bir kelimenin başıyla (ya da kısaltmanın
 * açılımıyla) eşleşiyor mu? `metin` aramaMetni() ile kurulmuş olmalı. Boş
 * sorgu her şeyle eşleşir. `yumusakAtla`: yumuşak kelimeler sayılmaz; geriye
 * kelime kalmazsa eşleşme YOK (her şeyi döndürmesin).
 */
export function aramaEslesir(metin: string, sorgu: string, yumusakAtla: 0 | 1 | 2 | boolean = 0): boolean {
  let sozcukler = sorguKelimeleri(sorgu);
  if (!sozcukler.length) return true;
  const kademe = yumusakAtla === true ? 2 : yumusakAtla === false ? 0 : yumusakAtla;
  if (kademe) {
    sozcukler = sozcukler.filter((q) => !YUMUSAK.has(q) && !(kademe === 2 && TARAF.has(q)));
    if (!sozcukler.length) return false;
  }
  const kelimeler = metin.split(' ');
  return sozcukler.every((q) => kelimeVar(q, kelimeler));
}

/**
 * Esnek süzme: önce bütün kelimelerle; sonuç yoksa yumuşak kelimeler
 * (LH/RH, PNL, AREA, CLOS'G…) atlanarak. Yazım hatası toleransı ayrı
 * (aramaYakinEslesir) ve çağıran ayrıca gösterir.
 */
export function esnekSuz<T>(
  liste: readonly T[], metin: (x: T) => string, sorgu: string,
  /** Verilirse sonuçlar, sorgu kelimelerinin bu ADDA kaçının geçtiğine göre sıralanır. */
  adMetni?: (x: T) => string,
): T[] {
  for (const kademe of [0, 1, 2] as const) {
    const s = liste.filter((x) => aramaEslesir(metin(x), sorgu, kademe));
    if (!s.length) continue;
    if (!adMetni) return s;
    // SIRALAMA (27.10.2026): "FRT BUMPER" tampon, ızgara, klape, amblem, alt
    // garniş ve park sensörünü getiriyor (hepsinin eş anlamlısında "bumper"
    // var); "H LINING" tavan bölgesindeki her parçayı (bölgenin adı
    // "Headliner & garnish"). Kelimeleri parçanın KENDİ adında geçen önce gelir.
    const kelimeler = sorguKelimeleri(sorgu);
    // Eşitlikte adı KISA olan önce: "T GATE PNL" dış paneli (Tailgate panel),
    // iç sacdan (Tailgate inner panel) önce getirsin — istenmeyen kelime yok.
    const puanla = (x: T) => { const ad = adMetni(x).split(' '); return { p: kelimeler.filter((q) => kelimeVar(q, ad)).length, u: ad.length }; };
    return s.map((x, i) => ({ x, i, ...puanla(x) })).sort((a2, b) => b.p - a2.p || a2.u - b.u || a2.i - b.i).map((y) => y.x);
  }
  return [];
}

// YAZIM HATASI TOLERANSI (26.10.2026). İkinci dış değerlendirmede saha
// denetçisi eldivenle "camurlk", "kaptu" yazdı ve sonuç alamadı. Yalnız TAM
// eşleşme hiç sonuç vermediğinde kullanılır ve ekranda "yakın sonuçlar" diye
// ayrı gösterilir: doğru yazana fazladan, alakasız sonuç düşmesin.

/** İki dize arasındaki düzenleme uzaklığı (yer değiştirme bir adım sayılır). */
export function duzenlemeUzakligi(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const m = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + m);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Sorgu kelimesi, metindeki bir kelimenin BAŞINA en çok `izin` hatayla
 * uyuyor mu? 3 harften kısa kelimede hata kabul edilmez ("on" → "ön"
 * zaten sadeleştirmeyle tutuyor); 4–6 harfte bir, 7+ harfte iki hata.
 */
function yakinKelime(q: string, k: string): boolean {
  if (k.startsWith(q)) return true;
  const izin = q.length < 4 ? 0 : q.length < 7 ? 1 : 2;
  if (!izin) return false;
  // Kelimenin sorgu uzunluğundaki başı (±1 harf: eksik ya da fazla harf).
  for (let n = q.length - 1; n <= q.length + 1; n++) {
    if (n < 1 || n > k.length) continue;
    if (duzenlemeUzakligi(q, k.slice(0, n)) <= izin) return true;
  }
  return false;
}

/** aramaEslesir'in yazım hatasına dayanıklı hâli: her kelime yakın bir kelimeyle eşleşmeli. */
export function aramaYakinEslesir(metin: string, sorgu: string): boolean {
  const sozcukler = sorguKelimeleri(sorgu);
  if (!sozcukler.length) return true;
  const kelimeler = metin.split(' ');
  return sozcukler.every((q) => kelimeVar(q, kelimeler) || kelimeler.some((k) => yakinKelime(q, k)));
}
