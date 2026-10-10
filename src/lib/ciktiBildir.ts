import { uyar } from '@/lib/uyari';
import { ciktiMesajAnahtari, type CiktiMesajAnahtari } from '@/lib/ciktiMesaji';
import type { CiktiSonuc } from '@/lib/cikti';

/**
 * `metniPaylas`/`metniKopyala` gibi çağrıların sonucunu kullanıcıya söyler.
 * Sonucu atmak yerine (sessiz başarısızlık) çağrı yeri bunu kullanır.
 * `t`, uygulamanın çeviri işlevidir (daha geniş anahtar kümesi kabul eder).
 */
export function ciktiSonucunuBildir(
  sonuc: CiktiSonuc,
  baslik: string,
  t: (anahtar: CiktiMesajAnahtari) => string,
): void {
  const anahtar = ciktiMesajAnahtari(sonuc);
  if (anahtar) uyar(baslik, t(anahtar));
}
