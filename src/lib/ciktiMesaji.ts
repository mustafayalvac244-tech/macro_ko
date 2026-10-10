import type { CiktiSonuc } from '@/lib/cikti';

/**
 * DIŞA AKTARMA SONUCUNU YORUMLAMA — saf, test edilebilir.
 *
 * Eskiden her çağrı yeri sonucu kendi başına (ya da hiç) yorumluyordu: dört
 * ekranda `metniPaylas(...)` sonucu atılıyor, Web Share olmayan tarayıcıda
 * metin sessizce panoya gidiyor, kullanıcı hiçbir şey görmüyordu (09.10.2026).
 */

export type CiktiMesajAnahtari = 'cikti.copied' | 'cikti.downloaded' | 'cikti.unsupported' | 'cikti.failed';

/** Kullanıcıya söylenecek bir şey var mı? Paylaşıldı/iptal sessizdir (OS zaten gösterdi). */
export function ciktiMesajAnahtari(s: CiktiSonuc): CiktiMesajAnahtari | null {
  switch (s) {
    case 'kopyalandi': return 'cikti.copied';
    case 'indirildi': return 'cikti.downloaded';
    case 'desteklenmiyor': return 'cikti.unsupported';
    case 'hata': return 'cikti.failed';
    default: return null;
  }
}

/**
 * Metin GERÇEKTEN dışarı çıktı mı? Hata, desteklenmeme ve iptal çıkmamış
 * demektir: "avukat bu metni aldı" ölçümü bunlarda tetiklenmemeli.
 */
export function ciktiBasarili(s: CiktiSonuc): boolean {
  return s === 'kopyalandi' || s === 'indirildi' || s === 'paylasildi';
}
