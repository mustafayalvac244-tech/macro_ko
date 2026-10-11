import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';

/**
 * TAKVİM GÜNDEMİ — saf ve sınanabilir (09.10.2026 denetimi).
 *
 * GÜNDEM UFKU KULLANICIYA SÖYLENİR. Gündem görünümü bugünden itibaren 90 gün
 * gösteriyordu ve bunu hiçbir yerde söylemiyordu: 91. gündeki duruşma listede
 * yoktu; 90 gün içinde kayıt yoksa ekran "Önümüzdeki günlerde planlı işlem
 * yok" diyordu. Ufuk duruyor (taksit planları yıllar ileriye uzanabiliyor,
 * liste sonsuz uzamasın) ama ötesindeki kayıtlar SAYILIYOR; ekran sayıyı
 * yazıp "Tümünü göster" sunuyor.
 *
 * Testler Türkiye saatinde koşar: tests/gundem.test.ts.
 */

/** Gündem görünümünün varsayılan ufku (gün). */
export const GUNDEM_UFKU_GUN = 90;

/**
 * Haftanın ilk günü: PAZARTESİ (Türkiye). Ay takvimi (`firstDay`) ve hafta
 * şeridi (`weekStartsOn`) bu tek sabiti kullanır; eskiden şerit pazartesiden,
 * ay görünümü kütüphane varsayılanıyla pazardan başlıyordu.
 */
export const HAFTA_BASLANGICI = 1 as const;

/** Ufkun son günü (dahil), yerel gün anahtarı. Öğlen üzerinden: gün kaymaz. */
export function gundemUfku(bugunKey: string): string {
  return format(addDays(new Date(`${bugunKey}T12:00:00`), GUNDEM_UFKU_GUN), 'yyyy-MM-dd');
}

export interface GundemSonucu<T> {
  /** Bugünden ufka kadar (ufuk null ise sonuna kadar) günlere göre gruplar. */
  gruplar: { dateKey: string; items: T[] }[];
  /** Ufuktan SONRAKİ açık kayıt sayısı — ekranda söylenir. */
  ufukSonrasi: number;
}

/**
 * Açık (tamamlanmamış) ve bugün/sonrası kayıtları gün gün gruplar.
 * `kayitlar` tarih sırasında gelmelidir (ekran sıralı veriyor).
 * `ufukKey` null → ufuk yok ("Tümünü göster").
 */
export function gundemGruplari<T extends { dateKey: string; done: boolean }>(
  kayitlar: T[],
  bugunKey: string,
  ufukKey: string | null,
): GundemSonucu<T> {
  const gruplar: { dateKey: string; items: T[] }[] = [];
  let ufukSonrasi = 0;
  for (const it of kayitlar) {
    if (it.done || it.dateKey < bugunKey) continue;
    if (ufukKey !== null && it.dateKey > ufukKey) {
      ufukSonrasi++;
      continue;
    }
    const son = gruplar[gruplar.length - 1];
    if (son && son.dateKey === it.dateKey) son.items.push(it);
    else gruplar.push({ dateKey: it.dateKey, items: [it] });
  }
  return { gruplar, ufukSonrasi };
}
