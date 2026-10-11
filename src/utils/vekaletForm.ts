// VEKALET EKRANI (app/vekalet.tsx) için saf yardımcılar — vitest doğrudan okur.
import { tarihCevir } from '@/utils/iceAktarim';
import type { PoaStatus } from '@/hooks/usePowersOfAttorney';

/**
 * Düzenleme tarihi girdisi → veritabanı biçimi (YYYY-AA-GG).
 *
 * Eskiden yalnız tam "YYYY-AA-GG" kabul ediliyordu; avukatın doğal yazdığı
 * "15.01.2026" SESSİZCE null kaydediliyordu (09.10.2026 denetimi). Şimdi:
 * boş → null (isteğe bağlı), geçerli GG.AA.YYYY / ISO → çevrilir,
 * tanınmayan ya da takvimde olmayan gün → ok:false (çağıran kullanıcıya söyler).
 */
export function duzenlemeTarihi(ham: string): { ok: true; value: string | null } | { ok: false } {
  const s = ham.trim();
  if (!s) return { ok: true, value: null };
  const v = tarihCevir(s);
  return v ? { ok: true, value: v } : { ok: false };
}

/**
 * Müvekkil seçici süzgeci. Eskiden listenin ilk 30'u gösteriliyordu; 31. ve
 * sonrası müvekkil için vekâlet kaydı HİÇ açılamıyordu. Sınır yok; arama
 * Türkçe büyük/küçük harfe (İ/ı) duyarlıdır.
 */
export function musteriFiltrele<T extends { full_name: string }>(liste: T[], arama: string): T[] {
  const q = arama.trim().toLocaleLowerCase('tr');
  if (!q) return liste;
  return liste.filter((c) => (c.full_name ?? '').toLocaleLowerCase('tr').includes(q));
}

const iki = (n: number) => String(n).padStart(2, '0');

/**
 * Durum değişikliği yaması. status_date bugünün YEREL tarihidir (toISOString
 * UTC'dir; gece yarısına yakın bir tarih Türkiye'de bir gün geri kayardı).
 * "aktif"e dönüşte tarih temizlenir.
 */
export function durumGuncellemesi(
  durum: PoaStatus,
  simdi: Date,
): { status: PoaStatus; status_date: string | null } {
  if (durum === 'aktif') return { status: durum, status_date: null };
  return { status: durum, status_date: `${simdi.getFullYear()}-${iki(simdi.getMonth() + 1)}-${iki(simdi.getDate())}` };
}
