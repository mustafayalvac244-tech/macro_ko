// SAYAÇ — ekibin Excel'indeki "Scores" paneli: model başına denetlenen araç,
// demerit ve Audit Skoru; bugün, bu hafta, geçen hafta, bu ay, bu yıl.
//
// Tarihçe. 24.10.2026: ürün sahibi Excel formunun fotoğrafını attı ("araç
// baktıkça sayıyor, ekliyor; o sistem güzel"); skorun formülü fotoğraftan
// okunamadığı için DPU (araç başına hata) seçilmişti. 26.10.2026: Excel'in
// kendisi geldi, ürün sahibi "içeriği buna göre yap, Excel'de her şey var"
// dedi. Makro okundu; buradaki tanımlar ONUN tanımları:
//  - Audit Skoru = round(100 × Σ DEMERIT / denetlenen araç) (nas.ts).
//  - Yalnız PROBLEM SOURCE = AUDIT olan araçlar ve problemler sayılır;
//    DURABILITY, 3M - DEALER CLAIM vb. skora girmez.
//  - G. Hafta = geçen pazartesi–pazar. Hafta pazartesi başlar.
//  - Excel'in "Problem" satırı aslında Σ DEMERIT; burada adıyla "demerit".
// DPU kalktı.
//
// Excel'den BİLEREK farklı (makro hatası, kopyalanmadı): Excel'in "Bu Ay"ı
// yıla bakmıyor (bütün yılların aynı ayı toplanıyor) ve BJ satırına toplam
// yazılıyor. Burada ay o yılın ayıdır, her model yalnız kendini sayar. Bu
// yüzden sayılar Excel'dekiyle aynı ÇIKMAYABİLİR.
//
// KAPSAM: yalnız BU CİHAZIN kayıtları — merkezi sunucu yok. Hatasız biten
// araç da denetlenen araç sayılır (Excel'deki "Problem Yok Aracı Kaydet").
// YALNIZ BİTMİŞ DENETİM (26.10.2026): devam eden denetim de sayılıyordu; hiç
// hata girilmemiş, yeni açılmış bir denetim skoru düşürüyordu (dış
// değerlendirmede saha denetçisi ve kalite müdürü ayrı ayrı gördü). Excel'e
// araç bitince yazılır; burada da yalnız "tamamlandı" sayılır.
//
// Dönem sınırları CİHAZIN YEREL SAATİYLE: gün gece yarısı, hafta PAZARTESİ
// başlar (Türkiye). Denetim başladığı ana göre sayılır.

import { auditSkoru, skoraGirerMi } from './nas';

export type Donem = 'bugun' | 'buHafta' | 'gecenHafta' | 'buAy' | 'buYil';

/** Excel'deki sırayla: Bugün / Bu Hafta / G. Hafta / Bu Ay / Bu Yıl. */
export const DONEMLER: readonly { id: Donem; ad: string; uzun: string; en: string; enUzun: string }[] = [
  { id: 'bugun', ad: 'Bugün', uzun: 'Bugün', en: 'Today', enUzun: 'Today' },
  { id: 'buHafta', ad: 'Bu hafta', uzun: 'Bu hafta', en: 'This wk', enUzun: 'This week' },
  { id: 'gecenHafta', ad: 'G. hafta', uzun: 'Geçen hafta', en: 'Last wk', enUzun: 'Last week' },
  { id: 'buAy', ad: 'Bu ay', uzun: 'Bu ay', en: 'This mo', enUzun: 'This month' },
  { id: 'buYil', ad: 'Bu yıl', uzun: 'Bu yıl', en: 'This yr', enUzun: 'This year' },
];

export interface SayacGirdisi {
  aracId: string;
  /** ISO 8601 — denetimin başladığı an. */
  baslangic: string;
  /** Problem adedi (kayıtların adet toplamı). */
  hataAdedi: number;
  /** Σ DEMERIT × adet. */
  demerit: number;
  /** Denetimin PROBLEM SOURCE'u. Yoksa AUDIT sayılır (en eski kayıtlar). */
  kaynak?: string;
  /** 'devam' ise sayılmaz (araç henüz bitmedi). Yoksa bitmiş sayılır. */
  durum?: string;
}

