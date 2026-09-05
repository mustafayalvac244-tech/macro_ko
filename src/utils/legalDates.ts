import { addDays, addMonths, addYears, getDay, lastDayOfMonth } from 'date-fns';
import type { LegalDurationUnit } from '@/constants/legalDeadlines';

/**
 * Fixed-date Turkish national holidays (month is 1-based). Religious holidays
 * (Ramazan/Kurban) shift every year and are deliberately NOT extended over:
 * showing an earlier due date is always safe, extending wrongly is not.
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
  return isWeekend(d) || isFixedHoliday(d);
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
 * Diyanet takvimine göre dini bayram günleri (arefe hariç, tam günler).
 * Yıllara göre kaydıkları için otomatik UZATMA yapılmaz — yanlış uzatmak süre
 * kaçırtır; yalnızca "kontrol edin" uyarısı göstermek için kullanılır.
 */
const RELIGIOUS_HOLIDAY_RANGES: Array<[string, string]> = [
  ['2026-03-20', '2026-03-22'], // Ramazan Bayramı 2026
  ['2026-05-27', '2026-05-30'], // Kurban Bayramı 2026
  ['2027-03-09', '2027-03-11'], // Ramazan Bayramı 2027
  ['2027-05-16', '2027-05-19'], // Kurban Bayramı 2027
  ['2028-02-26', '2028-02-28'], // Ramazan Bayramı 2028
  ['2028-05-05', '2028-05-08'], // Kurban Bayramı 2028
];

export function isLikelyReligiousHoliday(d: Date): boolean {
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return RELIGIOUS_HOLIDAY_RANGES.some(([start, end]) => key >= start && key <= end);
}

export interface LegalDueResult {
  /** Statutory end of the period before any holiday extension. */
  raw: Date;
  /** Actual last day: extended past adli tatil and weekends/fixed holidays. */
  due: Date;
  /** True when the raw date fell on a non-working day and was extended. */
  extended: boolean;
  /** True when the due date falls inside adli tatil (20 Jul – 31 Aug). */
  inRecess: boolean;
  /** True when the period was extended past adli tatil (HMK 104 / CMK 331). */
  recessExtended: boolean;
  /** True when the due date may coincide with a religious holiday. */
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
 * Finally HMK 93: a last day landing on a weekend/official holiday rolls to
 * the next working day.
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
    religiousWarn: isLikelyReligiousHoliday(due),
  };
}
