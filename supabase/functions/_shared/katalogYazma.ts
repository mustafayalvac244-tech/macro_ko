// KATALOG YAZMA SIRASI — katalog-tick'in "künyeleri yaz, SONRA pencereyi
// ilerlet" adımı (10.10.2026 denetimi).
//
// NEDEN AYRI DOSYA. Eskiden bu iki yazma katalog-tick/index.ts içinde art
// arda duruyordu ve pencere durumu ilk yazmanın sonucuna bakmadan
// güncelleniyordu. ictihat_katalog upsert'i düşünce (zaman aşımı, disk
// baskısı) `not` yazılıyor ama pencere yine "sonraki sayfa"ya geçiyor, hatta
// `bitti` işaretleniyordu → o sayfaların künyeleri bir daha ÇEKİLMİYORDU,
// sessizce. Sıra burada test edilebilir (tests/katalogTick.test.ts); index.ts
// Deno'ya bağlı olduğundan orada sınanamaz.

export type KatalogSatiri = {
  id: string;
  tur: string;
  daire: string | null;
  esas_yil: number | null;
  esas_sira: number | null;
  karar_yil: number | null;
  karar_sira: number | null;
  karar_tarihi: string | null;
};

/** ictihat_katalog_pencere'ye yazılacak satır (tur,gun birincil anahtar). */
export type PencereDurumu = Record<string, unknown>;

/**
 * Önce künyeleri yazar; YALNIZ başarılıysa pencere durumunu günceller.
 * Künye yazması düşerse pencere olduğu yerde kalır → sonraki tur aynı sayfadan
 * devam eder (katalog upsert'i ignoreDuplicates olduğundan tekrar zararsız).
 *
 * Dönen `not` doluysa bir yazma düşmüştür; çağıran bunu yanıtta göstermeli.
 * `pencereYazildi`: pencere durumu gerçekten kaydedildi mi ("gun_bitti" sayısı
 * yalnız o zaman doğrudur).
 */
export async function katalogYaz(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  satirlar: KatalogSatiri[],
  pencereler: PencereDurumu[]
): Promise<{ yazilan: number; pencereYazildi: boolean; not?: string }> {
  let yazilan = 0;
  if (satirlar.length) {
    // ignoreDuplicates: katalogda olan satır GÜNCELLENMEZ. Önemli, çünkü
    // metin_var ve son_deneme sütunlarını metin hasadı yazıyor; buradan
    // tekrar yazmak onları sıfırlayıp aynı metni bir daha indirtirdi.
    //
    // Aynı tur içinde aynı id iki kez gelebilir (iki pencere aynı kararı
    // döndürürse); upsert'e yinelenen anahtar göndermek tüm yazmayı düşürür,
    // o yüzden önce tekilleştiriliyor.
    const tekil = [...new Map(satirlar.map((x) => [x.id, x])).values()];
    const { error, count } = await supabase
      .from('ictihat_katalog')
      .upsert(tekil, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' });
    if (error) return { yazilan: 0, pencereYazildi: false, not: `upsert: ${String(error.message).slice(0, 90)}` };
    yazilan = count ?? tekil.length;
  }

  if (pencereler.length) {
    const { error } = await supabase.from('ictihat_katalog_pencere').upsert(pencereler, { onConflict: 'tur,gun' });
    if (error) return { yazilan, pencereYazildi: false, not: `pencere: ${String(error.message).slice(0, 90)}` };
  }
  return { yazilan, pencereYazildi: true };
}
