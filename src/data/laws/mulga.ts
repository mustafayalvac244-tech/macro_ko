/**
 * Madde yürürlükten kalkmış (MÜLGA) mı — arayüzde rozet göstermek için.
 *
 * NEDEN. Havuzda mülga maddeler VAR (İİK m.12, İşK m.82, Anayasa m.99 …) ve
 * hepsi ekranda sıradan bir madde gibi duruyordu; "(Mülga: 2/7/2012-6352/105
 * md.)" yazan 30 karakterlik bir gövde, avukata "bu madde yürürlükte değil"
 * demiyordu. En kötüsü HMK m.107 (belirsiz alacak davası): metni canlı madde
 * gibi görünüyordu, oysa resmî kaynakta 16/7/2026 tarihli ve 7589 sayılı
 * Kanun'un 19. maddesiyle mülga (mevzuat.gov.tr, 10.10.2026).
 *
 * KURAL — sıkı tutuldu ki canlı maddeye yanlış rozet düşmesin:
 *  - gövde yalnız "Mülga" sözcüğüdür (eski ayıklayıcı işareti silip bunu
 *    bırakmıştı: İşK m.33, TMK m.187), YA DA
 *  - gövde (varsa önündeki "(Değişik: …)" notlarından sonra) "(Mülga: …)"
 *    işaretiyle başlar ve arkasında yalnız KISA bir artık kalır
 *    (sonraki maddenin başlığı sızmış olabilir; en çok 200 karakter, "(1)"
 *    fıkra işareti yok). Kısmi mülgalık "(Mülga fıkra: …)" biçimindedir ve
 *    buraya GİRMEZ — madde hâlâ yürürlüktedir.
 */
export interface MulgaAdayi {
  text: string;
}

const SADECE_MULGA = /^m[uü]lga\.?$/i;
const MULGA_ISARETI = /^(?:\([^)]*\)\s*)*\(\s*Mülga\s*:[^)]*\)/;

export function mulgaMi(art: MulgaAdayi): boolean {
  const t = (art.text ?? '').trim();
  if (!t) return false;
  if (SADECE_MULGA.test(t)) return true;
  const m = MULGA_ISARETI.exec(t);
  if (!m) return false;
  const kalan = t.slice(m[0].length).trim();
  return kalan.length <= 200 && !kalan.includes('(1)');
}
