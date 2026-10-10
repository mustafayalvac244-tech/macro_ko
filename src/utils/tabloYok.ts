/**
 * "TABLO YOK" TEŞHİSİ — saf, testli (tests/tabloYok.test.ts).
 *
 * BULUNAN KUSUR (10.10.2026). `isMissingTimeTable` ve `isMissingFinanceTable`,
 * hata MESAJINDA tablo adı geçiyorsa "tablo kurulmamış" sayıyordu. Postgres
 * kısıt ve RLS hataları da tablo adını taşır ("new row for relation
 * "time_entries" violates check constraint …"): kayıt reddedilince avukata
 * "tablo henüz kurulmamış" yazılıyordu. Ayrıca 42P01/PGRST205 kodu hangi
 * tablo için olursa olsun yeterli sayılıyordu.
 *
 * KURAL. Tablonun YOKLUĞUNU söyleyen iki şey vardır:
 *  - Postgres 42P01 (undefined_table), PostgREST PGRST205 (şema önbelleğinde
 *    tablo yok) — mesaj bu tablonun adını taşıyorsa (ya da mesaj yoksa);
 *  - kod gelmediyse, mesajın "does not exist" / "could not find the table"
 *    diyip bu tablonun adını anması.
 * Başka her hata (kısıt, RLS, ağ, zaman aşımı) "tablo yok" DEĞİLDİR.
 */
export function tabloYokMu(err: unknown, tablo: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  const kod = typeof e.code === 'string' ? e.code : '';
  const mesaj = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const ad = tablo.toLowerCase();

  if (kod === '42P01' || kod === 'PGRST205') {
    return mesaj === '' || mesaj.includes(ad);
  }
  if (kod !== '') return false; // başka bir kodla gelen hata (23514, 42501 …) tablo yokluğu değildir
  return mesaj.includes(ad) && /does not exist|could not find the table/.test(mesaj);
}
