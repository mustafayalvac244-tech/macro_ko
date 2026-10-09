/**
 * MASRAF AVANSI AÇIĞI — ana ekran uyarısının hesabı, saf ve sınanabilir.
 *
 * NEDEN AYRI DOSYA (09.10.2026 denetimi). Hesap useAdvanceDeficits içindeydi
 * ve beş sorgunun hiçbirinin hatasına bakmıyordu (`adv.data ?? []`):
 *  - avans sorgusu düşünce yatırılan avans 0 sayılıyor, masrafı olan HER
 *    müvekkil "ek avans istenmeli" diye listeleniyordu (yanlış alarm);
 *  - dava sorgusu düşünce dava masrafları kimseye yazılmıyor, gerçek açık
 *    gizleniyordu (kaçan uyarı).
 * Doğrusu: bir parça bile eksikse hesap YAPILMAZ, sorgunun kendi hatası
 * fırlatılır; react-query sorguyu hatalı sayar ve uyarı kartı çizilmez.
 *
 * Testler: tests/avansAcigi.test.ts.
 */

/** Masraf avansı eksiye düşen müvekkil. */
export interface AdvanceDeficit {
  id: string;
  name: string;
  /** Pozitif tutar: istenmesi gereken ek avans. */
  deficit: number;
}

/** Supabase sorgu sonucunun bize gereken kısmı. */
export interface SorguSonucu<T> {
  data: T[] | null;
  error: unknown;
}

export interface AvansVerisi {
  musteriler: SorguSonucu<{ id: string; full_name: string; company: string | null }>;
  avanslar: SorguSonucu<{ client_id: string; amount: number }>;
  musteriMasraflari: SorguSonucu<{ client_id: string; amount: number }>;
  davalar: SorguSonucu<{ id: string; client_id: string | null }>;
  davaMasraflari: SorguSonucu<{ case_id: string; amount: number }>;
}

export function avansAciklari(v: AvansVerisi): AdvanceDeficit[] {
  // KISMİ VERİYLE HESAP YOK: ilk hatalı sorgunun hatası olduğu gibi fırlatılır
  // (isMissingAdvanceTable onun kodunu okuyup yeniden denemeye karar veriyor).
  for (const sonuc of [v.musteriler, v.avanslar, v.musteriMasraflari, v.davalar, v.davaMasraflari]) {
    if (sonuc.error) throw sonuc.error;
  }

  const nameById = new Map((v.musteriler.data ?? []).map((c) => [c.id, c.company || c.full_name]));
  const deposited = new Map<string, number>();
  const spent = new Map<string, number>();
  const add = (m: Map<string, number>, id: string | null | undefined, amt: number) => {
    if (id) m.set(id, (m.get(id) ?? 0) + amt);
  };

  // Yatırılan avanslar
  (v.avanslar.data ?? []).forEach((r) => add(deposited, r.client_id, Number(r.amount)));
  // Elle girilen müvekkil masrafları
  (v.musteriMasraflari.data ?? []).forEach((r) => add(spent, r.client_id, Number(r.amount)));
  // Davaya bağlı masraflar (case_expenses → cases.client_id)
  const clientOfCase = new Map((v.davalar.data ?? []).map((c) => [c.id, c.client_id]));
  (v.davaMasraflari.data ?? []).forEach((r) => add(spent, clientOfCase.get(r.case_id) ?? null, Number(r.amount)));

  const out: AdvanceDeficit[] = [];
  const ids = new Set<string>([...deposited.keys(), ...spent.keys()]);
  ids.forEach((id) => {
    const balance = (deposited.get(id) ?? 0) - (spent.get(id) ?? 0);
    if (balance < 0) out.push({ id, name: nameById.get(id) ?? '—', deficit: -balance });
  });
  return out.sort((a, b) => b.deficit - a.deficit);
}
