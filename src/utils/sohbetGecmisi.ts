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
