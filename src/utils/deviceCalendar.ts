import { Platform } from 'react-native';

export type DeviceCalendarResult = 'added' | 'denied' | 'unavailable';

/**
 * Duruşma/toplantıyı telefonun takvimine yazar.
 *
 * expo-calendar native bir modüldür; eski binary'lerde (Build ≤ 10) bulunmaz.
 * Bu yüzden statik import yerine çağrı ANINDA lazy require edilir ve her hata
 * 'unavailable' olarak yutulur — eski sürümler çökmek yerine "uygulamayı
 * güncelleyin" mesajı gösterebilir.
 */
export async function addToDeviceCalendar(opts: {
  title: string;
  startISO: string;
  durationMinutes?: number;
  location?: string | null;
  notes?: string | null;
}): Promise<DeviceCalendarResult> {
  let Calendar: typeof import('expo-calendar');
  try {
    Calendar = require('expo-calendar');
  } catch {
    return 'unavailable';
  }
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';

    let calendarId: string | null = null;
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      calendarId = def?.id ?? null;
    }
    if (!calendarId) {
      const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      calendarId =
        all.find((c) => c.allowsModifications && c.isPrimary)?.id ??
        all.find((c) => c.allowsModifications)?.id ??
        null;
    }
    if (!calendarId) return 'unavailable';

    const start = new Date(opts.startISO);
    if (Number.isNaN(start.getTime())) return 'unavailable';
    const end = new Date(start.getTime() + (opts.durationMinutes ?? 60) * 60 * 1000);

    await Calendar.createEventAsync(calendarId, {
      title: opts.title,
      startDate: start,
      endDate: end,
      location: opts.location ?? undefined,
      notes: opts.notes ?? undefined,
      timeZone: 'Europe/Istanbul',
      alarms: [{ relativeOffset: -60 }],
    });
    return 'added';
  } catch {
    return 'unavailable';
  }
}
