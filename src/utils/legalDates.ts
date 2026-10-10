import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { addYears } from 'date-fns/addYears';
import { getDay } from 'date-fns/getDay';
import { lastDayOfMonth } from 'date-fns/lastDayOfMonth';
import type { LegalDeadlineDef, LegalDurationUnit } from '@/constants/legalDeadlines';

/**
 * Fixed-date Turkish national holidays (month is 1-based), 2429 s.K. m.2.
 * Dini bayramlar (Ramazan/Kurban) yıldan yıla kaydığı için aşağıda ayrı bir
 * tabloda tutulur (DINI_BAYRAM_AREFELERI).
 */
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1], // Yılbaşı
  [4, 23], // Ulusal Egemenlik ve Çocuk Bayramı
  [5, 1], // Emek ve Dayanışma Günü
  [5, 19], // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  [7, 15], // Demokrasi ve Millî Birlik Günü
  [8, 30], // Zafer Bayramı
  [10, 29], // Cumhuriyet Bayramı
];

function isWeekend(d: Date): boolean {
  const day = getDay(d);
  return day === 0 || day === 6;
}

function isFixedHoliday(d: Date): boolean {
  return FIXED_HOLIDAYS.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

export function isNonWorkingDay(d: Date): boolean {
  return isWeekend(d) || isFixedHoliday(d) || isLikelyReligiousHoliday(d);
}

/** Adli tatil: 20 Temmuz – 31 Ağustos (HMK 102). */
export function isInJudicialRecess(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return (m === 7 && day >= 20) || m === 8;
}

/**
 * Adli tatil uzatma kuralı. Üç kanunun LAFZI birebir okundu; ikisi bir GÜN
 * farkla ayrılıyor ve bu fark idari yargıda gerçek bir sonuç doğuruyor:
 *
 * - 'civil'    HMK m.104: "...adli tatilin BİTTİĞİ GÜNDEN itibaren bir hafta
 *              uzatılmış sayılır." → 31 Ağustos + 7 = 7 Eylül.
 * - 'criminal' CMK m.331/4: "...tatilin BİTTİĞİ GÜNDEN itibaren üç gün
 *              uzatılmış sayılır." → 31 Ağustos + 3 = 3 Eylül.
 * - 'idari'    İYUK m.8/3: "...ara vermenin sona erdiği GÜNÜ İZLEYEN TARİHTEN
 *              itibaren yedi gün uzamış sayılır." → 1 Eylül + 7 = 8 EYLÜL.
 * - 'none'     İcra daireleri tatilde de çalışır.
 *
 * ÖNCE İDARİ YARGI DA 'civil' SAYILIYORDU ve bir gün ERKEN tarih veriyordu
 * (7 Eylül). Yön güvenliydi ama doğru değildi: avukata "süreniz doldu" denen
 * bir gün, aslında hâlâ süresi olan bir gündür. Kanun metinleri havuza
 * eklendikten sonra üç madde de okunup ayrıldı.
 *
 * Ara verme tarihleri üçünde de aynı: 20 Temmuz – 31 Ağustos
 * (HMK m.102, CMK m.331/1, İYUK m.61/1).
 */
export type RecessRule = 'civil' | 'criminal' | 'idari' | 'none';

export function recessRuleForGroup(group: 'hukuk' | 'ceza' | 'icra' | 'idare' | 'is'): RecessRule {
  if (group === 'ceza') return 'criminal';
  if (group === 'icra') return 'none';
  if (group === 'idare') return 'idari';
  return 'civil';
}

/**
 * İYUK m.61/1 istisnası: bölge idare mahkemesinin bulunduğu il merkezi DIŞINDA
 * kalan ve yalnızca bir idare veya bir vergi mahkemesi bulunan yerlerdeki idari
 * yargı mercileri çalışmaya ara vermeden YARARLANAMAZ — yani o mahkemelerde
 * süre uzamaz. Hangi mahkeme olduğunu uygulama bilemez; bu yüzden uzatma
 * yapılır ama kullanıcıya kontrol etmesi söylenir. Sessizce uzatmak, o
 * mahkemelerde doğrudan süre kaçırtır.
 */
export const IDARI_TATIL_ISTISNA_UYARISI =
  'İYUK m.61/1: bölge idare mahkemesinin bulunduğu il merkezi dışında olup yalnızca ' +
  'bir idare veya bir vergi mahkemesi bulunan yerlerde çalışmaya ara verme UYGULANMAZ; ' +
  'süre uzamaz. Mahkemenizin bu kapsamda olup olmadığını teyit edin.';

/**
 * Bir süre tanımının adli tatil kuralı: SÜRE BAZLI istisna (`recess: 'none'`)
 * varsa o, yoksa grubun kuralı. Grup tek başına yetmez — uzama sürenin kendi
 * kanununa ve davanın türüne bağlıdır:
 *
 * - HMK m.104: "Adli tatile tabi olan dava ve işlerde, BU KANUNUN tayin
 *   ettiği süreler ..." uzar. HMK m.103/1'de sayılan dava ve işler (geçici
 *   hukuki koruma ve BUNLARA KARŞI İTİRAZLAR, nafaka/soybağı/velayet/vesayet,
 *   işçi davaları, iflas/konkordato, çekişmesiz yargı, ivedi işler ...) tatilde
 *   görüldüğü için adli tatile tabi değildir; süreleri UZAMAZ.
 * - İYUK m.8/3 yalnız "Bu Kanunda yazılı" süreleri uzatır; 6216 s.K. m.47/5'te
 *   (AYM bireysel başvuru) adli tatil/uzama hükmü yoktur.
 *
 * ÖNCE grup tek kural veriyordu: ihtiyati tedbire itiraz, işe iade ve AYM
 * başvurusu da 7/8 Eylül'e uzatılıyordu — SONRAKİ (yani tehlikeli) yönde yanlış.
 */
export function recessRuleForDeadline(def: Pick<LegalDeadlineDef, 'group' | 'recess'>): RecessRule {
  return def.recess === 'none' ? 'none' : recessRuleForGroup(def.group);
}

/**
 * DİNİ BAYRAMLAR — HMK m.93: "Sürenin son gününün resmî tatil gününe
 * rastlaması hâlinde, süre tatili takip eden ilk iş günü çalışma saati sonunda
 * biter." Dini bayram günleri resmî tatildir (2429 s.K. m.2/B). ÖNCE bu tablo
 * yoktu ve bayram günü son gün olarak GÖSTERİLİYORDU: yön güvenliydi (erken
 * tarih) ama yanlıştı; avukat bayramda bitmeyen bir süreyi bayramdan önce
 * bitirmeye çalışıyordu.
 *
 * ÖLÇÜ (2429 s.K. m.2/B): "Ramazan Bayramı; Arefe günü saat 13:00'ten itibaren
 * 3,5 gündür. Kurban Bayramı; Arefe günü saat 13:00'ten itibaren 4,5 gündür."
 * Yani arefe YARIM gündür (kaydırılmaz, yalnız uyarılır); ardından Ramazan 3,
 * Kurban 4 tam gün gelir. 28 Ekim de aynı biçimde yarım gündür (m.1).
 *
 * KAYNAK: Diyanet İşleri Başkanlığı Takvim sayfaları, "Dini Günler Listesi" ve
 * "Resmi Tatiller" (vakithesaplama.diyanet.gov.tr, icerik=154/158/185–192;
 * 10.10.2026'da çekildi). 2027–2035'teki 19 arefe tarihi ve hafta günleri
 * sayfadaki satırlarla satır satır karşılaştırıldı; 2026 "Resmi Tatiller"
 * sayfasından. Köprü/idari izin günleri resmî tatil DEĞİLDİR, burada yoktur.
 *
 * Her satır: [arefe günü, bayramın tam gün sayısı]. 1. gün = arefe + 1.
 * Yeni yıl eklerken aynı kaynaktan arefe tarihini ve gün sayısını ekleyin ve
 * DINI_BAYRAM_KAPSAM_SON_YIL sabitini güncelleyin.
 */
const DINI_BAYRAM_AREFELERI: Array<[string, 3 | 4]> = [
  ['2026-03-19', 3], ['2026-05-26', 4],
  ['2027-03-08', 3], ['2027-05-15', 4],
  ['2028-02-25', 3], ['2028-05-04', 4],
  ['2029-02-13', 3], ['2029-04-23', 4],
  ['2030-02-03', 3], ['2030-04-12', 4],
  ['2031-01-23', 3], ['2031-04-01', 4],
  ['2032-01-13', 3], ['2032-03-21', 4],
  ['2033-01-01', 3], ['2033-03-10', 4], ['2033-12-22', 3], // 2033'te iki Ramazan Bayramı
  ['2034-02-28', 4], ['2034-12-11', 3],
  ['2035-02-17', 4], ['2035-11-30', 3],
];

/** Tablonun kapsadığı ilk yıl (son yıl için DINI_BAYRAM_KAPSAM_SON_YIL). */
const DINI_BAYRAM_KAPSAM_ILK_YIL = 2026;

/**
 * Bayram tablosunun kapsadığı SON yıl.
 *
 * NEDEN DIŞA VERİLİYOR. Tablo tükendiğinde sonraki yıllar için bayramlar
 * sessizce "yokmuş" gibi davranırdı. Kapsam dışındaki tarihlerde `religiousWarn`
 * AÇILIR (bayram etkisi hesaplanamadı); ayrıca tests/legalDates.test.ts kapsam
 * bitmeden kırmızıya döner ve tablonun güncellenmesini hatırlatır.
 */
export const DINI_BAYRAM_KAPSAM_SON_YIL = 2035;

function yerelTarih(iso: string): Date {
  const [y, m, g] = iso.split('-').map(Number);
  return new Date(y, m - 1, g);
}

function gunAnahtari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AREFE_ANAHTARLARI = new Set<string>();
const BAYRAM_ANAHTARLARI = new Set<string>();
for (const [arefe, gunSayisi] of DINI_BAYRAM_AREFELERI) {
  AREFE_ANAHTARLARI.add(arefe);
  for (let i = 1; i <= gunSayisi; i++) {
    BAYRAM_ANAHTARLARI.add(gunAnahtari(addDays(yerelTarih(arefe), i)));
  }
}

/** Dini bayramın TAM tatil günü mü? (Arefe değil; arefe yarım gündür.) */
export function isLikelyReligiousHoliday(d: Date): boolean {
  return BAYRAM_ANAHTARLARI.has(gunAnahtari(d));
}

/**
 * Yarım gün tatil: dini bayram arefeleri ve 28 Ekim (2429 s.K. m.1, m.2/B —
 * "saat 13:00'ten itibaren"). Gün kaydırılmaz, çünkü sabahı çalışma günüdür;
 * ama dilekçe 13.00'ten sonra verilecekse risk vardır, kullanıcı uyarılır.
 */
export function isHalfDayHoliday(d: Date): boolean {
  return AREFE_ANAHTARLARI.has(gunAnahtari(d)) || (d.getMonth() === 9 && d.getDate() === 28);
}

function bayramTablosuKapsiyor(d: Date): boolean {
  const y = d.getFullYear();
  return y >= DINI_BAYRAM_KAPSAM_ILK_YIL && y <= DINI_BAYRAM_KAPSAM_SON_YIL;
}

export interface LegalDueResult {
  /** Statutory end of the period before any holiday extension. */
  raw: Date;
  /** Actual last day: extended past adli tatil and weekends/official holidays (dini bayramlar dahil). */
  due: Date;
  /** True when the raw date fell on a non-working day and was extended. */
  extended: boolean;
  /** True when the due date falls inside adli tatil (20 Jul – 31 Aug). */
  inRecess: boolean;
  /** True when the period was extended past adli tatil (HMK 104 / CMK 331). */
  recessExtended: boolean;
  /**
   * True when the rule is 'none' although the raw last day fell inside adli
   * tatil: uygulama bu süre için tatil uzaması HESAPLAMADI (ekran bunu söyler).
   */
  recessNotApplied: boolean;
  /**
   * True when dini bayram bilgisi eksik/dikkat gerektirir: son gün yarım gün
   * tatile (arefe, 28 Ekim) denk geliyor ya da tarih bayram tablosunun
   * kapsamı dışında (bayram etkisi hesaplanamadı).
   */
  religiousWarn: boolean;
}

/**
 * Computes the last day of a statutory period per HMK 92:
 * - days: the notification day itself is not counted; the period ends on the
 *   Nth day after it (start + N).
 * - weeks: ends on the same weekday of the final week (start + 7N).
 * - months: ends on the same day-of-month; if the target month is shorter,
 *   on its last day.
 * - years: same date next year(s).
 * Then, if the last day falls inside adli tatil, the period is deemed extended
 * from the end of the recess (HMK 104: one week; CMK 331/4: three days).
 * Finally HMK 93: a last day landing on a weekend/official holiday (dini
 * bayramlar dahil) rolls to the next working day.
 *
 * SIRA önemlidir ve böyledir: önce adli tatil uzaması (HMK 104), SONRA hafta
 * sonu/resmî tatil kaydırması (HMK 93). Uzamanın bittiği gün (7 Eylül 2025 gibi)
 * hafta sonuna düşerse ilk iş gününe kayar. AÇIK SORU (meslektaş teyidi):
 * son gün hafta sonuna düşüp HMK 93 ile tatilin ilk günü olan 20 Temmuz'a
 * kayarsa HMK 104 uzaması uygulanır mı? Uygulanmaz (erken tarih verilir,
 * güvenli yön); ekran `inRecess` ile uyarır.
 */
export function computeLegalDue(
  notifiedAt: Date,
  amount: number,
  unit: LegalDurationUnit,
  recess: RecessRule = 'none'
): LegalDueResult {
  const start = new Date(notifiedAt.getFullYear(), notifiedAt.getMonth(), notifiedAt.getDate());

  let raw: Date;
  if (unit === 'day') {
    raw = addDays(start, amount);
  } else if (unit === 'week') {
    raw = addDays(start, amount * 7);
  } else if (unit === 'month') {
    const target = addMonths(start, amount);
    // date-fns clamps 31 Jan + 1 month to 28/29 Feb already, which matches
    // HMK 92/2 (period ends on the last day of a shorter month).
    raw = target.getDate() !== start.getDate() ? lastDayOfMonth(target) : target;
  } else {
    raw = addYears(start, amount);
  }

  // Adli tatil uzatması. Son gün 20 Tem – 31 Ağu arasına düşerse:
  //   hukuk (HMK 104)  : 31 Ağustos + 7 gün = 7 Eylül
  //   ceza  (CMK 331/4): 31 Ağustos + 3 gün = 3 Eylül
  //   idare (İYUK 8/3) : 1 Eylül'den itibaren 7 gün = 8 Eylül
  // İdari yargının bir gün farkı, kanunun "sona erdiği GÜNÜ İZLEYEN tarihten
  // itibaren" demesinden gelir; diğer ikisi "bittiği GÜNDEN itibaren" der.
  let base = new Date(raw);
  let recessExtended = false;
  if (recess !== 'none' && isInJudicialRecess(raw)) {
    const endOfRecess = new Date(raw.getFullYear(), 7, 31); // 31 Ağustos
    const sayimBasi = recess === 'idari' ? addDays(endOfRecess, 1) : endOfRecess;
    base = addDays(sayimBasi, recess === 'criminal' ? 3 : 7);
    recessExtended = true;
  }

  let due = new Date(base);
  while (isNonWorkingDay(due)) {
    due = addDays(due, 1);
  }

  return {
    raw,
    due,
    extended: !recessExtended && due.getTime() !== raw.getTime(),
    inRecess: isInJudicialRecess(due),
    recessExtended,
    recessNotApplied: recess === 'none' && isInJudicialRecess(raw),
    religiousWarn: isHalfDayHoliday(due) || !bayramTablosuKapsiyor(raw) || !bayramTablosuKapsiyor(due),
  };
}
