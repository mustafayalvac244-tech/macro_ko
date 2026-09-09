import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getLang, translate } from '@/i18n';
import { formatDateTime } from '@/utils/format';
import { EK_1_GUN, EK_3_GUN, planBildirimId, tetikGuncelMi, type PlanliBildirim } from '@/utils/bildirimPlani';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'legal-deadlines';

export async function registerForNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Hearings & Deadlines',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B6FE0',
    });
  }

  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  return finalStatus === 'granted';
}

interface ScheduleReminderParams {
  id: string;
  title: string;
  body: string;
  triggerAt: Date;
}

/**
 * Schedules a single local notification, identified by `id`, so that
 * re-scheduling (on edit) is a cancel-then-create rather than a duplicate.
 */
export async function scheduleReminder({ id, title, body, triggerAt }: ScheduleReminderParams): Promise<void> {
  await cancelReminder(id);
  if (triggerAt.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  // Cancel the main reminder plus the staged 3-day/1-day companions.
  await Promise.all(
    [id, `${id}${EK_3_GUN}`, `${id}${EK_1_GUN}`].map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})
    )
  );
}

const DAY_MINUTES = 24 * 60;

/**
 * Staged reminders: in addition to the user-chosen offset, schedule automatic
 * "3 days left" and "1 day left" notifications (skipping duplicates with the
 * chosen offset and any triggers already in the past).
 */
async function scheduleStagedReminders(params: {
  baseId: string;
  eventAt: string;
  chosenMinutesBefore: number;
  mainTitle: string;
  body: string;
}): Promise<void> {
  const eventTime = new Date(params.eventAt).getTime();
  const lang = getLang();

  const stages: { suffix: string; minutes: number; title: string }[] = [
    { suffix: '', minutes: params.chosenMinutesBefore, title: params.mainTitle },
    { suffix: EK_3_GUN, minutes: 3 * DAY_MINUTES, title: translate(lang, 'notif.stage3d', { title: params.mainTitle }) },
    { suffix: EK_1_GUN, minutes: 1 * DAY_MINUTES, title: translate(lang, 'notif.stage1d', { title: params.mainTitle }) },
  ];

  const seen = new Set<number>();
  for (const stage of stages) {
    if (seen.has(stage.minutes)) continue;
    seen.add(stage.minutes);
    await scheduleReminder({
      id: `${params.baseId}${stage.suffix}`,
      title: stage.title,
      body: params.body,
      triggerAt: new Date(eventTime - stage.minutes * 60_000),
    });
  }
}

/**
 * BİLDİRİM KİMLİKLERİ TEK YERDEN ÜRETİLİR.
 *
 * Bu şema burada ve plan üreticisinde (utils/bildirimPlani.ts) AYRI AYRI
 * yazılsaydı, birinde yapılan bir değişiklik diğerini sessizce bozardı: plan
 * "hearing-x-1d" derken burası "hearing-x-1gun" kursa, eşitleme her açılışta
 * doğru bildirimi iptal edip yenisini kurar ve hiçbir hata görünmezdi. Bu
 * yüzden şemanın tek sahibi bildirimPlani.ts'tir; burası ona sorar.
 */
export function hearingReminderId(hearingId: string): string {
  return planBildirimId('durusma', hearingId, 'secilen');
}

export function deadlineReminderId(deadlineId: string): string {
  return planBildirimId('gorev', deadlineId, 'secilen');
}

export async function scheduleHearingReminder(params: {
  id: string;
  caseTitle: string;
  hearingTitle: string;
  /** Kayıt türü (hearing/mediation/deposition…) — bildirim başlığı buna göre yazılır. */
  type?: string;
  scheduledAt: string;
  reminderMinutesBefore: number;
}): Promise<void> {
  const lang = getLang();
  // Bildirim başlığı kayıt türünü yansıtsın: Arabuluculuk Toplantısı, Keşif,
  // Duruşma vb. — hepsine "duruşma" demesin (alıcı geri bildirimi).
  const typeLabel = params.type
    ? translate(lang, `hearingType.${params.type}` as Parameters<typeof translate>[1])
    : translate(lang, 'hearingType.hearing');
  await scheduleStagedReminders({
    baseId: hearingReminderId(params.id),
    eventAt: params.scheduledAt,
    chosenMinutesBefore: params.reminderMinutesBefore,
    mainTitle: translate(lang, 'notif.hearingTitle', { type: typeLabel, title: params.hearingTitle }),
    body: `${params.caseTitle} — ${formatDateTime(params.scheduledAt)}`,
  });
}

