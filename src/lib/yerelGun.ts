/**
 * Cihazın YEREL takvim günü, YYYY-AA-GG.
 *
 * 25.09.2026: iki yerde `new Date().toISOString().slice(0, 10)` vardı. Bu
 * UTC günüdür; Türkiye'de gece 00:00–03:00 arasında bir ÖNCEKİ günü verir.
 * Bir finans kaydının ya da dosya adının tarihi bir gün geri kayıyordu.
 */
export function yerelGunISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}
