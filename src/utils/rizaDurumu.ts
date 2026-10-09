// KVKK RIZA KARTININ DURUMU — saf mantık (bkz. src/components/KvkkRizaKarti.tsx).

export interface RizaSatiri {
  onay: boolean;
  surum: string;
  verildi_at: string;
}

export type RizaDurumu = 'okunamadi' | 'var' | 'geri-alindi' | 'kayit-yok';

/**
 * "Şu an rıza var mı" — en son satıra bakılarak.
 *
 * OKUMA HATASI ÖNCE GELİR (09.10.2026). Kart eskiden sorgu hatasında satırı
 * null yapıp "KAYIT BULUNAMADI" yazıyordu: okunamayan kayıt, olmayan kayıt
 * sayılıyordu. Hata varsa durum bilinmiyor demektir; elde kalan eski satıra
 * da güvenilmez (arada geri alınmış/verilmiş olabilir).
 */
export function rizaDurumu(son: RizaSatiri | null, okumaHatasi: boolean): RizaDurumu {
  if (okumaHatasi) return 'okunamadi';
  if (son?.onay === true) return 'var';
  return son ? 'geri-alindi' : 'kayit-yok';
}
