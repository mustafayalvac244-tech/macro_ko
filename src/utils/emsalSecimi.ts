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

/*
 * KARTIN ETİKETİ VE HEDEFİ DE AYNI MAHKEMEYİ SÖYLER (09.10.2026 denetimi).
 *
 * caseCourt'tan sonra kalan kusur: idari dosyada kart Danıştay kararı
 * getiriyordu ama üstünde "… emsal Yargıtay kararları" yazıyordu; "Tümünü
 * İçtihat'ta gör" ve karar satırları İçtihat ekranını Yargıtay'da açıyordu.
 */

/** Kartın "… konusunda emsal X kararları" satırının çeviri anahtarı. */
export function emsalBaslikAnahtari(
  court: 'yargitay' | 'danistay'
): 'dash.prec.forCase' | 'dash.prec.forCaseDanistay' {
  return court === 'danistay' ? 'dash.prec.forCaseDanistay' : 'dash.prec.forCase';
}

/**
 * Karttan İçtihat ekranına giden yol: aynı terim, aynı mahkeme. Yargıtay
 * ekranın varsayılanı olduğu için o yol eskisiyle aynı kalır.
 */
export function emsalAramaYolu(term: string, court: 'yargitay' | 'danistay'): string {
  const yol = '/ictihat?q=' + encodeURIComponent(term);
  return court === 'danistay' ? `${yol}&court=danistay` : yol;
}

/**
 * İçtihat ekranının ?court= parametresi. Yalnız kartın gönderdiği iki yüksek
 * mahkeme kabul edilir; başka her şey (yok, dizi, bilinmeyen) Yargıtay.
 */
export function mahkemeParametresi(p: unknown): 'yargitay' | 'danistay' {
  return p === 'danistay' ? 'danistay' : 'yargitay';
}
