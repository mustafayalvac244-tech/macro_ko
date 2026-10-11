// PROFİL DÜZENLEME — saf mantık (bkz. app/profile-form.tsx).

export type ProfilKayitSonucu = 'tamam' | 'metin-hatasi' | 'foto-hatasi';

/**
 * Önce metin alanları, sonra (varsa) fotoğraf değişikliği yazılır; hangi
 * adımın düştüğü AYRI bildirilir.
 *
 * NEDEN (09.10.2026): tek bir catch ikisini de "Profil kaydedilemedi" ile
 * karşılıyordu. Fotoğraf yüklenemediğinde metin aslında kaydedilmişti ama
 * kullanıcı her şeyin kaybolduğunu sanıyordu. Metin düşerse fotoğraf hiç
 * denenmez (önceki sıra korunuyor).
 */
export async function profiliKaydet(adim: {
  metniKaydet: () => Promise<void>;
  fotoyuUygula: (() => Promise<void>) | null;
}): Promise<ProfilKayitSonucu> {
  try {
    await adim.metniKaydet();
  } catch {
    return 'metin-hatasi';
  }
  if (!adim.fotoyuUygula) return 'tamam';
  try {
    await adim.fotoyuUygula();
  } catch {
    return 'foto-hatasi';
  }
  return 'tamam';
}

export type FotoSecimSonucu = 'secildi' | 'vazgecildi' | 'izin-yok';

/**
 * Seçici `null` döndüğünde vazgeçme ile izin reddini ayırır.
 *
 * pickImageFile/takePhotoFile (hooks/useDocuments) izin verilmezse de null
 * döner; ekran eskiden ikisini ayırmıyor, izin reddinde SESSİZ kalıyordu.
 * İzin durumu okunamadıysa (null) "izin yok" denmez — uydurma uyarı yok.
 */
export function fotoSecimSonucu(dosyaVar: boolean, izinVerildi: boolean | null): FotoSecimSonucu {
  if (dosyaVar) return 'secildi';
  return izinVerildi === false ? 'izin-yok' : 'vazgecildi';
}