/**
 * DURUŞMADAN SONRA SORAN BİLDİRİM — süre kaydının eksik halkası.
 *
 * ÖLÇÜLEN ARIZA (canlı veri): 49 duruşma kaydına karşılık 9 süre kaydı; geçmiş
 * 23 duruşmanın 22'si "tamamlandı" bile işaretlenmemiş. Dört ayrı avukatta,
 * temmuz-eylül aralığında. Yani duruşmada verilen süreler uygulamaya HİÇ
 * girmiyor — ve süre kaçırmak, avukatın mesleki sorumluluğunun ana kaynağı.
 *
 * Mekanizma zaten vardı: duruşma çıkışı ekranı da, ana ekrandaki hatırlatma
 * kartı da yazılmıştı. Eksik olan, doğru ANDA sormaktı. Duruşmadan çıkan avukat
 * uygulamayı açıp kart aramaz; kart ancak uygulamayı zaten açtıysa görünür.
 *
 * SORULACAK AN: duruşmadan iki saat sonra. Duruşma sırasında sormak rahatsız
 * eder, ertesi güne bırakmak unutturur. İki saat, adliyeden çıkıp yolda olmaya
 * denk gelen makul bir aralık.
 *
 * Bildirime dokunmak duruşma çıkışı ekranını açar; oradan tek dokunuşla süre
 * kaydedilir.
 */
export function hearingOutcomeId(hearingId: string): string {
  return planBildirimId('durusma', hearingId, 'sonuc');
}

/** Duruşmadan kaç dakika sonra sorulacağı. */
const OUTCOME_DELAY_MINUTES = 120;

export async function scheduleHearingOutcomePrompt(params: {
  id: string;
  caseTitle: string;
  hearingTitle: string;
  type?: string;
  scheduledAt: string;
}): Promise<void> {
  const triggerAt = new Date(new Date(params.scheduledAt).getTime() + OUTCOME_DELAY_MINUTES * 60_000);
  // Geçmiş duruşma için bildirim kurulamaz; kurulsa da anında düşerdi.
  if (triggerAt.getTime() <= Date.now()) return;
  const lang = getLang();
  const typeLabel = params.type
    ? translate(lang, `hearingType.${params.type}` as Parameters<typeof translate>[1])
    : translate(lang, 'hearingType.hearing');
  await scheduleReminder({
    id: hearingOutcomeId(params.id),
    title: translate(lang, 'notif.outcomeTitle', { type: typeLabel }),
    body: translate(lang, 'notif.outcomeBody', { title: params.caseTitle || params.hearingTitle }),
    triggerAt,
  });
}

export function promiseReminderId(promiseId: string): string {
  return planBildirimId('soz', promiseId, 'secilen');
}

/** Payment-promise reminder: fires on the morning of the due date + 3d/1d before. */
export async function schedulePromiseReminder(params: {
  id: string;
  clientName: string;
  amountLabel: string;
  dueDate: string; // yyyy-MM-dd
}): Promise<void> {
  const eventAt = `${params.dueDate}T09:00:00`;
  await scheduleStagedReminders({
    baseId: promiseReminderId(params.id),
    eventAt,
    chosenMinutesBefore: 0,
    mainTitle: translate(getLang(), 'notif.promiseTitle', { name: params.clientName }),
    body: translate(getLang(), 'notif.promiseBody', { amount: params.amountLabel, name: params.clientName }),
  });
}

export async function cancelPromiseReminder(promiseId: string): Promise<void> {
  await cancelReminder(promiseReminderId(promiseId));
}

