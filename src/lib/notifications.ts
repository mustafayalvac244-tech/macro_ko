import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getLang, translate } from '@/i18n';
import { formatDateTime } from '@/utils/format';

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
    [id, `${id}-3d`, `${id}-1d`].map((identifier) =>
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
    { suffix: '-3d', minutes: 3 * DAY_MINUTES, title: translate(lang, 'notif.stage3d', { title: params.mainTitle }) },
    { suffix: '-1d', minutes: 1 * DAY_MINUTES, title: translate(lang, 'notif.stage1d', { title: params.mainTitle }) },
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

export function hearingReminderId(hearingId: string): string {
  return `hearing-${hearingId}`;
}

export function deadlineReminderId(deadlineId: string): string {
  return `deadline-${deadlineId}`;
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

export function promiseReminderId(promiseId: string): string {
  return `promise-${promiseId}`;
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
