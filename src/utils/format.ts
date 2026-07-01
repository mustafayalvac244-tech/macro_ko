import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from 'date-fns';

export function formatDate(iso: string, pattern = 'MMM d, yyyy'): string {
  return format(new Date(iso), pattern);
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

export function relativeDueLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `Today · ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, 'h:mm a')}`;
  if (isPast(date)) return `Overdue · ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
  return `In ${formatDistanceToNowStrict(date)}`;
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
