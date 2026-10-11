/**
 * KIDEM TAZMİNATI TAVANI — tarih damgalı, kaynaklı, ve eskidiğini SÖYLEYEN.
 *
 * BULUNAN KUSUR. Hesaplayıcı kıdem tazminatını `brüt ücret × yıl` diye
 * hesaplıyor ve TAVANI HİÇ UYGULAMIYORDU. Ekranın altındaki uyarı "tavanı aşan
 * ücretlerde tavan esas alınır" diyordu — yani kural biliniyor ama
 * uygulanmıyordu. Tavanın üstünde kazanan bir işçi için ekrandaki rakam
 * KANUNEN YANLIŞ ve fazla çıkıyordu.
 *
 * Örnek: 200.000 ₺ giydirilmiş brüt ücret, 10 yıl hizmet.
 *   Hesaplayıcının verdiği : 2.000.000 ₺
 *   Kanunen doğru olan     :   737.298,70 ₺  (73.729,87 × 10)
 * Aradaki fark neredeyse üç kat — ve avukat bu rakamı müvekkiline söyler.
 *
 * TAVAN, ÇIKIŞ TARİHİNDEKİ DÖNEMİN TAVANIDIR — bugünkü değil. Mart 2026'da
 * işten çıkarılan biri için Ocak-Haziran tavanı geçerlidir. Bu yüzden aşağıdaki
 * arama fonksiyonu tarihe göre çalışır.
 *
 * NEDEN AYRI DOSYA VE NEDEN TARİHLİ. Tavan yılda İKİ KEZ (ocak ve temmuz)
 * değişir; en yüksek devlet memuru emekli ikramiyesine bağlıdır. Sabiti koda
 * gömüp tarihsiz bırakmak, `tarife.ts`'te aynı sebeple reddedilen "sessiz
 * eskime"dir: sayı güncelken de eskimişken de ekranda AYNI görünür. Burada
 * dönem bittiğinde fonksiyon `null` döner ve ekran "tavan bilinmiyor" der —
 * yanlış sayı vermektense bilmediğimizi söyleriz.
 */

export interface KidemTavani {
  /** Dönem başlangıcı (dahil), YYYY-MM-DD. */
  baslangic: string;
  /** Dönem bitişi (dahil), YYYY-MM-DD. */
  bitis: string;
  /** Dönemin tavan tutarı (₺). */
  tutar: number;
  /** Ekranda gösterilecek dönem etiketi. */
  etiket: string;
}

/**
 * Bilinen dönemler.
 *
 * KAYNAK: T.C. Çalışma ve Sosyal Güvenlik Bakanlığı, Çalışma Hayatı
 * İstatistikleri E-Bülteni, "Kıdem Tazminatı Tavan Tutarı" tablosu
 * (https://www.csgb.gov.tr/yayinlar/calisma-hayati-istatistikleri-e-bulteni/
 * temmuz-2026/ucret-ve-sendikal-istatistikler.html; hukuki dayanak 1475 s.
 * Kanun m.14/13). 2026 dönemleri 09.09.2026'da, 2021-2025 dönemleri
 * 10.10.2026'da bu tablodan alındı (Temmuz ve Eylül 2026 sayıları iki ayrı
 * okumada aynı çıktı; 2026-II tutarı ayrıca bülten hesabıyla — gösterge ×
 * katsayı × yansıtma oranı — toplanarak doğrulandı). Tablo 2016'ya kadar iner;
 * burada 2021'den başlatıldı (geçmişe dönük hesaplarda yeterli kapsam). Daha
 * eski dönem gerekirse yalnız tablodaki tutar eklenir.
 *
 * YENİ DÖNEM EKLERKEN: yalnız resmî tutarı yazın ve tarihi bu yorumda
 * güncelleyin. Tahmini/yuvarlanmış bir sayı EKLEMEYİN — eksik dönem, yanlış
 * dönemden iyidir (aşağıdaki `null` yolu bunun içindir).
 */
