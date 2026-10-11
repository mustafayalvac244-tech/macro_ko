/**
 * DURUŞMA ÇIKIŞI — duruşma sonucundan hukuki sonuçları türetir.
 *
 * Neden var: uygulamadaki gerçek veri, duruşma sayısının süre kaydından kat kat
 * fazla olduğunu gösterdi (35 duruşmaya karşılık 6 süre). Yani duruşmada verilen
 * süreler kaydedilmiyor — süre kaçırmanın (meslekî sorumluluğun) ana kaynağı bu.
 * Bu motor, avukatın duruşma çıkışında seçtiği sonuca göre bir sonraki duruşmayı
 * ve/veya süreyi otomatik önerir.
 *
 * KRİTİK HUKUKİ AYRIM: kanun yoluna başvuru süreleri (istinaf/temyiz) kararın
 * TEBLİĞİNDEN işlemeye başlar (HMK m.345, m.361), duruşma/karar tarihinden değil.
 * Bu yüzden "karar açıklandı" seçildiğinde süre OTOMATİK hesaplanmaz; tebligat
 * tarihi girilirse hesaplanır, girilmezse "tebligatı bekle" hatırlatması kurulur.
 * Aksi bir kurgu avukatı yanlış tarihe güvendirir — en tehlikeli hata bu olurdu.
 *
 * Saf fonksiyonlar: kolay test edilir, AI gerektirmez.
 */

import type { CourtCategory } from '@/types/database';
import { istinafTanimi } from '@/utils/istinafSuresi';
import { computeLegalDue } from '@/utils/legalDates';

/** Süre başlığı i18n anahtarı eki — 'hout.d.<key>' olarak çözülür. */
export type DeadlineKey = 'sure' | 'bilirkisiItiraz' | 'istinaf';

export type OutcomeId =
  | 'ertelendi'
  | 'sure_verildi'
  | 'bilirkisi_bekleniyor'
  | 'bilirkisi_itiraz'
  | 'karar_aciklandi'
  | 'yapilamadi';

export interface OutcomeDef {
  id: OutcomeId;
  /** Sonraki duruşma tarihi gerekli mi? */
  needsNextHearing: boolean;
  /** Süre üretir mi (gün cinsinden, duruşma tarihinden itibaren)? */
  deadlineDays?: number;
  /** Süre başlığı için i18n anahtarı eki */
  deadlineKey?: DeadlineKey;
  /** Kanuni dayanak (kullanıcıya gösterilir) */
  basis?: string;
  /** Süre TEBLİĞDEN mi işler? (otomatik hesaplama yapılmaz) */
  runsFromService?: boolean;
  /**
   * Süre bir belgenin tebliğinden işler ve sonuç zaten tebliği anlatır
   * ("rapor tebliğ edildi"): tebliğ tarihi HER ZAMAN sorulur (varsayılan
   * duruşma günü), takip işi kurulmaz.
   */
  serviceDateRequired?: boolean;
}

export const OUTCOMES: Record<OutcomeId, OutcomeDef> = {
  // Duruşma başka güne bırakıldı → yeni duruşma kaydı.
  ertelendi: { id: 'ertelendi', needsNextHearing: true },

  // Hâkim beyan/cevap/delil için süre verdi. Kesin süre çoğunlukla 2 haftadır
  // ama hâkimin verdiği süre değişebilir → kullanıcı düzenleyebilir.
  sure_verildi: {
    id: 'sure_verildi',
    needsNextHearing: false,
    deadlineDays: 14,
    deadlineKey: 'sure',
    basis: 'HMK 94',
  },

  // Rapor bekleniyor: henüz süre doğmaz (rapor tebliğ edilmedi).
  bilirkisi_bekleniyor: { id: 'bilirkisi_bekleniyor', needsNextHearing: true },

  // Bilirkişi raporuna itiraz: raporun tebliğinden itibaren 2 hafta (HMK 281/2).
  // 08.10.2026: süre eskiden DURUŞMA gününden sayılıyordu. Rapor duruşmadan
  // 10 gün önce tebliğ edildiyse son gün 10 gün GEÇ yazılıyordu (güvensiz
  // yön). Artık rapor tebliğ tarihi sorulur.
  bilirkisi_itiraz: {
    id: 'bilirkisi_itiraz',
    needsNextHearing: false,
    deadlineDays: 14,
    deadlineKey: 'bilirkisiItiraz',
    basis: 'HMK 281',
    serviceDateRequired: true,
  },

  // Karar açıklandı → istinaf süresi TEBLİĞDEN işler (HMK 345). Otomatik
  // hesaplanmaz; tebligat tarihi bilinmiyorsa takip hatırlatması kurulur.
  karar_aciklandi: {
    id: 'karar_aciklandi',
    needsNextHearing: false,
    deadlineDays: 14,
    deadlineKey: 'istinaf',
    basis: 'HMK 345',
    runsFromService: true,
  },

  // Duruşma yapılamadı (talik) → yeni gün.
  yapilamadi: { id: 'yapilamadi', needsNextHearing: true },
};

