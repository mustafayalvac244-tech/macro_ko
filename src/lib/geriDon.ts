import { router } from 'expo-router';

/**
 * GERİ — gidecek yer yoksa ana ekrana (08.10.2026).
 *
 * BULUNAN KUSUR (denetimde bulundu; expo-router kaynağında doğrulandı).
 * Web'de sayfa yenilenince ya da yer iminden açılınca yığında tek ekran
 * kalır; `router.back` o durumda HİÇBİR ŞEY yapmaz (StackRouter GO_BACK'i
 * işlemez, üretimde uyarı da yok). Geri oku ölü kalıyor, form KAYDETTİKTEN
 * sonra kapanmıyordu — kullanıcı tekrar basınca ikinci dava/müvekkil açılıyordu.
 */
export function geriDon(yedek: string = '/(app)'): void {
  if (router.canGoBack()) router.back();
  else router.replace(yedek as Parameters<typeof router.replace>[0]);
}
