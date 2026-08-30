import { Platform } from 'react-native';

// 'added'       → etkinlik telefon takvimine eklendi
// 'canceled'    → kullanıcı vazgeçti / izin vermedi
// 'unavailable' → expo-calendar native modülü bu binary'de yok (eski sürüm)
// 'error'       → modül var ama etkinlik oluşturulamadı
export type DeviceCalendarResult = 'added' | 'canceled' | 'unavailable' | 'error';

/**
 * Duruşma/toplantıyı telefonun takvimine ekler.
 *
 * expo-calendar 57'de varsayılan giriş noktası yeni (nesne tabanlı) API'dir ve
 * eski `requestCalendarPermissionsAsync`/`createEventAsync` metotları çalışma
 * anında hata fırlatır. Bu yüzden gerçek implementasyon için `expo-calendar/legacy`
 * kullanılır.
 *
 * Öncelik: OS'un kendi "Yeni Etkinlik" ekranını açan `createEventInCalendarAsync`.
 * Bu yol iOS 17'nin yalnızca-yazma (write-only) erişimiyle de çalışır ve takvim
 * listesini okumaya ihtiyaç duymaz — asıl "Takvime eklenemedi" hatasının kaynağı buydu.
 */
export async function addToDeviceCalendar(opts: {
  title: string;
  startISO: string;
  durationMinutes?: number;
  location?: string | null;
  notes?: string | null;
}): Promise<DeviceCalendarResult> {
  let Calendar: typeof import('expo-calendar/legacy');
  try {
    Calendar = require('expo-calendar/legacy');
    if (!Calendar) return 'unavailable';
  } catch {
    return 'unavailable';
  }

  const start = new Date(opts.startISO);
  if (Number.isNaN(start.getTime())) return 'error';
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 60) * 60 * 1000);
  const eventData = {
    title: opts.title,
    startDate: start,
    endDate: end,
    location: opts.location ?? undefined,
    notes: opts.notes ?? undefined,
    timeZone: 'Europe/Istanbul',
    alarms: [{ relativeOffset: -60 }],
  };

  // 1) OS'un sunduğu "Yeni Etkinlik" ekranı (write-only erişimle çalışır).
  if (typeof Calendar.createEventInCalendarAsync === 'function') {
    try {
      const res = await Calendar.createEventInCalendarAsync(eventData);
      return res?.action === 'canceled' ? 'canceled' : 'added';
    } catch {
      // native ekran açılamazsa aşağıdaki doğrudan yola düş.
    }
  }

  // 2) Yedek: izin iste + yazılabilir bir takvime doğrudan yaz.
  try {
    if (typeof Calendar.requestCalendarPermissionsAsync !== 'function') return 'unavailable';
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'canceled';

    let calendarId: string | null = null;
    try {
      const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = all.filter((c) => c.allowsModifications);
      calendarId =
        writable.find((c) => (c as { isPrimary?: boolean }).isPrimary)?.id ?? writable[0]?.id ?? null;
    } catch {
      calendarId = null;
    }
    if (!calendarId && Platform.OS === 'ios') {
      try {
        calendarId = (await Calendar.getDefaultCalendarAsync())?.id ?? null;
      } catch {
        calendarId = null;
      }
    }
    if (!calendarId) return 'error';

    await Calendar.createEventAsync(calendarId, eventData);
    return 'added';
  } catch {
    return 'error';
  }
}