export async function scheduleDeadlineReminder(params: {
  id: string;
  caseTitle: string;
  deadlineTitle: string;
  dueAt: string;
  reminderMinutesBefore: number;
}): Promise<void> {
  await scheduleStagedReminders({
    baseId: deadlineReminderId(params.id),
    eventAt: params.dueAt,
    chosenMinutesBefore: params.reminderMinutesBefore,
    mainTitle: translate(getLang(), 'notif.deadlineTitle', { title: params.deadlineTitle }),
    body: `${params.caseTitle} — ${formatDateTime(params.dueAt)}`,
  });
}

// ---------- Plan uygulama: sunucudaki kayıtlardan kendini onaran eşitleme ----------

/**
 * KENDİNİ ONARAN HATIRLATMA EŞİTLEMESİ.
 *
 * Kusur: hatırlatmalar yalnız kayıt oluşturulurken/düzenlenirken, o cihazda
 * kuruluyordu. Yerel bildirim cihaza aittir — uygulama silinip kurulunca,
 * telefon değişince ya da bildirim izni sonradan verilince hepsi yok olur, ama
 * duruşmalar sunucuda durur. Avukat ajandasında duruşmayı görür ve hatırlatma
 * kurulu sanır. Sessiz ve tam kayıp.
 *
 * Bu fonksiyon planı (bkz. utils/bildirimPlani.ts) mevcut durumla KARŞILAŞTIRIR:
 * planda olmayan bizim bildirimlerimizi iptal eder, eksik olanları kurar. Her
 * seferinde hepsini silip yeniden kurmaz — gereksiz yüz kadar yerel çağrıdan
 * kaçınır ve halihazırda doğru kurulmuş bildirime dokunmaz.
 *
 * İçerik güncelliği: bir duruşmanın başlığı değişirse o kaydın bildirimi zaten
 * düzenleme sırasında yeniden kurulur (useUpdateHearing); buradaki eşitleme
 * EKSİĞİ tamamlamak içindir.
 */
const BIZIM_ONEKLER = ['hearing-', 'deadline-', 'promise-'] as const;
export type BildirimOneki = (typeof BIZIM_ONEKLER)[number];

export interface PlanKaynak {
  /** Ana başlık: duruşma/görev adı ya da müvekkil adı. */
  baslik: string;
  /** Alt satır: dava adı ya da tutar etiketi. */
  altBaslik: string;
  anISO: string;
  /** Duruşma türü (hearing/mediation/deposition…) — yalnız duruşmalarda. */
  hearingType?: string;
}

function planIcerigi(
  bildirim: PlanliBildirim,
  kaynak: PlanKaynak
): { title: string; body: string } {
  const lang = getLang();
  if (bildirim.etkinlikTuru === 'soz') {
    return {
      title: translate(lang, 'notif.promiseTitle', { name: kaynak.baslik }),
      body: translate(lang, 'notif.promiseBody', { amount: kaynak.altBaslik, name: kaynak.baslik }),
    };
  }

  if (bildirim.tur === 'sonuc') {
    const typeLabel = translate(
      lang,
      `hearingType.${kaynak.hearingType ?? 'hearing'}` as Parameters<typeof translate>[1]
    );
    return {
      title: translate(lang, 'notif.outcomeTitle', { type: typeLabel }),
      body: translate(lang, 'notif.outcomeBody', { title: kaynak.altBaslik || kaynak.baslik }),
    };
  }

  const anaBaslik =
    bildirim.etkinlikTuru === 'durusma'
      ? translate(lang, 'notif.hearingTitle', {
          type: translate(lang, `hearingType.${kaynak.hearingType ?? 'hearing'}` as Parameters<typeof translate>[1]),
          title: kaynak.baslik,
        })
      : translate(lang, 'notif.deadlineTitle', { title: kaynak.baslik });

  const title =
    bildirim.tur === '3g'
      ? translate(lang, 'notif.stage3d', { title: anaBaslik })
      : bildirim.tur === '1g'
        ? translate(lang, 'notif.stage1d', { title: anaBaslik })
        : anaBaslik;

  return { title, body: `${kaynak.altBaslik} — ${formatDateTime(kaynak.anISO)}` };
}

