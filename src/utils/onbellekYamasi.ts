// İYİMSER GÜNCELLEME — önbellekteki satırı yerinde yamalar.
// ---------------------------------------------------------------------------
// NEDEN VAR. İcra dosyasında "Safha" rozetine (Haciz, Satış…) dokunulduğunda
// vurgu geç geçiyordu. Sebebi render değil, AĞ:
//
//   1. dokun  → sunucuya UPDATE gider          (gidiş-dönüş #1)
//   2. dönünce → invalidateQueries → REFETCH   (gidiş-dönüş #2)
//   3. ancak şimdi `file.stage` değişir ve altın vurgu yerine oturur
//
// Yani ekrandaki seçim, sunucudan iki kez dönülmeden kımıldamıyordu. Yavaş
// bağlantıda bu "tıkladım, olmadı, bir daha tıklayayım"a dönüşür — ve ikinci
// dokunuş ikinci bir yazma daha üretir.
//
// ÇÖZÜM: yazmayı beklemeden önbelleği yamala, hata olursa geri al. Böylece
// vurgu dokunur dokunmaz oynar; sunucu cevabı sessizce arkadan gelir.
//
// NEDEN AYRI DOSYA. React Query önbelleği aynı kaydı İKİ AYRI ŞEKİLDE tutuyor:
// liste sorgularında dizi (`['enforcements', ownerId, arama]`), ayrıntı
// sorgusunda tek nesne (`['enforcements','detail',id]`). İkisini de doğru
// yamalamak tek bir saf fonksiyonun işi ve test edilebilmeli; depo kuralı
// gereği saf mantık react-query/supabase çeken dosyalardan ayrı tutuluyor.

/**
 * Önbellekteki veriyi, `id`'si tutan kaydı `yama` ile güncelleyerek döndürür.
 *
 * Üç şekli birden ele alır:
 *   • dizi  → yalnız eşleşen eleman değişir, sıra korunur
 *   • nesne → id tutuyorsa yamalanır
 *   • null/undefined/başka → DOKUNULMADAN döner
 *
 * EŞLEŞME YOKSA AYNI REFERANS DÖNER. Bu önemli: React Query dönen değer
 * farklıysa o sorguyu yeniden çizer. Eşleşmeyen her sorgu için yeni nesne
 * üretmek, tek bir dokunuşta ekrandaki BÜTÜN listeleri yeniden çizdirirdi —
 * yani gecikmeyi çözerken başka bir gecikme üretirdik.
 */
export function onbellekYamasi<T extends { id: string }>(
  eski: unknown,
  id: string,
  yama: Partial<T>,
): unknown {
  if (Array.isArray(eski)) {
    let degisti = false;
    const yeni = eski.map((satir) => {
      if (satirMi(satir) && satir.id === id) {
        degisti = true;
        return { ...satir, ...yama };
      }
      return satir;
    });
    return degisti ? yeni : eski;
  }

  if (satirMi(eski) && eski.id === id) {
    return { ...eski, ...yama };
  }

  return eski;
}

function satirMi(d: unknown): d is { id: string } {
  return typeof d === 'object' && d !== null && typeof (d as { id?: unknown }).id === 'string';
}
