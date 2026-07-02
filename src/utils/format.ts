import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { getLang, translate } from '@/i18n';

function dateLocale() {
  return getLang() === 'tr' ? trLocale : enUS;
}

export function formatDate(iso: string): string {
  const pattern = getLang() === 'tr' ? 'd MMM yyyy' : 'MMM d, yyyy';
  return format(new Date(iso), pattern, { locale: dateLocale() });
}

export function formatDateTime(iso: string): string {
  return getLang() === 'tr'
    ? format(new Date(iso), 'd MMM yyyy HH:mm', { locale: dateLocale() })
    : format(new Date(iso), "MMM d, yyyy 'at' h:mm a", { locale: dateLocale() });
}

export function formatTime(iso: string): string {
  const pattern = getLang() === 'tr' ? 'HH:mm' : 'h:mm a';
  return format(new Date(iso), pattern, { locale: dateLocale() });
}

export function relativeDueLabel(iso: string): string {
  const lang = getLang();
  const date = new Date(iso);
  if (isToday(date)) return `${translate(lang, 'fmt.today')} · ${formatTime(iso)}`;
  if (isTomorrow(date)) return `${translate(lang, 'fmt.tomorrow')} · ${formatTime(iso)}`;
  if (isPast(date)) {
    return `${translate(lang, 'fmt.overdue')} · ${formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale() })}`;
  }
  return translate(lang, 'fmt.in', { d: formatDistanceToNowStrict(date, { locale: dateLocale() }) });
}

export function isOverdue(iso: string): boolean {
  return isPast(new Date(iso)) && !isToday(new Date(iso));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
