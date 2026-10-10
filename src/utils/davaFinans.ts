/**
 * DAVA DETAYI — FİNANS SEKMESİ HESAPLARI (09.10.2026): vekalet ücreti özeti,
 * taksit numarası, masraf avansı bakiyesi.
 *
 * Saf mantık; ekran: app/(app)/cases/[id].tsx (Finans sekmesi).
 * Testler: tests/davaFinans.test.ts.
 */
import type { FeeType } from '@/types/database';

/*
 * YÜKLENEMEYEN LİSTE ₺0 SAYILMAZ (bulunan kusur). Ekran `(liste ?? [])` ile
 * topluyordu: masraf listesi yüklenemeyince harcanan ₺0, "Kalan" avansın
 * tamamı; ödeme/taksit listesi yüklenemeyince "Tahsil Edilen ₺0", "Tahsil
 * Edilecek" ücretin tamamı görünüyordu — ve hata hiçbir yerde söylenmiyordu.
 * Liste yoksa sonuç `null` (ekranda "—" ve yüklenemedi notu).
 */

/** Tahsil edilen = ödemeler + "ödendi" işaretli taksitler. */
export function tahsilEdilenToplam(
  odemeler: ReadonlyArray<{ amount: number }> | undefined,
  taksitler: ReadonlyArray<{ amount: number; is_paid: boolean }> | undefined,
): number | null {
  if (!odemeler || !taksitler) return null;
  const odenen = odemeler.reduce((s, p) => s + Number(p.amount), 0);
  return odenen + taksitler.filter((i) => i.is_paid).reduce((s, i) => s + Number(i.amount), 0);
}

/** Masraf avansı: yatırılan avans, harcanan, kalan (eksi olabilir). */
export function masrafAvansiOzeti(
  avans: number | null | undefined,
  masraflar: ReadonlyArray<{ amount: number }> | undefined,
): { avans: number; harcanan: number | null; kalan: number | null } {
  const yatirilan = Number(avans ?? 0);
  if (!masraflar) return { avans: yatirilan, harcanan: null, kalan: null };
  const harcanan = masraflar.reduce((s, e) => s + Number(e.amount), 0);
  return { avans: yatirilan, harcanan, kalan: yatirilan - harcanan };
}

/**
 * "Tahsil Edilecek" kutusu. YALNIZ toplamı belli olan ücret tipinde (sabit
 * tutar) hesaplanır; diğerlerinde `null` → ekranda "—".
 *
 * BULUNAN KUSUR (denetimde bulundu, kodla doğrulandı). Ekran her tipte
 * `fee_amount − tahsil edilen` yazıyordu:
 *  - Sabit danışmanlıkta `fee_amount` AYLIK tutar. Hiç ödeme yokken
 *    "₺10.000", üç ay ödendiyse "₺0" çıkıyordu; ikisi de anlamsız.
 *  - Yüzde / peşin+yüzde tiplerinde `fee_amount` formdan kalan eski değer
 *    olabiliyor (form tip değişince gizlenen ücret kutusunu da kaydediyor);
 *    ekran onu toplam ücret sanıyordu. Toplam, davanın sonucuna bağlı.
 *
 * Aylık danışmanlıkta birikmiş alacağın (ay sayısı × aylık − tahsil edilen)
 * nasıl sayılacağı bir ürün kararıdır (hangi aydan başlar, kapanışta durur
 * mu); karar verilmeden sayı uydurulmaz.
 */
export function tahsilEdilecek(
  feeType: FeeType | null | undefined,
  feeAmount: number | null | undefined,
  tahsilEdilen: number | null,
): number | null {
  if ((feeType ?? 'fixed') !== 'fixed' || feeAmount == null || tahsilEdilen == null) return null;
  return Math.max(0, Number(feeAmount) - tahsilEdilen);
}

/**
 * Yeni taksitin sıra numarası: en büyük numara + 1.
 *
 * Eskiden `liste uzunluğu + 1` idi: 1-2-3'ten 2 silinince yeni taksit yine
 * "3" oluyor, ekranda iki "Taksit 3" görünüyordu.
 */
export function sonrakiTaksitNo(taksitler: ReadonlyArray<{ seq: number }>): number {
  return taksitler.reduce((enBuyuk, t) => Math.max(enBuyuk, Number(t.seq) || 0), 0) + 1;
}
