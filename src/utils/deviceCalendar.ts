import { Platform } from 'react-native';

// 'added'       → etkinlik telefon takvimine yazıldı
// 'denied'      → kullanıcı takvim iznini reddetti
// 'unavailable' → expo-calendar native modülü bu binary'de yok (eski sürüm)
// 'error'       → modül var ama etkinlik oluşturulamadı (izin/takvim sorunu)
export type DeviceCalendarResult = 'added' | 'denied' | 'unavailable' | 'error';

/**
 * Duruşma/toplantıyı telefonun takvimine yazar.
 *
 * expo-calendar native bir modüldür; modül gerçekten yoksa 'unavailable' döner
 * (yalnızca bu durumda "uygulamayı güncelleyin" denir). Modül varsa ama başka
 * bir hata olursa 'error' döner — böylece güncel sürümdeki kullanıcıya yanlışlıkla
 * "yeni sürüm gerekiyor" denmez.
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
    if (!Calendar || typeof Calendar.requestCalendarPermissionsAsync !== 'function') {
      return 'unavailable';
    }
  } catch {
    return 'unavailable';
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';

    // Yazılabilir bir takvim bul. getDefaultCalendarAsync() bazı iOS
    // kurulumlarında hata fırlattığı için doğrudan takvim listesinden seçiyoruz.
    let calendarId: string | null = null;
    try {
      const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = all.filter((c) => c.allowsModifications);
      calendarId =
        writable.find((c) => (c as { isPrimary?: boolean }).isPrimary)?.id ??
        writable.find((c) => c.source?.name === 'iCloud')?.id ??
        writable[0]?.id ??
        null;
    } catch {
      calendarId = null;
    }

    // iOS: liste boşsa varsayılan takvimi dene (son çare).
    if (!calendarId && Platform.OS === 'ios') {
      try {
        const def = await Calendar.getDefaultCalendarAsync();
        calendarId = def?.id ?? null;
      } catch {
        calendarId = null;
      }
    }
    if (!calendarId) return 'error';

    const start = new Date(opts.startISO);
    if (Number.isNaN(start.getTime())) return 'error';
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
    return 'error';
  }
}
