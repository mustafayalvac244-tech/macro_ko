/**
 * EMSAL SEÇİMİ — hangi mahkemeye, hangi terimle sorulacak.
 *
 * NEDEN AYRI DOSYA: useCasePrecedents supabase istemcisine (dolayısıyla
 * react-native'e) bağlı ve test koşucusu onu ayrıştıramıyor. Karar mantığı
 * burada saf duruyor, davranış testlere bağlı.
 */

/**
 * DOSYANIN YARGI KOLUNA GÖRE DOĞRU YÜKSEK MAHKEME.
 *
 * BULUNAN KUSUR. Emsal her zaman Yargıtay'a soruluyordu (`court: 'yargitay'`
 * sabitti). Oysa İDARİ bir davanın temyiz mercii DANIŞTAY'dır; idare
 * mahkemesinde dosyası olan avukata Yargıtay kararı göstermek, yanlış yargı
 * kolundan emsal göstermektir — o kararların o dosyada hükmü yoktur.
 *
 * Uç zaten 'danistay'ı destekliyordu (ictihat/index.ts: court süzgeci);
 * kullanılmıyordu.
 */
export function caseCourt(
  c: { court_category?: 'hukuk' | 'ceza' | 'idare' | null } | null | undefined
): 'yargitay' | 'danistay' {
  return c?.court_category === 'idare' ? 'danistay' : 'yargitay';
}

/** Dosyanın konusundan temiz bir içtihat arama terimi çıkarır. */
export function caseSearchTerm(c: { case_type?: string | null; title?: string | null } | null | undefined): string {
  if (!c) return '';
  // case_type en temiz sinyal ("İşçilik Alacağı", "Kira Tespiti"…). Yoksa başlığı,
  // esas/karar numaralarını ve taraf ekini ayıklayarak kullan.
  const primary = (c.case_type ?? '').trim();
  if (primary) return primary;
  let title = (c.title ?? '').trim();
  // "2023/145", "E.2023/145" gibi dosya/esas numaralarını at.
  title = title.replace(/\b[EK]\.?\s*\d{2,4}\s*\/\s*\d+/gi, ' ');
  title = title.replace(/\b\d{2,4}\s*\/\s*\d+\b/g, ' ');
  // Fazla boşlukları sadeleştir.
  return title.replace(/\s{2,}/g, ' ').trim();
}