/**
 * Planı uygular. Bildirim izni yoksa HİÇBİR ŞEY YAPMAZ — özellikle iptal de
 * etmez: izin geri verildiğinde eşitleme yeniden çalışıp eksiği tamamlar.
 */
export async function syncEtkinlikBildirimleri(
  plan: PlanliBildirim[],
  kaynaklar: Map<string, PlanKaynak>,
  /**
   * YALNIZ VERİSİNE SAHİP OLDUĞUMUZ TÜRLERE DOKUNULUR.
   *
   * DÜZELTİLEN KUSUR (kendi değişikliğimde bulundu). Eşitleme, planda olmayan
   * her bildirimi iptal ediyordu. Ama plan yalnız ELDE VERİSİ OLAN kayıtlardan
   * üretiliyor: ödeme sözleri sorgusu henüz yüklenmemişse ya da kalıcı olarak
   * başarısızsa (payment_promises tablosu hiç kurulmamış olabilir — koddaki
   * isMissingPromiseTable yolu) plan hiç 'promise-' bildirimi içermez ve
   * eşitleme kurulu TÜM ödeme hatırlatmalarını siler. Yükleme sırasında bu
   * gelip geçici bir çırpınma, tablo yoksa KALICI kayıptır.
   *
   * Çağıran taraf artık hangi türlerin verisine sahip olduğunu bildiriyor;
   * bilmediğimiz türe ait bildirimlere dokunulmuyor.
   */
  yonetilenOnekler: readonly BildirimOneki[] = BIZIM_ONEKLER
): Promise<{ kuruldu: number; iptal: number }> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return { kuruldu: 0, iptal: 0 };

  const mevcut = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const bizim = mevcut.filter((n) => yonetilenOnekler.some((p) => n.identifier.startsWith(p)));
  const planIds = new Set(plan.map((p) => p.bildirimId));

  let iptal = 0;
  for (const n of bizim) {
    if (planIds.has(n.identifier)) continue;
    await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    iptal++;
  }

  /**
   * SAATİ ESKİMİŞ BİLDİRİM DE YENİLENİR.
   *
   * Burası önce yalnız "kimlik kurulu mu?" diye bakıyordu ve kurulu olanın
   * SAATİ yanlış olsa bile ona dokunmuyordu. Somut arıza: duruşma A telefonunda
   * 10:00'dan 14:00'e alınıyor, B telefonunda kimlik zaten kurulu olduğu için
   * atlanıyor ve B telefonu hatırlatmayı ESKİ saatte çalıyordu. Bir ay
   * ertelenen duruşmada B telefonu bir ay erken çalıp bir daha hiç çalmazdı.
   * Aynı cihazdaki düzenleme bu yoldan geçmez (orada iptal-et-yeniden-kur
   * zaten var); bu boşluk çok cihaz ve yedekten dönme durumlarına aitti.
   */
  const mevcutIds = new Set<string>();
  const planlananAn = new Map(plan.map((p) => [p.bildirimId, p.tetikMs]));
  for (const n of bizim) {
    const hedef = planlananAn.get(n.identifier);
    if (hedef === undefined) continue; // yukarıda iptal edildi
    if (tetikGuncelMi(n.trigger, hedef)) {
      mevcutIds.add(n.identifier);
      continue;
    }
    // Saati kaymış: iptal et, aşağıdaki döngü doğru saatle yeniden kursun.
    await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    iptal++;
  }

  let kuruldu = 0;
  for (const p of plan) {
    if (mevcutIds.has(p.bildirimId)) continue;
    const kaynak = kaynaklar.get(p.kaynakId);
    if (!kaynak) continue;
    const { title, body } = planIcerigi(p, kaynak);
    await Notifications.scheduleNotificationAsync({
      identifier: p.bildirimId,
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(p.tetikMs),
        channelId: CHANNEL_ID,
      },
    })
      .then(() => {
        kuruldu++;
      })
      .catch(() => {});
  }

  return { kuruldu, iptal };
}

