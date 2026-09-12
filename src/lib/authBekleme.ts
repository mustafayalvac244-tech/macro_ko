/**
 * Sunucunun "şu kadar saniye sonra tekrar deneyin" mesajından SÜREYİ çeker.
 *
 * NEDEN VAR. Kullanıcı bildirdi: "tekrar tıklayınca güvenlik nedeniyle bekle
 * diyor" — ama ne kadar bekleyeceği hiçbir yerde yazmıyordu. trError o mesajı
 * "kısa bir süre sonra tekrar deneyin" diye çeviriyor ve içindeki SAYIYI
 * atıyor. Sayı ekranda geri sayım olarak durursa kullanıcı tahmin etmek
 * zorunda kalmaz; tahmin edemeyince erken basıyor ve sınırı yeniden tetikliyor.
 *
 * Supabase'in ürettiği metin: "For security purposes, you can only request
 * this after 17 seconds." Biçim değişirse null döner ve çağıran taraf kendi
 * varsayılan süresini kullanır — yani bu işlev hiçbir zaman akışı kırmaz.
 */
export function beklemeSaniyesi(mesaj: string | null | undefined): number | null {
  if (!mesaj) return null;
  const m = /only request this after (\d+) seconds?/i.exec(mesaj);
  if (!m) return null;
  const n = Number(m[1]);
  // Saçma değerleri (0, negatif, saatlerce) geçirmiyoruz: ekranda bitmeyen bir
  // geri sayım, hiç geri sayım olmamasından daha kötüdür.
  if (!Number.isFinite(n) || n <= 0 || n > 600) return null;
  return n;
}
