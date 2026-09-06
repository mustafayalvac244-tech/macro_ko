// SERBEST MESLEK MAKBUZU HESABI — avukatlık ücreti gelirinde KDV ve stopaj.
// ---------------------------------------------------------------------------
// Türkiye'de avukat, ücretini tahsil ederken serbest meslek makbuzu keser.
// Makbuzda üç ayrı tutar vardır ve bunları karıştırmak muhasebe hatasına yol
// açar:
//   • Matrah        — avukatın hizmet bedeli (KDV hariç, "net ücret")
//   • KDV           — matrah üzerinden hesaplanır (avukatlık hizmetinde %20),
//                      müvekkilden ek olarak tahsil edilir, avukata kalmaz.
//   • Stopaj        — GVK m.94 uyarınca kurumsal/bazı gerçek kişi
//                      müvekkiller matrah üzerinden kesinti yapıp doğrudan
//                      vergi dairesine yatırır (avukat bu kısmı hiç görmez).
//
// Avukatın gerçekte eline geçen tutar: matrah + KDV − stopaj. Bu değeri
// "toplam tutar" ile karıştırmak — örneğin stopajı hiç düşmeden "tahsil
// edilecek" demek — nakit akışını yanlış göstermiş olur.

/** Avukatlık hizmetinde standart KDV oranı (%). */
export const VARSAYILAN_KDV_ORANI = 20;
/** GVK m.94/2-b serbest meslek kazancı stopajı (%). */
export const VARSAYILAN_STOPAJ_ORANI = 20;

export interface SmmHesap {
  matrah: number;
  kdvOrani: number | null;
  stopajOrani: number | null;
  kdvTutari: number;
  stopajTutari: number;
  /** Makbuzda/faturada yazan toplam: matrah + KDV. */
  belgeToplami: number;
  /** Avukatın eline geçecek nakit: belge toplamı − stopaj. */
  tahsilEdilecek: number;
}

function yuvarla(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Bir serbest meslek makbuzunun kalemlerini hesaplar. `kdvOrani`/`stopajOrani`
 * `null` verilirse o kesinti hiç uygulanmamış sayılır (ör. gerçek kişi
 * müvekkilden stopajsız tahsilat).
 */
export function hesaplaSmm(
  matrah: number,
  kdvOrani: number | null = null,
  stopajOrani: number | null = null
): SmmHesap {
  const guvenliMatrah = Number.isFinite(matrah) && matrah > 0 ? matrah : 0;
  const kdvTutari = kdvOrani != null ? yuvarla((guvenliMatrah * kdvOrani) / 100) : 0;
  const stopajTutari = stopajOrani != null ? yuvarla((guvenliMatrah * stopajOrani) / 100) : 0;
  const belgeToplami = yuvarla(guvenliMatrah + kdvTutari);
  const tahsilEdilecek = yuvarla(belgeToplami - stopajTutari);
  return {
    matrah: guvenliMatrah,
    kdvOrani,
    stopajOrani,
    kdvTutari,
    stopajTutari,
    belgeToplami,
    tahsilEdilecek,
  };
}