/**
 * ÇIKIŞTA TÜM KURULU BİLDİRİMLERİ İPTAL EDER.
 *
 * BULUNAN SIZINTI. Bildirim METİNLERİ müvekkil ve dava adı taşıyor ("Yaklaşan
 * Duruşma: ...", "Ödeme günü: <müvekkil adı>"). Bunlar cihazda kurulu yerel
 * bildirimlerdir ve oturumla hiçbir bağları yoktur: avukat çıkış yaptıktan
 * sonra da tetiklenmeye devam ederler. Ortak kullanılan ya da devredilen bir
 * telefonda, bir sonraki kullanıcının kilit ekranında önceki avukatın müvekkil
 * adı belirir. Sır saklama açısından bu, önbellek artığından daha ağırdır —
 * çünkü kimsenin bakmasına gerek yok, kendiliğinden görünür.
 *
 * Yeniden giriş yapıldığında hatırlatmalar zaten sunucudaki kayıtlardan
 * yeniden kuruluyor (useReminderSync), yani iptal etmenin bir bedeli yok.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// ---------- Sabah ajanda özeti (morning digest) ----------

const DIGEST_PREFIX = 'digest-';
const DIGEST_HOUR = 7;
const DIGEST_MINUTE = 30;

/** Ajanda etkinliklerini türüne göre kovalara ayırır — hepsine "duruşma" DEME. */
export type DigestBucket = 'durusma' | 'toplanti' | 'kesif' | 'evrak' | 'diger';

/** Kayıt türünü (hearing/mediation/keşif…) özet kovasına eşler. */
export function digestBucket(type?: string | null): DigestBucket {
  switch (type) {
    case 'hearing':
    case 'trial':
      return 'durusma';
    case 'mediation':
    case 'meeting':
      return 'toplanti';
    case 'deposition':
      return 'kesif';
    case 'filing':
      return 'evrak';
    default:
      return 'diger';
  }
}

export interface DigestDay {
  /** YYYY-MM-DD local date key */
  dateKey: string;
  /** Etkinlik sayıları türüne göre (duruşma/toplantı/keşif…). */
  buckets: Record<DigestBucket, number>;
  tasks: number;
  firstEventLabel?: string;
}

/**
 * Schedules a 07:30 local notification for each of the next days that has
 * hearings or tasks. Re-syncing cancels every previous digest first, so the
 * schedule always mirrors the current agenda.
 */
export async function syncMorningDigests(days: DigestDay[]): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(DIGEST_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  const lang = getLang();
  const BUCKET_ORDER: DigestBucket[] = ['durusma', 'toplanti', 'kesif', 'evrak', 'diger'];
  for (const day of days) {
    const eventTotal = BUCKET_ORDER.reduce((s, b) => s + (day.buckets[b] ?? 0), 0);
    if (eventTotal === 0 && day.tasks === 0) continue;
    const [y, m, d] = day.dateKey.split('-').map(Number);
    const triggerAt = new Date(y, m - 1, d, DIGEST_HOUR, DIGEST_MINUTE, 0, 0);
    if (triggerAt.getTime() <= Date.now()) continue;

    const parts: string[] = [];
    // Her tür kendi doğru adıyla sayılır: "2 duruşma, 1 toplantı" gibi.
    for (const b of BUCKET_ORDER) {
      const n = day.buckets[b] ?? 0;
      if (n > 0) parts.push(translate(lang, `digest.${b}` as Parameters<typeof translate>[1], { n }));
    }
    if (day.tasks > 0) parts.push(translate(lang, 'digest.tasks', { n: day.tasks }));
    let body = parts.join(', ');
    if (day.firstEventLabel) body += `\n${translate(lang, 'digest.first', { label: day.firstEventLabel })}`;

    await Notifications.scheduleNotificationAsync({
      identifier: `${DIGEST_PREFIX}${day.dateKey}`,
      content: { title: translate(lang, 'digest.title'), body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
        channelId: CHANNEL_ID,
      },
    }).catch(() => {});
  }
}
