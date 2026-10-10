import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

/**
 * DAVA SİLİNDİKTEN SONRA KALANLAR (09.10.2026).
 *
 * 08.10'da bildirim iptali ve liste tazeleme eklendi; üç artık kalmıştı:
 *  - ÇALIŞAN SAYAÇ: silinen davada sayaç açıksa durmuyordu. Sayaç yalnız o
 *    davanın Zaman sekmesinden durdurulabildiği için kalıcı takılıyor, öbür
 *    bütün davalarda "Başka bir dosyada sayaç çalışıyor: <silinen dava>"
 *    yazıp Başlat'ı kapatıyordu (çıkış yapana kadar).
 *  - DURUŞMA PLANI: cihazdaki VEKIL_WARPLAN_<id> (brief, notlar, değerlendirme)
 *    hiç silinmiyordu.
 *  - ÖNBELLEK: arama sonuçları ve müvekkil avans bakiyesi/ana ekran avans
 *    uyarısı (silinen davanın masrafları cascade ile gitti) tazelenmiyordu;
 *    silinen davanın KENDİ sorguları ise boşuna yeniden çekiliyordu.
 */

const depo = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => depo.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      depo.set(k, v);
    },
    removeItem: async (k: string) => {
      depo.delete(k);
    },
  },
}));

const { useSayacStore } = await import('@/store/sayacStore');
const { silinenDavaninYerelArtiklariniSil, silinenDavaOnbelleginiTazele } = await import('@/lib/silinenDava');

beforeEach(() => {
  depo.clear();
  useSayacStore.setState({ caseId: null, caseTitle: null, startedAt: null });
});

describe('silinen davanın cihazdaki artıkları', () => {
  it('sayaç silinen davada çalışıyorsa durdurulur', async () => {
    useSayacStore.getState().baslat('d1', 'Silinen dava');
    await silinenDavaninYerelArtiklariniSil('d1');
    expect(useSayacStore.getState().startedAt).toBeNull();
    expect(useSayacStore.getState().caseId).toBeNull();
  });

  it('başka davada çalışan sayaca dokunulmaz', async () => {
    useSayacStore.getState().baslat('d2', 'Başka dava');
    await silinenDavaninYerelArtiklariniSil('d1');
    expect(useSayacStore.getState().caseId).toBe('d2');
    expect(useSayacStore.getState().startedAt).not.toBeNull();
  });

  it('duruşma planı cihazdan silinir, başka davanınki kalır', async () => {
    depo.set('VEKIL_WARPLAN_d1', JSON.stringify({ notes: [{ at: '00:10', text: 'gizli not' }] }));
    depo.set('VEKIL_WARPLAN_d2', JSON.stringify({ notes: [] }));
    await silinenDavaninYerelArtiklariniSil('d1');
    expect(depo.has('VEKIL_WARPLAN_d1')).toBe(false);
    expect(depo.has('VEKIL_WARPLAN_d2')).toBe(true);
  });
});

describe('silinen davanın önbelleği', () => {
  /** Ekranda açık bir sorguyu taklit eder: gözlemci + çağrı sayacı. */
  function acikSorgu(qc: QueryClient, anahtar: unknown[], veri: unknown) {
    const cagri = vi.fn(async () => veri);
    qc.setQueryData(anahtar, veri);
    const gozlemci = new QueryObserver(qc, { queryKey: anahtar, queryFn: cagri, staleTime: Infinity });
    const birak = gozlemci.subscribe(() => {});
    return { cagri, birak };
  }

  it('başka ekranlardaki bayat kopyalar tazelenir (arama, müvekkil avans bakiyesi, ana ekran avans uyarısı)', () => {
    const qc = new QueryClient();
    for (const k of [['global-search', 'kira'], ['client-expenses-total', 'm1'], ['advance-deficits'], ['cases', 'u1', '', 'all']]) {
      qc.setQueryData(k, []);
    }
    silinenDavaOnbelleginiTazele(qc, 'd1');
    expect(qc.getQueryState(['global-search', 'kira'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['client-expenses-total', 'm1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['advance-deficits'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['cases', 'u1', '', 'all'])?.isInvalidated).toBe(true);
  });

  it('duruşma planı sorgusu önbellekten kaldırılır', () => {
    const qc = new QueryClient();
    qc.setQueryData(['brief', 'd1'], { content: { notes: [{ at: '00:10', text: 'gizli not' }] } });
    qc.setQueryData(['brief', 'd2'], { content: {} });
    silinenDavaOnbelleginiTazele(qc, 'd1');
    expect(qc.getQueryData(['brief', 'd1'])).toBeUndefined();
    expect(qc.getQueryData(['brief', 'd2'])).toBeDefined();
  });

  it('silinen davanın açık sorguları yeniden ÇEKİLMEZ ama bayat işaretlenir; başka davanınkiler çekilir', async () => {
    const qc = new QueryClient();
    const detay = acikSorgu(qc, ['cases', 'detail', 'd1'], { id: 'd1' });
    const odemeler = acikSorgu(qc, ['payments', 'byCase', 'd1'], []);
    const baskaDava = acikSorgu(qc, ['payments', 'byCase', 'd2'], []);

    silinenDavaOnbelleginiTazele(qc, 'd1');
    await new Promise((r) => setTimeout(r, 0));

    expect(detay.cagri).not.toHaveBeenCalled();
    expect(odemeler.cagri).not.toHaveBeenCalled();
    expect(qc.getQueryState(['cases', 'detail', 'd1'])?.isInvalidated).toBe(true);
    expect(baskaDava.cagri).toHaveBeenCalledTimes(1);
    [detay, odemeler, baskaDava].forEach((s) => s.birak());
  });
});