export const OUTCOME_ORDER: OutcomeId[] = [
  'ertelendi',
  'sure_verildi',
  'bilirkisi_itiraz',
  'bilirkisi_bekleniyor',
  'karar_aciklandi',
  'yapilamadi',
];

/** Tarihe gün ekler (saat/dakikayı korur). */
export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Yerel günün sonu (23:59). Kanuni süreler gün sonuna kadardır; görev formu da
 * (deadline-form) süreyi 23:59'a sabitler. Eskiden bu ekran süreyi duruşmanın
 * saatiyle ya da tebliğ tarihini seçtiğin ANIN saatiyle yazıyordu: son gün
 * "10:15'te" ya da "02:40'ta" dolmuş görünür, hatırlatma ve sıralama buna göre
 * kurulurdu (10.10.2026, denetçi bulgusu).
 */
export function gunSonu(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(23, 59, 0, 0);
  return x;
}

/** Tebligat takip işinin tarihi: duruşmadan 14 gün sonra, gün sonu. */
export function tebligatTakipTarihi(hearingDate: Date): Date {
  return gunSonu(addDays(hearingDate, 14));
}

/**
 * "Sonraki duruşma" için varsayılan: bugünden 30 gün sonra, BU duruşmanın
 * saatinde. Eskiden saat 09:30'a sabitti ve ekranda değiştirilemiyordu.
 */
export function varsayilanSonrakiDurusma(hearingDate: Date, now: Date = new Date()): Date {
  const d = addDays(now, 30);
  d.setHours(hearingDate.getHours(), hearingDate.getMinutes(), 0, 0);
  return d;
}

export interface PlannedDeadline {
  /** Sürenin son günü */
  dueAt: Date;
  /** Kanuni dayanak metni */
  basis?: string;
  /** i18n başlık eki */
  key: DeadlineKey;
  /** Süre tebliğden mi işliyor (kullanıcıya uyarı gösterilir)? */
  fromService: boolean;
}

/**
 * Seçilen sonuçtan süre planı üretir.
 * @param outcome seçilen sonuç
 * @param hearingDate duruşmanın tarihi
 * @param serviceDate tebligat tarihi (biliniyorsa) — tebliğden işleyen süreler için
 * @param overrideDays kullanıcı süreyi elle değiştirdiyse
 * @returns süre planı, yoksa null
 */
export function planDeadline(
  outcome: OutcomeId,
  hearingDate: Date,
  serviceDate?: Date | null,
  overrideDays?: number,
  kategori?: CourtCategory | null
): PlannedDeadline | null {
  const def = OUTCOMES[outcome];
  if (!def.deadlineDays || !def.deadlineKey) return null;
  const elle = overrideDays && overrideDays > 0 ? overrideDays : null;
  const days = elle ?? def.deadlineDays;

  if (def.runsFromService) {
    // Tebligat tarihi yoksa süre hesaplanamaz — takip işi olarak ele alınır.
    if (!serviceDate) return null;
    if (outcome === 'karar_aciklandi' && !elle) {
      // Kanun yolu süresi dosya türüne göre (hukuk HMK 345 / ceza CMK 273 /
      // idare İYUK 45) ve adli tatil kuralıyla — süre kataloğuyla aynı hesap.
      // Eskiden her dosya türüne "HMK 345, 14 gün" yazılıyordu.
      const tanim = istinafTanimi(kategori);
      const { due } = computeLegalDue(serviceDate, tanim.amount, tanim.unit, tanim.rule);
      return { dueAt: gunSonu(due), basis: tanim.basis, key: def.deadlineKey, fromService: true };
    }
    return { dueAt: gunSonu(addDays(serviceDate, days)), basis: def.basis, key: def.deadlineKey, fromService: true };
  }
  if (def.serviceDateRequired) {
    const base = serviceDate ?? hearingDate;
    return { dueAt: gunSonu(addDays(base, days)), basis: def.basis, key: def.deadlineKey, fromService: !!serviceDate };
  }
  return { dueAt: gunSonu(addDays(hearingDate, days)), basis: def.basis, key: def.deadlineKey, fromService: false };
}