export interface Sayi { arac: number; hata: number; demerit: number }

/** Audit Skoru; araç yoksa null ("0" yazmak yanıltır). */
export function skor(x: Sayi): number | null {
  return auditSkoru(x.demerit, x.arac);
}

export type DonemSayilari = Record<Donem, Sayi>;

export interface SayacSonucu {
  /** Sayılan dönemlerde en az bir denetimi olan araçlar, verilen sırayla. */
  araclar: { aracId: string; sayilar: DonemSayilari }[];
  toplam: DonemSayilari;
}

const sifir = (): Sayi => ({ arac: 0, hata: 0, demerit: 0 });
const bos = (): DonemSayilari => ({
  bugun: sifir(), buHafta: sifir(), gecenHafta: sifir(), buAy: sifir(), buYil: sifir(),
});

/** Dönemlerin başlangıç anları, yerel saatle. */
export function donemBaslangiclari(simdi: Date): Record<Donem, Date> {
  const gun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  // getDay: pazar 0. Pazartesi başlangıcına kaç gün geri gidilir?
  const geri = (gun.getDay() + 6) % 7;
  return {
    bugun: gun,
    buHafta: new Date(gun.getFullYear(), gun.getMonth(), gun.getDate() - geri),
    gecenHafta: new Date(gun.getFullYear(), gun.getMonth(), gun.getDate() - geri - 7),
    buAy: new Date(simdi.getFullYear(), simdi.getMonth(), 1),
    buYil: new Date(simdi.getFullYear(), 0, 1),
  };
}

/**
 * Veritabanından okunacak en eski an. Ocak'ın ilk günlerinde geçen hafta
 * geçen yıla düşer; yalnız yıl başından okumak onu eksik sayardı.
 */
export function sayacBaslangici(simdi: Date): Date {
  const b = donemBaslangiclari(simdi);
  return b.gecenHafta < b.buYil ? b.gecenHafta : b.buYil;
}

/** `an` o dönemin içinde mi? Geçen hafta bu haftanın başında BİTER. */
export function donemIcinde(an: Date, donem: Donem, sinir: Record<Donem, Date>): boolean {
  if (donem === 'gecenHafta') return an >= sinir.gecenHafta && an < sinir.buHafta;
  return an >= sinir[donem];
}

/**
 * @param sira araçların gösterim sırası (ARACLAR); listede olmayan bir araç
 *   kimliği sona eklenir — eski ya da kaldırılmış bir araç sayımdan düşmesin.
 */
export function sayacHesapla(girdiler: readonly SayacGirdisi[], simdi: Date, sira: readonly string[]): SayacSonucu {
  const sinir = donemBaslangiclari(simdi);
  const enEski = sayacBaslangici(simdi);
  const aracBasina = new Map<string, DonemSayilari>();
  const toplam = bos();

  for (const g of girdiler) {
    if (!skoraGirerMi(g.kaynak)) continue;
    if (g.durum === 'devam') continue;
    const an = new Date(g.baslangic);
    // Geçersiz tarih ya da gelecekteki bir an (cihaz saati geri alınmış)
    // hiçbir döneme yazılmaz.
    if (Number.isNaN(an.getTime()) || an < enEski || an > simdi) continue;
    let s = aracBasina.get(g.aracId);
    if (!s) { s = bos(); aracBasina.set(g.aracId, s); }
    for (const { id } of DONEMLER) {
      if (!donemIcinde(an, id, sinir)) continue;
      for (const x of [s[id], toplam[id]]) {
        x.arac += 1;
        x.hata += g.hataAdedi;
        x.demerit += g.demerit;
      }
    }
  }

  const kimlikler = [...sira.filter((id) => aracBasina.has(id)), ...[...aracBasina.keys()].filter((id) => !sira.includes(id))];
  return { araclar: kimlikler.map((aracId) => ({ aracId, sayilar: aracBasina.get(aracId)! })), toplam };
}
