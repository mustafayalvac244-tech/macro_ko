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
  scheduledAt: string;
  reminderMinutesBefore: number;
}): Promise<void> {
  await scheduleStagedReminders({
    baseId: hearingReminderId(params.id),
    eventAt: params.scheduledAt,
    chosenMinutesBefore: params.reminderMinutesBefore,
    mainTitle: translate(getLang(), 'notif.hearingTitle', { title: params.hearingTitle }),
    body: `${params.caseTitle} — ${formatDateTime(params.scheduledAt)}`,
  });
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
