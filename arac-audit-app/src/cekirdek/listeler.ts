// SEÇİM LİSTELERİ — yeni denetim formundaki hazır seçenekler.
//
// Ürün sahibi, 28.09.2026: "Faz kısmı da otomatik T1 T2 LP1 LP2 Pre-M M SOP
// olsun, ekstra eklenebilsin"; denetçi adları da listeden seçilsin, "isteyen
// ekstra ekleyebilir".
//
// Liste CİHAZDA saklanır (ayarlar tablosu). Bir tablette eklenen ad öbür
// tablete GEÇMEZ: merkezi sunucu yok.

export const HAZIR_FAZLAR: readonly string[] = ['T1', 'T2', 'LP1', 'LP2', 'Pre-M', 'M', 'SOP'];

/**
 * Hazır denetçi listesi BOŞ — bilerek. Ürün sahibi beş ad verdi (28.09.2026),
 * ama depo HERKESE AÇIK: kişilerin tam adı koda yazılırsa GitHub'da herkes
 * görür, APK'dan da okunur. Karar ürün sahibinde; o gelene kadar adlar
 * cihazda "+ Ekle" ile girilir.
 */
export const HAZIR_DENETCILER: readonly string[] = [];

/** `ayarlar` tablosundaki anahtarlar. */
export const LISTE_ANAHTARI = { denetci: 'denetciListesi', faz: 'fazListesi' } as const;

/** Yazılışı sadeleştirir: baş/son boşluk atılır, iç boşluklar teke iner. */
export const sadelestir = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** Karşılaştırma anahtarı: fazla boşluk ve Türkçe büyük/küçük harf farkı yok sayılır. */
const esitlikAnahtari = (s: string): string => sadelestir(s).toLocaleLowerCase('tr');

/**
 * Listeye ad ekler. Aynı ad (büyük/küçük harf ya da fazla boşluk farkıyla)
 * zaten varsa liste DEĞİŞMEZ ve var olan yazılış döner: "LP2" ile "lp2" iki
 * ayrı faz olup raporda iki ayrı değer gibi görünmesin.
 */
export function listeyeEkle(liste: readonly string[], ham: string): { liste: string[]; secilen: string } {
  const temiz = sadelestir(ham);
  if (!temiz) return { liste: [...liste], secilen: '' };
  const varOlan = liste.find((x) => esitlikAnahtari(x) === esitlikAnahtari(temiz));
  if (varOlan !== undefined) return { liste: [...liste], secilen: varOlan };
  return { liste: [...liste, temiz], secilen: temiz };
}

export function listedenCikar(liste: readonly string[], ad: string): string[] {
  return liste.filter((x) => x !== ad);
}

/**
 * Hatırlanan seçim hâlâ listede mi? Değilse boş döner. Listeden kaldırılmış
 * bir ad formda görünmeden rapora yazılmasın — denetçi ekranda seçili bir şey
 * görmüyorsa rapora da bir şey gitmemeli.
 */
export function listedeyse(liste: readonly string[], deger: string): string {
  return liste.includes(deger) ? deger : '';
}
