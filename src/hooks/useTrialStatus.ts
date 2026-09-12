import { useAuthStore } from '@/store/authStore';

// FİYAT VE KOTA SABİTLERİ BURADAN TAŞINDI → src/config/planlar.ts
// Sebep ölçülmüş: bu dosya `authStore` üzerinden react-native çekiyor ve test
// ortamı onu hiç ayrıştıramıyor ("Expected 'from', got 'typeOf'"). Sabitler
// burada durdukça, web'deki sözleşmenin sayılarını kodla karşılaştıran bir
// test YAZILAMIYORDU — nitekim docs/terms.html aylarca eski kotayı yazdı.
// Saf `config` modülüne taşındılar; buradan yeniden dışa aktarılıyorlar ki
// mevcut çağıranların hiçbiri değişmesin.
export {
  MONTHLY_PRICE_TRY,
  AI_PRICE_TRY,
  AI_SORU_HAKKI,
  AI_MUTALAA_HAKKI,
  AI_ASIL_MODEL_HAKKI,
  DENEME_SORU_HAKKI,
} from '@/config/planlar';


export interface TrialStatus {
  /** Abone mi (ödeme yaptı / premium verildi)? */
  subscribed: boolean;
}

/**
 * KALDIRILAN "7 GÜNLÜK ÜCRETSİZ DENEME" — neden.
 *
 * Burada hesabın açılış tarihinden 7 gün sayan bir deneme sayacı vardı ve
 * ekranlar "7 GÜN ÜCRETSİZ", "denemenizin son günü", "deneme süresi bitmeden
 * iptal ederseniz ücret alınmaz" diyordu. ÖLÇÜLEN GERÇEK: bu denemenin hiçbir
 * karşılığı yoktu. Sınırı uygulayan tek yer `plan_limiti_kontrol`
 * tetikleyicisidir (migration 0087) ve o tetikleyicide deneme diye bir kavram
 * yok — 1. gündeki kullanıcı da 100. gündeki kullanıcı da aynı 5 dava sınırına
 * çarpıyordu. Yani ekranda satılan deneme, sunucuda hiç var olmadı.
 *
 * Üstelik App Store'da yapılandırılmış bir tanıtım teklifi (introductory
 * offer) da yok; "ilk 7 gün ücretsiz, iptal ederseniz ücret alınmaz" cümlesi
 * hem yanlış hem de App Review 3.1.2 açısından risk.
 *
 * Doğru çerçeve zaten üründe var: ücretsiz katman KALICI (sınırsız içtihat,
 * sınırsız ajanda; 5 dava / 10 müvekkil / 5 belge). Hiçbir şey "bitmiyor",
 * bu yüzden geri sayım da, "deneme bitti" uyarısı da kaldırıldı.
 *
 * GERÇEK bir deneme istenirse: App Store Connect / Play Console'da tanıtım
 * teklifi tanımlanır ve metinler oradaki şartlara göre yeniden yazılır —
 * uygulama içinde gün saymak o teklifin yerine geçmez.
 */
export function useTrialStatus(): TrialStatus {
  const profile = useAuthStore((s) => s.profile);
  return { subscribed: !!profile?.is_premium };
}
