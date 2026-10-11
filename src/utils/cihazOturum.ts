// OTURUM/CİHAZ — saf mantık (bkz. src/hooks/useCihazlar.ts).

export interface CihazKaydi {
  cihaz_anahtari: string;
  ad: string | null;
  platform: string | null;
  ilk_gorulme: string;
  son_gorulme: string;
}

/**
 * Bu cihaz EN SON görüldükten sonra hesaba İLK KEZ giren diğer cihazlar
 * (en yenisi başta).
 *
 * NEDEN (09.10.2026): uyarı eskiden yeni giren cihazın kendisinde çıkıyordu;
 * hesap sahibinin cihazları hiçbir şey görmüyordu. Doğru soru "ben en son
 * buradayken sonra kim girdi?" — cevabı için bu cihazın ÖNCEKİ son görülme
 * damgası gerekir, bu yüzden liste cihaz_bildir'den (damgayı now() yapar)
 * ÖNCE okunmalı.
 *
 * Listede kaydı olmayan cihaz yeni girmiştir ve kendini uyarmaz. Damgalar
 * sunucuda now() ile yazıldığı için cihaz saatleri karşılaştırmaya girmez.
 * Tarih okunamazsa boş döner: uydurma alarm, hiç alarm olmamasından kötü.
 */
export function sonZiyaretimdenBeriGirenler<T extends CihazKaydi>(liste: T[], buAnahtar: string): T[] {
  const ben = liste.find((c) => c.cihaz_anahtari === buAnahtar);
  if (!ben) return [];
  const esik = Date.parse(ben.son_gorulme);
  if (!Number.isFinite(esik)) return [];
  return liste
    .filter((c) => c.cihaz_anahtari !== buAnahtar && Date.parse(c.ilk_gorulme) > esik)
    .sort((a, b) => Date.parse(b.ilk_gorulme) - Date.parse(a.ilk_gorulme));
}

/**
 * "Bu ben değilim" — DİĞER oturumları kapatır, sonra cihaz listesini temizler.
 *
 * SIRA (09.10.2026'da çevrildi): asıl kontrol signOut'tur; liste yalnız bir
 * görüntüdür (0099 göçünün kendi notu). Eskiden önce liste temizleniyordu:
 * signOut düşerse saldırganın oturumu açık kalıyor ama listeden silinmiş
 * oluyordu — avukat "yalnız bu cihaz" görüp işin bittiğini sanardı.
 * signOut başarılıysa liste temizliğinin hatası işlemi başarısız saymaz.
 */
export async function digerOturumlariKapat(adim: {
  /** supabase.auth.signOut({ scope: 'others' }) */
  oturumlariKapat: () => PromiseLike<{ error: unknown }>;
  /** rpc('cihazlarimi_temizle', { p_haric: buCihaz }) */
  listeyiTemizle: () => PromiseLike<unknown>;
}): Promise<void> {
  const { error } = await adim.oturumlariKapat();
  if (error) throw error;
  try {
    await adim.listeyiTemizle();
  } catch {
    // Oturumlar kapandı; liste bir sonraki okumada eski kayıtları gösterir,
    // kullanıcı düğmeye yeniden basarak temizleyebilir.
  }
}
