import { Linking } from 'react-native';
import { formatDate, formatTime } from '@/utils/format';
import { normalizePhoneForWa } from '@/utils/telefon';

// Numara normalleştirme saf modüle taşındı (test edilebilsin diye).
export { normalizePhoneForWa };

/**
 * Müvekkile Hatırlat — duruşma/görev hatırlatmasını WhatsApp (yoksa SMS) ile
 * müvekkile gönderir. Native bağımlılık yok (Linking çekirdek modül) →
 * OTA güncellemesiyle çalışır.
 */

export interface HearingReminderParams {
  clientName: string;
  caseTitle: string;
  /** Duruşma/keşif türü etiketi (ör. "Duruşma", "Keşif"). */
  typeLabel: string;
  /** ISO tarih-saat (scheduled_at). */
  scheduledAt: string;
  court?: string | null;
  /** İmza için avukat/büro adı (varsa). */
  lawyerName?: string | null;
}

/** Profesyonel, kısa ve nazik bir Türkçe hatırlatma metni üretir. */
export function hearingReminderMessage(p: HearingReminderParams): string {
  const dateStr = formatDate(p.scheduledAt);
  const timeStr = formatTime(p.scheduledAt);
  const lines: string[] = [];
  lines.push(`Sayın ${p.clientName},`);
  lines.push('');
  let core = `"${p.caseTitle}" dosyanızla ilgili ${p.typeLabel.toLocaleLowerCase('tr-TR')} ${dateStr} ${timeStr} saatinde`;
  if (p.court && p.court.trim()) core += ` ${p.court.trim()}'nde`;
  core += ' görülecektir.';
  lines.push(core);
  lines.push('');
  lines.push('Belirtilen tarihte hazır bulunmanızı rica ederiz.');
  if (p.lawyerName && p.lawyerName.trim()) {
    lines.push('');
    lines.push(`Saygılarımızla,\n${p.lawyerName.trim()}`);
  }
  return lines.join('\n');
}

export type ReminderResult = 'whatsapp' | 'sms' | 'no_phone' | 'failed';

/**
 * Mesajı önce WhatsApp'ta açmayı dener; WhatsApp kurulu değilse SMS'e düşer.
 * Kullanıcı mesajı gözden geçirip kendi gönderir (gönderim otomatik değildir).
 */
export async function sendClientReminder(rawPhone: string | null | undefined, message: string): Promise<ReminderResult> {
  const phone = (rawPhone ?? '').trim();
  if (!phone) return 'no_phone';

  const waNumber = normalizePhoneForWa(phone);
  const waUrl = `whatsapp://send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
  try {
    // WHATSAPP HİÇ AÇILMIYORDU — canOpenURL kaldırıldı.
    //
    // Burada önce Linking.canOpenURL(waUrl) çağrılıyor, yalnız true dönerse
    // WhatsApp açılıyordu. Ama canOpenURL özel bir şema için platformdan İZİN
    // ister: iOS'ta Info.plist'teki LSApplicationQueriesSchemes, Android
    // 11+'ta manifest'teki <queries>. app.json'da İKİSİ DE tanımlı değildi
    // (kontrol edildi), yani canOpenURL her iki platformda da HER ZAMAN false
    // dönüyordu. Sonuç: WhatsApp kurulu olsa bile özellik sessizce SMS'e
    // düşüyordu — "WhatsApp ile gönder" diyen bir düğme hiçbir zaman WhatsApp
    // açmıyordu.
    //
    // Çözüm doğrudan openURL denemek: WhatsApp yoksa zaten hata fırlatır ve
    // aşağıdaki SMS yoluna düşeriz. Bu, izin listesine hiç ihtiyaç duymaz ve
    // MEVCUT derlemelerde de çalışır (OTA ile gider).
    //
    // ── 15.09.2026: app.json'daki `android.queries` KALDIRILDI ────────────
    // "İleride canOpenURL kullanan biri aynı tuzağa düşmesin" diye eklenmişti
    // ama Expo yapılandırma şemasında `android.queries` diye bir alan YOK:
    // `npx expo-doctor` bunu şema hatası olarak veriyordu
    //     "Field: android - should NOT have additional property 'queries'"
    // Yani blok koruma sağlamıyordu; yalnız yapılandırmayı geçersiz kılıyordu.
    // iOS tarafındaki karşılığı (`ios.infoPlist.LSApplicationQueriesSchemes`)
    // GEÇERLİ bir alan ve DURUYOR.
    //
    // İleride Android'de canOpenURL gerekirse: manifest'e <queries> eklemek
    // bir CONFIG PLUGIN işidir (withAndroidManifest), app.json alanı değil.
    // O yazılmadan canOpenURL Android'de yine false döner.
    await Linking.openURL(waUrl);
    return 'whatsapp';
  } catch {
    // WhatsApp kurulu değil / açılamadı → SMS'e düş
  }

  const smsNumber = phone.replace(/[^\d+]/g, '');
  const smsUrl = `sms:${smsNumber}?body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(smsUrl);
    return 'sms';
  } catch {
    return 'failed';
  }
}
