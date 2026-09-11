import { Alert, Platform } from 'react-native';
import { getLang, translate } from '@/i18n';
import { useUyariStore, type UyariDugmesi } from '@/store/uyariStore';

/**
 * PLATFORMDAN BAĞIMSIZ UYARI/ONAY PENCERESİ.
 *
 * İmzası bilerek `Alert.alert` ile AYNI tutuldu — 87 çağrı yerinin yalnız
 * import satırı değişsin, davranış kodu aynen kalsın diye.
 *
 * Natif: yerli Alert (değişiklik yok).
 * Web  : uygulama içi pencere (bkz. components/ui/UyariKatmani).
 *        react-native-web'in Alert'i BOŞ bir fonksiyondur, yani web'de bu
 *        çağrıların hepsi sessizce hiçbir şey yapmıyordu.
 *
 * NEDEN window.confirm DEĞİL: tarayıcının kendi penceresi uygulamanın
 * görünümüne hiç benzemiyor, üç düğmeyi (ör. "Fotoğraf çek / Galeriden seç /
 * Vazgeç") desteklemiyor ve bazı tarayıcılarda engellenebiliyor.
 */
export function uyar(
  baslik: string,
  mesaj?: string,
  dugmeler?: UyariDugmesi[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(baslik, mesaj, dugmeler);
    return;
  }
  const liste = dugmeler?.length ? dugmeler : [{ text: translate(getLang(), 'common.ok') }];
  useUyariStore.getState().goster({ baslik, mesaj, dugmeler: liste });
}