export const KIDEM_TAVANLARI: KidemTavani[] = [
  { baslangic: '2021-01-01', bitis: '2021-06-30', tutar: 7638.96, etiket: '01.01.2021 – 30.06.2021' },
  { baslangic: '2021-07-01', bitis: '2021-12-31', tutar: 8284.51, etiket: '01.07.2021 – 31.12.2021' },
  { baslangic: '2022-01-01', bitis: '2022-06-30', tutar: 10848.59, etiket: '01.01.2022 – 30.06.2022' },
  { baslangic: '2022-07-01', bitis: '2022-12-31', tutar: 15371.4, etiket: '01.07.2022 – 31.12.2022' },
  { baslangic: '2023-01-01', bitis: '2023-06-30', tutar: 19982.83, etiket: '01.01.2023 – 30.06.2023' },
  { baslangic: '2023-07-01', bitis: '2023-12-31', tutar: 23489.83, etiket: '01.07.2023 – 31.12.2023' },
  { baslangic: '2024-01-01', bitis: '2024-06-30', tutar: 35058.58, etiket: '01.01.2024 – 30.06.2024' },
  { baslangic: '2024-07-01', bitis: '2024-12-31', tutar: 41828.42, etiket: '01.07.2024 – 31.12.2024' },
  { baslangic: '2025-01-01', bitis: '2025-06-30', tutar: 46655.43, etiket: '01.01.2025 – 30.06.2025' },
  { baslangic: '2025-07-01', bitis: '2025-12-31', tutar: 53919.68, etiket: '01.07.2025 – 31.12.2025' },
  { baslangic: '2026-01-01', bitis: '2026-06-30', tutar: 64948.77, etiket: '01.01.2026 – 30.06.2026' },
  { baslangic: '2026-07-01', bitis: '2026-12-31', tutar: 73729.87, etiket: '01.07.2026 – 31.12.2026' },
];

/** YYYY-MM-DD anahtarı (yerel tarih; UTC kaymasından etkilenmez). */
function gunAnahtari(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Verilen ÇIKIŞ TARİHİNDE yürürlükte olan tavanı döndürür.
 * Bilinmiyorsa `null` — çağıran taraf bunu kullanıcıya SÖYLEMELİDİR.
 */
export function tavanBul(cikisTarihi: Date): KidemTavani | null {
  if (Number.isNaN(cikisTarihi.getTime())) return null;
  const k = gunAnahtari(cikisTarihi);
  return KIDEM_TAVANLARI.find((t) => k >= t.baslangic && k <= t.bitis) ?? null;
}

export interface KidemSonuc {
  /** Hesapta esas alınan aylık tutar (tavan uygulandıysa tavan). */
  esasUcret: number;
  /** Brüt kıdem tazminatı. */
  brut: number;
  /** Tavan bu hesapta bağlayıcı oldu mu? */
  tavanUygulandi: boolean;
  /** Kullanılan tavan (bilinmiyorsa null). */
  tavan: KidemTavani | null;
}

/**
 * Brüt kıdem tazminatı = min(giydirilmiş brüt ücret, tavan) × hizmet yılı.
 *
 * Tavan bilinmiyorsa ücret olduğu gibi kullanılır ama `tavan: null` döner —
 * ekran bunu "tavan doğrulanamadı, tutar tavansız hesaplandı" diye göstermeli.
 */
export function kidemBrutHesapla(giydirilmisBrutUcret: number, hizmetYili: number, cikisTarihi: Date): KidemSonuc {
  const tavan = tavanBul(cikisTarihi);
  const ucret = Number.isFinite(giydirilmisBrutUcret) && giydirilmisBrutUcret > 0 ? giydirilmisBrutUcret : 0;
  const yil = Number.isFinite(hizmetYili) && hizmetYili > 0 ? hizmetYili : 0;
  const esasUcret = tavan ? Math.min(ucret, tavan.tutar) : ucret;
  return {
    esasUcret,
    brut: esasUcret * yil,
    tavanUygulandi: !!tavan && ucret > tavan.tutar,
    tavan,
  };
}
