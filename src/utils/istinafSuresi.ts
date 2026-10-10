/**
 * DOSYA DETAYI — istinaf son günü, TEK KAYNAKTAN (08.10.2026).
 *
 * BULUNAN KUSUR (50 denetçi taraması, kodla doğrulandı). Dosya detayı
 * istinaf süresini kendi içinde sabit yazıyordu: ceza 7 gün (CMK 273),
 * idare 30 gün ama adli tatil kuralı 'civil'. Uygulamanın süre kataloğu
 * (constants/legalDeadlines, 7445 s.K. sonrası) ve testleri ise ceza
 * istinafını İKİ HAFTA, idari istinafı 'idari' tatil kuralıyla hesaplıyor.
 * Aynı uygulama aynı süre için iki farklı son gün veriyordu. Ceza
 * dosyasında tebliğ 05.01.2026 → dosya detayı 12.01, katalog 19.01.
 *
 * Artık süre, dayanak ve tatil kuralı katalogdan okunur; ekran sabit
 * tutmaz. Süre değişirse tek yer değişir.
 */
import { LEGAL_DEADLINES, type LegalDeadlineDef } from '@/constants/legalDeadlines';
import type { CourtCategory } from '@/types/database';
import { computeLegalDue, recessRuleForDeadline, type RecessRule } from '@/utils/legalDates';

export interface IstinafTanimi extends LegalDeadlineDef {
  rule: RecessRule;
}

export function istinafTanimi(kategori: CourtCategory | null | undefined): IstinafTanimi {
  const id = kategori === 'ceza' ? 'istinaf-ceza' : kategori === 'idare' ? 'idari-istinaf' : 'istinaf-hukuk';
  const tanim = LEGAL_DEADLINES.find((d) => d.id === id);
  if (!tanim) throw new Error(`süre kataloğunda yok: ${id}`);
  return { ...tanim, rule: recessRuleForDeadline(tanim) };
}

/** Tebliğ tarihinden istinaf son günü (yerel saatle 17:00). */
export function istinafSonGunu(tebligTarihi: Date, kategori: CourtCategory | null | undefined): Date {
  const tanim = istinafTanimi(kategori);
  const due = new Date(computeLegalDue(tebligTarihi, tanim.amount, tanim.unit, tanim.rule).due);
  due.setHours(17, 0, 0, 0);
  return due;
}
