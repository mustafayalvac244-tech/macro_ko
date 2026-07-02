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
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
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
  const triggerAt = new Date(new Date(params.scheduledAt).getTime() - params.reminderMinutesBefore * 60_000);
  await scheduleReminder({
    id: hearingReminderId(params.id),
    title: translate(getLang(), 'notif.hearingTitle', { title: params.hearingTitle }),
    body: `${params.caseTitle} — ${formatDateTime(params.scheduledAt)}`,
    triggerAt,
  });
}

export async function scheduleDeadlineReminder(params: {
  id: string;
  caseTitle: string;
  deadlineTitle: string;
  dueAt: string;
  reminderMinutesBefore: number;
}): Promise<void> {
  const triggerAt = new Date(new Date(params.dueAt).getTime() - params.reminderMinutesBefore * 60_000);
  await scheduleReminder({
    id: deadlineReminderId(params.id),
    title: translate(getLang(), 'notif.deadlineTitle', { title: params.deadlineTitle }),
    body: `${params.caseTitle} — ${formatDateTime(params.dueAt)}`,
    triggerAt,
  });
}