/** Ekranda "kanuni: N gün" olarak gösterilen varsayılan süre. */
export function kanuniSureGun(outcome: OutcomeId, kategori?: CourtCategory | null): number | undefined {
  const def = OUTCOMES[outcome];
  if (outcome === 'karar_aciklandi') {
    const t = istinafTanimi(kategori);
    return t.unit === 'week' ? t.amount * 7 : t.unit === 'day' ? t.amount : def.deadlineDays;
  }
  return def.deadlineDays;
}

/**
 * Tebliğden işleyen bir süre var ama tebligat tarihi henüz bilinmiyor mu?
 * (Bu durumda süre yerine "tebligatı takip et" hatırlatması kurulur.)
 */
export function needsServiceWatch(outcome: OutcomeId, serviceDate?: Date | null): boolean {
  return !!OUTCOMES[outcome].runsFromService && !serviceDate;
}

/** Sonucu kaydedilmemiş (geçmiş ve tamamlanmamış) duruşmaları süzer. */
export function pendingOutcomeHearings<T extends { scheduled_at: string; is_completed: boolean }>(
  hearings: T[],
  now: Date = new Date()
): T[] {
  return hearings
    .filter((h) => !h.is_completed && new Date(h.scheduled_at) < now)
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
}

/**
 * ÇİFT KAYIT KORUMASI — bellekten değil VERİDEN.
 *
 * Ekran tek "Kaydet" ile birkaç yazma yapar. Ortada biri düşerse (adliyede çeken
 * hat) kullanıcı tekrar basar. Hangi adımın bittiği yalnız bellekte tutulduğu
 * için ekrandan çıkıp dönünce ya da uygulama kapanınca öncekiler BAŞTAN çalışır,
 * ikinci bir "sonraki duruşma" ve ikinci bir süre doğardı. Aşağıdaki iki kontrol
 * kayıtlı veriye bakar: aynı kayıt zaten varsa adım atlanır.
 */
export function ayniDurusmaVarMi(
  hearings: { case_id: string | null; scheduled_at: string }[],
  caseId: string | null,
  scheduledAtIso: string
): boolean {
  const t = new Date(scheduledAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return hearings.some((h) => h.case_id === caseId && new Date(h.scheduled_at).getTime() === t);
}

export function ayniSureVarMi(
  deadlines: { case_id: string | null; title: string; due_at: string }[],
  caseId: string | null,
  title: string,
  dueAtIso: string
): boolean {
  const t = new Date(dueAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return deadlines.some((d) => d.case_id === caseId && d.title === title && new Date(d.due_at).getTime() === t);
}

/** "Bunu atla": sıradaki bekleyene geç; sonda başa dön (atlananlar ulaşılamaz kalmasın). */
export function sonrakiSira(idx: number, length: number): number {
  if (length <= 0) return 0;
  return (idx + 1) % length;
}

/**
 * Bir duruşmanın sonucu kaydedildikten sonra ekran nereye gider?
 * `length` kayıt ÖNCESİ bekleyen sayısıdır. Kaydedilen listeden düşer; geriye
 * (atlanmış olanlar dahil) hiç kalmadıysa biter. Eskiden yalnız "son sıradayım"
 * bakılıyordu: atlanmış kayıtlar varken "Bekleyen duruşma kalmadı. Süreleriniz
 * güncel!" deniyor ve boş ekran açılıyordu.
 */
export function kayittanSonra(idx: number, length: number): { bitti: boolean; idx: number } {
  const kalan = length - 1;
  if (kalan <= 0) return { bitti: true, idx: 0 };
  return { bitti: false, idx: idx >= kalan ? 0 : idx };
}
