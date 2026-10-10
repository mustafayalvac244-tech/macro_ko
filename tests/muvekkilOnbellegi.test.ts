import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { muvekkilDegisinceTazele, silinenMuvekkilOnbelleginiTazele } from '@/lib/muvekkilOnbellegi';

/**
 * MÜVEKKİL DÜZENLENİNCE / SİLİNİNCE LİSTELER BAYAT KALIYORDU (10.10.2026).
 *
 * useUpdateClient ve useDeleteClient yalnız ['clients'] önbelleğini tazeliyordu.
 * Oysa müvekkil adı başka ekranlarda kopyalanmış olarak duruyor: dava ve icra
 * listeleri (`client:clients(id, full_name, company)` birleşimi), alacak/taksit
 * listesi, vekaletname listesi, arama sonuçları. Ad değişince ya da müvekkil
 * silinince bu ekranlar eski adı göstermeye devam ediyordu (silinen müvekkilin
 * davası listede hâlâ onun adıyla; ana ekran sayaçları eski).
 * Silinen müvekkilin KENDİ sorguları ise (detay, avans, alacak…) boşuna yeniden
 * çekiliyordu: kayıt yok; ekran kapanırken "bulunamadı"ya zıplıyordu.
 */

/** Ekranda açık bir sorguyu taklit eder: gözlemci + çağrı sayacı. */
function acikSorgu(qc: QueryClient, anahtar: unknown[], veri: unknown) {
  const cagri = vi.fn(async () => veri);
  qc.setQueryData(anahtar, veri);
  const gozlemci = new QueryObserver(qc, { queryKey: anahtar, queryFn: cagri, staleTime: Infinity });
  const birak = gozlemci.subscribe(() => {});
  return { cagri, birak };
}

const ADI_TASIYANLAR: unknown[][] = [
  ['clients', 'u1', ''],
  ['cases', 'u1', '', 'all'],
  ['enforcements', 'u1'],
  ['promises', 'all', 'u1'],
  ['poa', 'u1', 'all'],
  ['global-search', 'kaya'],
];

describe('müvekkil düzenlenince', () => {
  it('adını taşıyan başka ekranların kopyaları bayat işaretlenir', () => {
    const qc = new QueryClient();
    for (const k of ADI_TASIYANLAR) qc.setQueryData(k, []);
    muvekkilDegisinceTazele(qc);
    for (const k of ADI_TASIYANLAR) expect(qc.getQueryState(k)?.isInvalidated, k.join('/')).toBe(true);
  });

  it('ilgisiz önbelleğe dokunulmaz', () => {
    const qc = new QueryClient();
    qc.setQueryData(['finance', 'entries', 'u1'], []);
    muvekkilDegisinceTazele(qc);
    expect(qc.getQueryState(['finance', 'entries', 'u1'])?.isInvalidated).toBe(false);
  });
});

describe('müvekkil silinince', () => {
  it('cascade ile giden ve bağlantısı kalkan kayıtları gösteren her liste tazelenir', () => {
    const qc = new QueryClient();
    const ek: unknown[][] = [
      ['documents', 'u1', 'all'],
      ['client-expenses-total', 'm2'],
      ['advance-deficits'],
      ['dashboard-stats', 'u1'],
    ];
    for (const k of [...ADI_TASIYANLAR, ...ek]) qc.setQueryData(k, []);
    silinenMuvekkilOnbelleginiTazele(qc, 'm1');
    for (const k of [...ADI_TASIYANLAR, ...ek]) expect(qc.getQueryState(k)?.isInvalidated, k.join('/')).toBe(true);
  });

  it('silinen müvekkilin açık sorguları yeniden ÇEKİLMEZ ama bayat işaretlenir; başkasınınkiler çekilir', async () => {
    const qc = new QueryClient();
    const kendi = [
      acikSorgu(qc, ['clients', 'detail', 'm1'], { id: 'm1' }),
      acikSorgu(qc, ['client-advances', 'm1'], []),
      acikSorgu(qc, ['promises', 'm1'], []),
      acikSorgu(qc, ['cases', 'byClient', 'm1'], []),
    ];
    const baskasi = acikSorgu(qc, ['promises', 'm2'], []);

    silinenMuvekkilOnbelleginiTazele(qc, 'm1');
    await new Promise((r) => setTimeout(r, 0));

    for (const s of kendi) expect(s.cagri).not.toHaveBeenCalled();
    expect(qc.getQueryState(['clients', 'detail', 'm1'])?.isInvalidated).toBe(true);
    expect(baskasi.cagri).toHaveBeenCalledTimes(1);
    [...kendi, baskasi].forEach((s) => s.birak());
  });
});
