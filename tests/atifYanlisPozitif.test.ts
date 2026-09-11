import { describe, expect, it } from 'vitest';
import { ICTIHAT_DIGESTS } from '../src/data/ictihatDigest';
import { kararAtiflari, tutarsizKararlar } from '../supabase/functions/_shared/kararAtif';

/**
 * YANLIŞ POZİTİF ÖLÇÜMÜ — GERÇEK KARAR KÜNYELERİ ÜZERİNDE.
 *
 * Denetimin en pahalı hatası yanlış pozitiftir: GERÇEK bir Yargıtay kararını
 * "bu atıf olamaz" diye işaretlersek avukat uyarıya bir daha bakmaz ve
 * denetimin tamamı işe yaramaz hâle gelir. Bu yüzden ayrı ölçülüyor.
 *
 * VERİNİN KAYNAĞI ÖNEMLİ. Kullanılan künyeler (daire, esas, karar, tarih)
 * src/data/ictihatDigest.ts'ten geliyor: bu dosya BU TESTTEN ÖNCE, bambaşka
 * bir iş için (uygulama içi içtihat özetleri) gerçek karar metinleri okunarak
 * derlendi. Yani ölçümün girdisini bu testi yazarken ben seçmedim.
 *
 * NEYİ SEÇTİĞİMİ AÇIKÇA SÖYLÜYORUM: künyeleri saran cümle kalıplarını
 * (aşağıdaki KALIPLAR) ben yazdım. Dolayısıyla bu ölçüm "gerçek model
 * çıktısında kaç yanlış pozitif çıkar" sorusunu CEVAPLAMAZ; "gerçek künyeler
 * yaygın yazılışlarla verildiğinde denetim onları yanlışlıkla reddediyor mu"
 * sorusunu cevaplar. Gerçek yapay zekâ çıktısı üzerindeki isabet HENÜZ
 * ÖLÇÜLMEDİ (API bütçesi yok).
 */

/** "Yargıtay 9. Hukuk Dairesi" → { no: 9, tur: 'Hukuk' } */
function daireCoz(daire: string): { no: string; tur: string } {
  const m = daire.match(/(\d{1,2})\s*\.\s*(Hukuk|Ceza)/);
  return { no: m?.[1] ?? '', tur: m?.[2] ?? 'Hukuk' };
}

const KALIPLAR: Array<(d: { daire: string; esas: string; karar: string; tarih: string }) => string> = [
  (d) => `${d.daire}'nin ${d.esas} E., ${d.karar} K. sayılı kararı bu yöndedir.`,
  (d) => {
    const { no, tur } = daireCoz(d.daire);
    return `Nitekim Y. ${no}. ${tur === 'Ceza' ? 'CD' : 'HD'} ${d.esas} E. ${d.karar} K. kararında aynı sonuca varılmıştır.`;
  },
  (d) => `(${d.daire}, ${d.tarih}, ${d.esas} E., ${d.karar} K.)`,
  (d) => `Yerleşik içtihat için bkz. ${d.daire} ${d.esas} Esas ${d.karar} Karar sayılı ilam.`,
];

describe('karar atfı denetimi — gerçek künyelerde yanlış pozitif', () => {
  const kayitlar = ICTIHAT_DIGESTS.map((k) => ({
    daire: k.daire,
    esas: k.esas,
    karar: k.karar,
    tarih: k.tarih,
  }));

  it('ölçüm için yeterli sayıda gerçek künye var', () => {
    // Sayı küçük (20 karar); ölçümün ağırlığı da o kadar. Abartmıyoruz.
    expect(kayitlar.length).toBeGreaterThanOrEqual(20);
  });

  it('gerçek künyelerin HİÇBİRİ "olanaksız" diye işaretlenmez', () => {
    const yanlisPozitifler: string[] = [];
    let toplamCumle = 0;

    for (const k of kayitlar) {
      for (const kalip of KALIPLAR) {
        toplamCumle += 1;
        const metin = kalip(k);
        const atiflar = kararAtiflari(metin);
        // 2026, kayıtlardaki en yeni karardan (2016) sonra; "gelecek yıl"
        // kuralı bu veri kümesinde hiç tetiklenmemeli.
        for (const t of tutarsizKararlar(atiflar, 2026)) {
          yanlisPozitifler.push(`${metin} → ${t.sebep}`);
        }
      }
    }

    // Ölçüm sonucu tek satırda: kaç cümlede kaç yanlış pozitif.
    expect({ cumle: toplamCumle, yanlisPozitif: yanlisPozitifler.length }).toEqual({
      cumle: kayitlar.length * KALIPLAR.length,
      yanlisPozitif: 0,
    });
    expect(yanlisPozitifler).toEqual([]);
  });

  it('gerçek künyelerin esas/karar numaraları eksiksiz çıkarılır', () => {
    // Çıkaramadığımız atıf sessizce denetimsiz kalır — yanlış pozitiften daha
    // az görünür ama aynı ölçüde tehlikeli: uydurma atıf denetimden kaçar.
    const kacanlar: string[] = [];

    for (const k of kayitlar) {
      for (const kalip of KALIPLAR) {
        const metin = kalip(k);
        const a = kararAtiflari(metin);
        const bulundu = a.some(
          (x) =>
            `${x.esasYil}/${x.esasNo}` === k.esas.replace(/\s+/g, '') &&
            `${x.kararYil}/${x.kararNo}` === k.karar.replace(/\s+/g, '')
        );
        if (!bulundu) kacanlar.push(metin);
      }
    }

    expect(kacanlar).toEqual([]);
  });
});
