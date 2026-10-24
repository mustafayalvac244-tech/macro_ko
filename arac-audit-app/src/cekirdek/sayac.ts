// SAYAÇ — denetlenen araç ve hata sayısı: bugün, bu hafta, bu ay, bu yıl.
//
// Ürün sahibi, 24.10.2026: şirkette kullanılan Excel formunun fotoğrafını
// attı; sağdaki panel model başına "Audit Aracı / Problem / Audit Skoru"
// sayısını bugün, bu hafta, bu ay, bu yıl diye tutuyor. "Araç baktıkça sayıyor,
// ekliyor; o sistem güzel."
//
// SKOR = DPU (araç başına hata). Excel'deki "Audit Skoru"nun formülü
// fotoğraftan okunamadı; ürün sahibi (24.10.2026) seçeneklerden "araç başına
// hata"yı seçti. Tanım Excel raporumuzdaki DPU ile AYNI (puan.ts):
// kabul edilebilir OLMAYAN hata / denetlenen araç, iki ondalık. Derece
// toplamı gibi bir ceza puanı DEĞİL (16.09.2026: "bizde öyle bir şey yok").
//
// KAPSAM: yalnız BU CİHAZIN kayıtları — merkezi sunucu yok. Hatasız biten
// araç da denetlenen araç sayılır (Excel'deki "Problem Yok Aracı Kaydet").
// Hata sayısı kabul edilebilir olanları da içerir; eski kayıtlardaki adet
// toplanır.
//
// Dönem sınırları CİHAZIN YEREL SAATİYLE: gün gece yarısı, hafta PAZARTESİ
// başlar (Türkiye). Denetim başladığı ana göre sayılır.

export type Donem = 'bugun' | 'buHafta' | 'buAy' | 'buYil';

export const DONEMLER: readonly { id: Donem; ad: string }[] = [
  { id: 'bugun', ad: 'Bugün' },
  { id: 'buHafta', ad: 'Bu hafta' },
  { id: 'buAy', ad: 'Bu ay' },
  { id: 'buYil', ad: 'Bu yıl' },
];

export interface SayacGirdisi {
  aracId: string;
  /** ISO 8601 — denetimin başladığı an. */
  baslangic: string;
  hataAdedi: number;
  /** Kabul edilebilir İŞARETLENMEMİŞ hata adedi — DPU bunu sayar. */
  duzeltilecekAdedi: number;
}

export interface Sayi { arac: number; hata: number; duzeltilecek: number }

/** Araç başına düzeltilecek hata; araç yoksa null ("0" yazmak yanıltır). */
export function dpu(x: Sayi): number | null {
  return x.arac ? Math.round((x.duzeltilecek / x.arac) * 100) / 100 : null;
}

export type DonemSayilari = Record<Donem, Sayi>;

export interface SayacSonucu {
  /** Bu yıl en az bir denetimi olan araçlar, verilen sırayla. */
  araclar: { aracId: string; sayilar: DonemSayilari }[];
  toplam: DonemSayilari;
}

const sifir = (): Sayi => ({ arac: 0, hata: 0, duzeltilecek: 0 });
const bos = (): DonemSayilari => ({ bugun: sifir(), buHafta: sifir(), buAy: sifir(), buYil: sifir() });

/** Dönemlerin başlangıç anları, yerel saatle. */
export function donemBaslangiclari(simdi: Date): Record<Donem, Date> {
  const gun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  // getDay: pazar 0. Pazartesi başlangıcına kaç gün geri gidilir?
  const geri = (gun.getDay() + 6) % 7;
  return {
    bugun: gun,
    buHafta: new Date(gun.getFullYear(), gun.getMonth(), gun.getDate() - geri),
    buAy: new Date(simdi.getFullYear(), simdi.getMonth(), 1),
    buYil: new Date(simdi.getFullYear(), 0, 1),
  };
}

/**
 * @param sira araçların gösterim sırası (ARACLAR); listede olmayan bir araç
 *   kimliği sona eklenir — eski ya da kaldırılmış bir araç sayımdan düşmesin.
 */
export function sayacHesapla(girdiler: readonly SayacGirdisi[], simdi: Date, sira: readonly string[]): SayacSonucu {
  const sinir = donemBaslangiclari(simdi);
  const aracBasina = new Map<string, DonemSayilari>();
  const toplam = bos();

  for (const g of girdiler) {
    const an = new Date(g.baslangic);
    // Geçersiz tarih ya da gelecekteki bir an (cihaz saati geri alınmış)
    // hiçbir döneme yazılmaz.
    if (Number.isNaN(an.getTime()) || an < sinir.buYil || an > simdi) continue;
    let s = aracBasina.get(g.aracId);
    if (!s) { s = bos(); aracBasina.set(g.aracId, s); }
    for (const { id } of DONEMLER) {
      if (an >= sinir[id]) {
        for (const x of [s[id], toplam[id]]) {
          x.arac += 1;
          x.hata += g.hataAdedi;
          x.duzeltilecek += g.duzeltilecekAdedi;
        }
      }
    }
  }

  const kimlikler = [...sira.filter((id) => aracBasina.has(id)), ...[...aracBasina.keys()].filter((id) => !sira.includes(id))];
  return { araclar: kimlikler.map((aracId) => ({ aracId, sayilar: aracBasina.get(aracId)! })), toplam };
}
