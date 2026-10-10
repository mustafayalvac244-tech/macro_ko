import { useEffect } from 'react';
import { Platform } from 'react-native';
import { cikisUyarisiniKur, type OlayHedefi } from '@/utils/webDavranis';

/**
 * KAYDEDİLMEMİŞ FORMDA SEKMEYİ KAPATMA / YENİLEME UYARISI (yalnız web).
 *
 * Telefonda form uygulama kapanınca zaten kaybolur ve kullanıcı bunu bilir;
 * tarayıcıda ise F5 ya da yanlışlıkla sekmeyi kapatmak yazılan her şeyi
 * sessizce siler. `kirli` YALNIZ gerçekten veri kaybolacak durumda true
 * verilmeli (yeni kayıt formunda kullanıcı bir şey yazdıysa); her ekrana
 * koşulsuz eklenirse uyarı gürültüye dönüşür ve önemsenmez.
 */
export function useWebCikisUyarisi(kirli: boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    return cikisUyarisiniKur(window as unknown as OlayHedefi, kirli);
  }, [kirli]);
}
