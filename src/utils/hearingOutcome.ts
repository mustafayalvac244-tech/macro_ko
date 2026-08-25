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
  bilirkisi_itiraz: {
    id: 'bilirkisi_itiraz',
    needsNextHearing: false,
    deadlineDays: 14,
    deadlineKey: 'bilirkisiItiraz',
    basis: 'HMK 281',
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
  overrideDays?: number
): PlannedDeadline | null {
  const def = OUTCOMES[outcome];
  if (!def.deadlineDays || !def.deadlineKey) return null;
  const days = overrideDays && overrideDays > 0 ? overrideDays : def.deadlineDays;

  if (def.runsFromService) {
    // Tebligat tarihi yoksa süre hesaplanamaz — takip işi olarak ele alınır.
    if (!serviceDate) return null;
    return { dueAt: addDays(serviceDate, days), basis: def.basis, key: def.deadlineKey, fromService: true };
  }
  return { dueAt: addDays(hearingDate, days), basis: def.basis, key: def.deadlineKey, fromService: false };
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
