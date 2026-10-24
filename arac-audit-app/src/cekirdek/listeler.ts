// SEÇİM LİSTELERİ — yeni denetim formundaki hazır seçenekler.
//
// Ürün sahibi, 28.09.2026: denetçi adları listeden seçilsin, "isteyen ekstra
// ekleyebilir". Aynı gün faz da listeye alınmıştı (T1 … SOP); 24.10.2026'da
// faz formdan tamamen kalktı ("bizdeki gereksiz bilgileri sil"), listesi de.
//
// Liste CİHAZDA saklanır (ayarlar tablosu). Bir tablette eklenen ad öbür
// tablete GEÇMEZ: merkezi sunucu yok.

/**
 * Hazır denetçi listesi BOŞ — bilerek. Ürün sahibi beş ad verdi (28.09.2026),
 * ama depo HERKESE AÇIK: kişilerin tam adı koda yazılırsa GitHub'da herkes
 * görür, APK'dan da okunur. Karar ürün sahibinde; o gelene kadar adlar
 * cihazda "+ Ekle" ile girilir.
 */
export const HAZIR_DENETCILER: readonly string[] = [];

/** `ayarlar` tablosundaki anahtarlar. */
/**
 * Problem Source (raporun "Source" sütunu). Ürün sahibi, 24.10.2026:
 * şirketteki Excel formunda "Problem Source: AUDIT" seçiliyor ve ayrı
 * DURABILITY sayfaları var; "Problem Source" eklensin dedi.
 *
 * "HMC Audit" ekibin kendi tablosundaki yazım (26.09.2026 ekran görüntüsü);
 * 28.09'dan beri her denetime sabit yazılıyordu, varsayılan o kalır.
 * "Durability" Excel'deki sayfa adlarından; listedeki diğer olası değerler
 * bilinmiyor — ekip "+ Ekle" ile ekler.
 */
export const HAZIR_KAYNAKLAR: readonly string[] = ['HMC Audit', 'Durability'];
export const VARSAYILAN_KAYNAK = 'HMC Audit';

export const LISTE_ANAHTARI = { denetci: 'denetciListesi', kaynak: 'kaynakListesi' } as const;

/** Yazılışı sadeleştirir: baş/son boşluk atılır, iç boşluklar teke iner. */
export const sadelestir = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** Karşılaştırma anahtarı: fazla boşluk ve Türkçe büyük/küçük harf farkı yok sayılır. */
const esitlikAnahtari = (s: string): string => sadelestir(s).toLocaleLowerCase('tr');

/**
 * Listeye ad ekler. Aynı ad (büyük/küçük harf ya da fazla boşluk farkıyla)
 * zaten varsa liste DEĞİŞMEZ ve var olan yazılış döner: "Ali Veli" ile
 * "ali veli" raporda iki ayrı kişi gibi görünmesin.
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
