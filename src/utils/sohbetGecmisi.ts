/**
 * Sunucuya giden geçmiş: son 30 mesaj ve İLK MESAJ KULLANICININ.
 *
 * Sunucu geçmişi `.slice(-30)` ile kesiyor. İstemci tüm geçmişi yolladığında
 * 16. sorudan sonra dilimin ilk elemanı 'model' oluyordu; Anthropic API'si
 * ilk mesajın 'user' olmasını istiyor (ŞÜPHE: canlıda ölçülmedi — ret olursa
 * her soru sessizce yedek modele düşerdi). Kesmeyi burada yapıp baştaki model
 * mesajlarını atıyoruz; sunucunun kesmesi artık hiçbir şeyi değiştirmez.
 */
export function gonderilecekGecmis<T extends { role: 'user' | 'model' }>(gecmis: T[], azami = 30): T[] {
  const dilim = gecmis.slice(-azami);
  const ilkKullanici = dilim.findIndex((m) => m.role === 'user');
  return ilkKullanici <= 0 ? dilim : dilim.slice(ilkKullanici);
}

/**
 * Gönderim başarısız olunca kutuya konacak metin.
 *
 * Eskiden `d.trim() ? d : text` idi: bekleme sırasında kutuya (dikte ya da
 * yapıştırma ile) yeni bir şey girmişse BAŞARISIZ SORU SESSİZCE kayboluyordu.
 * Artık ikisi de korunur: önce gönderilmeye çalışılan soru, altında yeni metin.
 */
export function taslakGeriYukle(mevcut: string, gonderilen: string): string {
  if (!mevcut.trim()) return gonderilen;
  if (mevcut.includes(gonderilen)) return mevcut;
  return `${gonderilen}\n\n${mevcut}`;
}
