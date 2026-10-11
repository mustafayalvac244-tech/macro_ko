/**
 * DAVA FORMU (app/case-form.tsx) — saf kurallar, react-native'e BAĞIMSIZ.
 * tests/davaFormu.test.ts kilitler. Hepsi 09.10.2026 denetiminde kodla
 * doğrulanmış kusurlardır.
 */
import type { TKey } from '@/i18n';
import type { CaseStatus, FeeType } from '@/types/database';
import { planLimitiCoz } from '@/config/planlar';
import { trError } from '@/lib/authErrors';
import { oranOku, tutarOku } from './tutar';

// ─── Durum ───────────────────────────────────────────────────────────────
// Formda yalnız Açık/Kapalı seçicisi var; veritabanında altı durum var
// (active, pending, on_hold, closed, won, lost). Form eskiden yüklerken
// durumu ikiye indirip kaydederken onu yazıyordu: "bekliyor"/"askıda" dava
// başlığı düzeltilip kaydedilince "aktif"e, "kazanıldı"/"kaybedildi" dava
// "kapalı"ya dönüyordu — kullanıcı durum seçicisine hiç dokunmadan.

export type DurumSecimi = 'active' | 'closed';

const KAPALI_DURUMLAR: readonly CaseStatus[] = ['closed', 'won', 'lost'];

/** Veritabanı durumunun formdaki Açık/Kapalı karşılığı. */
export function durumSecimi(durum: CaseStatus): DurumSecimi {
  return KAPALI_DURUMLAR.includes(durum) ? 'closed' : 'active';
}

/**
 * Kaydedilecek durum: seçim kayıtlı durumun grubuyla aynıysa kayıtlı durum
 * KORUNUR; kullanıcı Açık/Kapalı'yı değiştirdiyse seçim yazılır.
 */
export function kaydedilecekDurum(orijinal: CaseStatus | null | undefined, secim: DurumSecimi): CaseStatus {
  return orijinal && durumSecimi(orijinal) === secim ? orijinal : secim;
}

// ─── Ücret ───────────────────────────────────────────────────────────────
// Ücret türüne göre farklı kutular görünüyor ama kayıtta ÜÇÜ BİRDEN
// yazılıyordu. "Sabit 50.000" yazıp "Yüzde %15"e geçen avukatın davasına
// görünmeyen fee_amount = 50.000 kaydediliyordu; dava ekranındaki "Tahsil
// edilecek" ve müvekkil toplamı (useClientFinance) bu tutardan hesaplanıyor.
// Görünmeyen kutudaki okunamayan bir değer de kaydı, kullanıcının göremediği
// bir kutu yüzünden durduruyordu.

type Kutular = { tutar: boolean; oran: boolean; avans: boolean };

/** Her ücret türünde formda GÖRÜNEN kutular — app/case-form.tsx'teki kutularla AYNI olmalı. */
export const UCRET_KUTULARI: Record<FeeType, Kutular> = {
  fixed: { tutar: true, oran: false, avans: false },
  percentage: { tutar: false, oran: true, avans: false },
  advance_percentage: { tutar: false, oran: true, avans: true },
  retainer: { tutar: true, oran: false, avans: false },
  retainer_success: { tutar: true, oran: true, avans: false },
};

// Formun tanımadığı bir tür (eski/elle yazılmış kayıt) gelirse hiçbir kutu
// gösterilmiyor; gösteremediğimiz veriyi silmeyiz, olduğu gibi geri yazarız.
const BILINMEYEN_TUR: Kutular = { tutar: true, oran: true, avans: true };

export type UcretSonucu =
  | { tamam: true; fee_amount: number | null; fee_percent: number | null; fee_advance: number | null }
  | { tamam: false; okunamayan: string };

