import { Linking } from 'react-native';
import { formatDate, formatTime } from '@/utils/format';

/**
 * Müvekkile Hatırlat — duruşma/görev hatırlatmasını WhatsApp (yoksa SMS) ile
 * müvekkile gönderir. Native bağımlılık yok (Linking çekirdek modül) →
 * OTA güncellemesiyle çalışır.
 */

/**
 * Türk telefon numarasını WhatsApp'ın beklediği uluslararası biçime çevirir
 * (ülke kodu dahil, + ve boşluklar olmadan). Örn:
 *   "0532 123 45 67"  → "905321234567"
 *   "+90 532 123 4567" → "905321234567"
 *   "532 123 4567"     → "905321234567"
 */
export function normalizePhoneForWa(raw: string): string {
  let d = (raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('90')) return d; // zaten ülke kodlu
  if (d.startsWith('0')) d = d.slice(1); // baştaki 0'ı at
  if (d.length === 10) return `90${d}`; // 5xxxxxxxxx → 90 5xxxxxxxxx
  return d; // yabancı/bilinmeyen numara: olduğu gibi bırak
}

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
    const canWa = await Linking.canOpenURL(waUrl);
    if (canWa) {
      await Linking.openURL(waUrl);
      return 'whatsapp';
    }
  } catch {
    // WhatsApp açılamadı → SMS'e düş
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
