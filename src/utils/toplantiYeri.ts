/**
 * TOPLANTI / ARABULUCULUK YERİNİ KAYITTAN GERİ ÇÖZ (08.10.2026).
 *
 * BULUNAN KUSUR (denetimde bulundu, kodla doğrulandı). Form yeri tek bir
 * metin olarak yazıyor ("Müvekkil adresi — Kadıköy ..." ya da "Arabulucu ·
 * Online") ama düzenlemede bu metni seçeneklere geri ÇÖZMÜYORDU: seçenekler
 * varsayılanda ('ofis') kalıyor, yalnız saati değiştirip kaydeden avukatın
 * toplantı yeri sessizce "Ofis" oluyor, adres kayboluyordu.
 */
export type ToplantiYeri = 'ofis' | 'online' | 'muvekkil_adresi' | 'diger';
export type ArabuluculukKim = 'taraf' | 'arabulucu';

export function toplantiYeriCoz(
  kayit: string | null | undefined,
  etiket: (y: ToplantiYeri) => string
): { yer: ToplantiYeri; ek: string } {
  const loc = (kayit ?? '').trim();
  if (!loc) return { yer: 'ofis', ek: '' };
  for (const y of ['muvekkil_adresi', 'diger', 'online', 'ofis'] as ToplantiYeri[]) {
    const e = etiket(y);
    if (loc === e) return { yer: y, ek: '' };
    if (loc.startsWith(`${e} — `)) return { yer: y, ek: loc.slice(e.length + 3) };
  }
  // Tanınmayan (başka dilde yazılmış ya da elle girilmiş) yer KAYBOLMAZ.
  return { yer: 'diger', ek: loc };
}

export function arabuluculukCoz(
  kayit: string | null | undefined,
  kimEtiket: (k: ArabuluculukKim) => string,
  yerEtiket: (y: 'ofis' | 'online') => string
): { kim: ArabuluculukKim; yer: 'ofis' | 'online' } | null {
  const [k, y] = (kayit ?? '').split(' · ');
  const kim = (['taraf', 'arabulucu'] as ArabuluculukKim[]).find((x) => kimEtiket(x) === k?.trim());
  const yer = (['ofis', 'online'] as const).find((x) => yerEtiket(x) === y?.trim());
  return kim && yer ? { kim, yer } : null;
}
