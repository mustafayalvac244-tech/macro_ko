/**
 * BU HAFTA — günlere göre duruşma ve süre sayısı (06.10.2026, ürün sahibinin
 * paylaştığı bento panosundaki haftalık çubuk grafiğin Vekil karşılığı;
 * tasarim/ilham/fernly-ozellikler.md, kare 01 ve 10).
 *
 * SAF tutuldu (react-native yok): vitest doğrudan okusun.
 *
 * Hafta PAZARTESİ başlar (Türkiye). Tamamlanmış duruşma ve süreler de
 * sayılır: grafik "bu haftanın yükü"nü gösterir, yalnız kalanı değil —
 * pazartesi geçmiş duruşma sayılmasa haftanın başı hep boş görünürdü.
 * Gün, cihazın yerel saatine göre ayrılır (takvim ekranıyla aynı).
 */
export interface HaftaGunu {
  /** Yerel tarih, YYYY-AA-GG. */
  tarih: string;
  /** 0 = pazartesi … 6 = pazar. */
  sira: number;
  durusma: number;
  sure: number;
  bugun: boolean;
}

const gunAnahtari = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** İçinde bulunulan haftanın pazartesisi, yerel 00:00. */
export function haftaBasi(simdi: Date): Date {
  const d = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  const geri = (d.getDay() + 6) % 7; // pazar 0 → 6 gün geri
  d.setDate(d.getDate() - geri);
  return d;
}

export function haftaYuku(
  durusmalar: readonly { scheduled_at: string }[],
  sureler: readonly { due_at: string }[],
  simdi: Date = new Date(),
): HaftaGunu[] {
  const bas = haftaBasi(simdi);
  const bugun = gunAnahtari(simdi);
  const gunler: HaftaGunu[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + i);
    const tarih = gunAnahtari(d);
    return { tarih, sira: i, durusma: 0, sure: 0, bugun: tarih === bugun };
  });
  const yer = new Map(gunler.map((g) => [g.tarih, g]));
  for (const h of durusmalar) {
    const d = new Date(h.scheduled_at);
    if (isNaN(d.getTime())) continue;
    const g = yer.get(gunAnahtari(d));
    if (g) g.durusma += 1;
  }
  for (const s of sureler) {
    const d = new Date(s.due_at);
    if (isNaN(d.getTime())) continue;
    const g = yer.get(gunAnahtari(d));
    if (g) g.sure += 1;
  }
  return gunler;
}
