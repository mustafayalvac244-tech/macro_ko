// KVKK İMZA PENCERESİNİN OKUMA İLERLEMESİ — saf hesap, ölçülebilir olsun diye.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Bu iki küçük hesap, imza kapısının TEK kuralı: "metnin
// tamamı ekrandan geçti mi". Bileşenin içine gömülü kalsaydı sınanamazdı ve
// yanlış bir eşik sessizce herkesi geçirir ya da hiç kimseyi geçirmezdi.
// İkisi de kötü: birincisi kapıyı sahte yapar, ikincisi kaydı imkânsız kılar.
//
// ⚠️ ADLANDIRMA NOTU: "okuma oranı" derken kastedilen, metnin ne kadarının
// EKRANDAN GEÇTİĞİdir. İnsanın okuyup okumadığını ölçmez — kaydırıp geçen de
// sona gelir. Bu ayrım migration 0130 ve KvkkImza.tsx içinde de yazılıdır.

export interface KaydirmaOlcusu {
  /** Kaydırıcının tepeden uzaklığı. */
  offsetY: number;
  /** Görünür alanın yüksekliği. */
  layoutHeight: number;
  /** İçeriğin toplam yüksekliği. */
  contentHeight: number;
}

/**
 * Sona gelme payı. İçerik yüksekliği ondalıklı ölçülür (yazı tipi metrikleri,
 * cihaz ölçek çarpanı); birebir eşitlik beklemek, kullanıcıyı sonsuza kadar
 * "birkaç piksel kaldı" durumunda bırakırdı.
 */
export const SONA_GELME_PAYI = 24;

/** Metin ekrana sığıyor mu — bu durumda kaydırma olayı hiç gelmez. */
function ekranaSigiyor(o: KaydirmaOlcusu, pay: number): boolean {
  return o.contentHeight <= o.layoutHeight + pay;
}

/**
 * Metnin tamamı ekrandan geçirildi mi?
 *
 * Ölçüler henüz alınmadıysa (layoutHeight = 0, ilk çerçeve) YANLIŞ döner:
 * ölçülmemiş bir durumu "geçti" saymak, kapıyı hiç olmamış gibi açardı.
 */
export function sonaGelindiMi(o: KaydirmaOlcusu, pay: number = SONA_GELME_PAYI): boolean {
  if (o.layoutHeight <= 0 || o.contentHeight <= 0) return false;
  if (ekranaSigiyor(o, pay)) return true;
  return o.offsetY + o.layoutHeight >= o.contentHeight - pay;
}

/**
 * Ekrandan geçen kısmın oranı (0–1).
 *
 * İki uç durum bilerek ele alınıyor:
 *  • İçerik ekrana sığıyorsa oran 1'dir — kaydıracak bir şey yoksa "%0 okundu"
 *    yazmak kullanıcıyı olmayan bir işe yollar.
 *  • iOS'ta zıplama (bounce) offsetY'yi sınırın dışına taşır; kırpılmazsa
 *    %100'ün üstünde bir değer çıkar.
 */
export function okumaOrani(o: KaydirmaOlcusu, pay: number = SONA_GELME_PAYI): number {
  if (o.layoutHeight <= 0 || o.contentHeight <= 0) return 0;
  if (ekranaSigiyor(o, pay)) return 1;
  const gorulebilir = Math.max(o.contentHeight - o.layoutHeight, 1);
  return Math.min(Math.max(o.offsetY / gorulebilir, 0), 1);
}