/** Ücret alanlarını türe göre okur: görünmeyen kutu null yazılır ve doğrulanmaz. */
export function ucretAlanlari(
  tur: FeeType | string,
  girdi: { tutar: string; oran: string; avans: string },
): UcretSonucu {
  const k = (UCRET_KUTULARI as Record<string, Kutular>)[tur] ?? BILINMEYEN_TUR;
  const tutar = k.tutar ? girdi.tutar.trim() : '';
  const avans = k.avans ? girdi.avans.trim() : '';
  const oran = k.oran ? girdi.oran.trim() : '';
  // "50.000" eskiden 50, "1.250.000" sessizce boş kaydediliyordu (08.10.2026).
  const okunamayan = [tutar, avans].find((v) => v && !Number.isFinite(tutarOku(v)))
    ?? (oran && !Number.isFinite(oranOku(oran)) ? oran : undefined);
  if (okunamayan) return { tamam: false, okunamayan };
  return {
    tamam: true,
    fee_amount: tutar ? tutarOku(tutar) || null : null,
    fee_percent: oran ? oranOku(oran) || null : null,
    fee_advance: avans ? tutarOku(avans) || null : null,
  };
}

// ─── Düzenleme formunun doldurulması ─────────────────────────────────────
// Form `existingCase` NESNESİNE bağlıydı. useUpdateCase iyimser güncellemede
// önbelleği yamalıyor, hata olursa eski nesneyi geri koyuyor: ikisi de aynı
// davanın YENİ bir nesnesi. Kayıt hata verince form kayıtlı (eski) değerlerle
// yeniden dolduruluyor, kullanıcının yazdıkları siliniyordu.

/** Form yalnız ilk yüklemede ya da BAŞKA bir dava açıldığında doldurulur. */
export function formDoldurulsunMu(doldurulanId: string | null, dava: { id: string } | null | undefined): boolean {
  return !!dava && dava.id !== doldurulanId;
}

// ─── Yeni dava + ilk duruşma ─────────────────────────────────────────────
// Dava yazılıp ilk duruşma yazılamayınca form "Dava kaydedilemedi, tekrar
// deneyin" diyor ve açık kalıyordu; avukat tekrar basınca İKİNCİ bir dava
// açılıyordu. Artık oluşan dava geri verilir; ekran onu tutar ve sonraki
// basışta davayı yeniden oluşturmaz, formdaki son hâli ona yazar ve yalnız
// duruşmayı yeniden dener.

export interface YeniDavaIslemleri<D extends { id: string }> {
  olustur: () => Promise<D>;
  /** Önceki denemede oluşmuş davaya formdaki son hâli yazar. */
  guncelle: (dava: D) => Promise<D>;
  /** İlk duruşma seçilmediyse verilmez. */
  durusmaEkle?: (dava: D) => Promise<unknown>;
}

export type YeniDavaSonucu<D> = { tamam: true; dava: D } | { tamam: false; dava: D; durusmaHatasi: unknown };

/** Dava yazılamazsa fırlatır (dava oluşmadı); duruşma yazılamazsa oluşan davayla döner. */
export async function yeniDavaKaydet<D extends { id: string }>(
  onceki: D | null,
  islemler: YeniDavaIslemleri<D>,
): Promise<YeniDavaSonucu<D>> {
  const dava = onceki ? await islemler.guncelle(onceki) : await islemler.olustur();
  if (islemler.durusmaEkle) {
    try {
      await islemler.durusmaEkle(dava);
    } catch (durusmaHatasi) {
      return { tamam: false, dava, durusmaHatasi };
    }
  }
  return { tamam: true, dava };
}

// ─── Kayıt hatası metni ──────────────────────────────────────────────────
// PostgREST hataları düz nesne olarak gelir (postgrest-js 2.110: `error =
// JSON.parse(body)`), `instanceof Error` değildir. Form bu yüzden plan
// limitinde de "Dava kaydedilemedi. Lütfen tekrar deneyin." yazıyordu —
// tekrar denemek hiçbir zaman işe yaramaz. Hata bir Error olarak gelseydi
// trError tanımadığı 'plan_limiti:dava:5' kodunu olduğu gibi gösterirdi.

type Ceviri = (anahtar: TKey, degerler?: Record<string, string | number>) => string;

export function davaKayitHatasi(err: unknown, t: Ceviri): string {
  const mesaj = (err as { message?: unknown } | null)?.message;
  const limit = planLimitiCoz(typeof mesaj === 'string' ? mesaj : null);
  if (limit) {
    // Anahtarlar saveError.notifySaveError'daki pencereyle aynı.
    return limit.limit === 0
      ? t(`plan.kapali.${limit.tur}` as TKey)
      : t(`plan.doldu.${limit.tur}` as TKey, { n: String(limit.limit) });
  }
  return err instanceof Error ? trError(err.message) : t('caseForm.saveFailed');
}
