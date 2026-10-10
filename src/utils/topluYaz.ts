/**
 * TOPLU AKTARIM — bir satırın müvekkil + dava yazımı (saf; tests/topluYaz.test.ts).
 *
 * Her satırda önce müvekkil, sonra dava yazılır. Dava reddedilirse (ücretsiz
 * planda dava sınırı 5, müvekkil sınırı 10 — dava önce dolar; ya da ağ koptu)
 * o satır için AZ ÖNCE açılan müvekkil davasız kalırdı. Burada geri alınır.
 *
 * YALNIZ bu çağrıda açılan müvekkil silinir: var olan müvekkile dokunulmaz.
 * Geri alma da başarısız olursa asıl hata (dava hatası) yine de fırlar —
 * kullanıcı "plan doldu" cümlesini görmeli, silme hatasını değil.
 */
export interface MuvekkilDavaIslemleri {
  /** Eşleşen var olan müvekkilin kimliği (varsa). */
  varOlanKimlik: string | undefined;
  /** Satırda müvekkil adı var mı. */
  muvekkilVar: boolean;
  muvekkilOlustur: () => Promise<{ id: string }>;
  davaOlustur: (muvekkilKimligi: string | undefined) => Promise<unknown>;
  muvekkilSil: (kimlik: string) => Promise<unknown>;
}

export async function muvekkilleDavaYaz(
  i: MuvekkilDavaIslemleri
): Promise<{ kimlik: string | undefined; yeniAcildi: boolean }> {
  let kimlik = i.varOlanKimlik;
  let yeniAcildi = false;
  if (i.muvekkilVar && !kimlik) {
    kimlik = (await i.muvekkilOlustur()).id;
    yeniAcildi = true;
  }
  try {
    await i.davaOlustur(kimlik);
  } catch (hata) {
    if (yeniAcildi && kimlik) {
      try {
        await i.muvekkilSil(kimlik);
      } catch {
        // Geri alınamadı: asıl hata önemli, aşağıda fırlatılıyor.
      }
    }
    throw hata;
  }
  return { kimlik, yeniAcildi };
}
