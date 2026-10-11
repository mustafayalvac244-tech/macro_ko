import { afterEach, describe, expect, it, vi } from 'vitest';
import { aramaKatla, aramaNormalize } from '@/utils/arama';
import { parseCitation, searchMevzuat } from '@/data/laws/searchMevzuat';

/**
 * MEVZUAT ARAMASI (23. denetim ajanı, 10.10.2026) — dört doğrulanmış kusur:
 *  1. "İİK 72" tanınmıyordu: künye kısaltması listesi elle 7 kanundu; tanınmayınca
 *     HER kanunun m.72'si +20 alıp TCK 72 en üste çıkıyordu.
 *  2. Harfli alt madde ("217/A") yalnız "217" okunuyordu ve büyük/küçük harf duyarlıydı
 *     (İİK'te "169/a", TCK'de "217/A").
 *  3. Şapkalı harf katlanmıyordu (hakim ≠ hâkim) — Anayasa ve kanun gezgini aramasında.
 *  4. Web'de bir kanun inemezse EKSİK indeks kalıcı saklanıyordu.
 */
describe('künye ayrıştırma — kısaltma LAW_INDEX\'ten gelir', () => {
  it('"İİK 72" İcra ve İflas Kanunu m.72\'dir (eskiden hiçbir kanuna eşlenmiyordu)', () => {
    expect(parseCitation('İİK 72')).toMatchObject({ kod: 'İİK', no: '72' });
    const [ilk] = searchMevzuat('İİK 72');
    expect(ilk.kod).toBe('İİK');
    expect(ilk.no).toBe('72');
  });

  it('16 kanunun hepsinin kısaltması tanınır', () => {
    const beklenen: Array<[string, string]> = [
      ['tck 125', 'TCK'], ['TMK 1', 'TMK'], ['tbk 49', 'TBK'], ['hmk 107', 'HMK'], ['cmk 100', 'CMK'],
      ['ttk 18', 'TTK'], ['iik 169', 'İİK'], ['iyuk 49', 'İYUK'], ['tkhk 11', 'TKHK'], ['işmk 3', 'İşMK'],
      ['avk 164', 'AvK'], ['ssgss 4', 'SSGSS'], ['kamk 10', 'KamK'], ['aatuhk 48', 'AATUHK'],
      ['aymk 45', 'AYMK'], ['iş k 17', 'İşK'], ['İşK 17', 'İşK'],
    ];
    for (const [q, kod] of beklenen) expect(parseCitation(q).kod, q).toBe(kod);
  });

  it('kısaltma başka sözcüğün içinde geçiyorsa künye sayılmaz ("risk", "tckler")', () => {
    expect(parseCitation('risk 5').kod).toBeUndefined();
    expect(parseCitation('kısıtlama 7').kod).toBeUndefined();
  });

  it('kısaltma yoksa yalnız numara okunur', () => {
    expect(parseCitation('madde 6')).toMatchObject({ kod: undefined, no: '6' });
  });
});

describe('harfli alt madde', () => {
  it('"TCK 217/A" ayrıştırılır', () => {
    expect(parseCitation('TCK 217/A')).toMatchObject({ kod: 'TCK', no: '217', harf: 'a' });
    expect(parseCitation('tck 217 / a')).toMatchObject({ no: '217', harf: 'a' });
  });

  it('"217/a" ve "217/A" aynı maddeyi bulur (büyük/küçük harf duyarsız)', () => {
    const a = searchMevzuat('TCK 217/a')[0];
    const b = searchMevzuat('TCK 217/A')[0];
    expect(a.no).toBe('217/A');
    expect(b.no).toBe('217/A');
    expect(a.kod).toBe('TCK');
  });

  it('"217" yazınca 217/A değil 217 gelir; harfli madde yalnız harfle aranınca gelir', () => {
    expect(searchMevzuat('TCK 217')[0].no).toBe('217');
  });

  it('İİK\'nın küçük harfli alt maddesi ("169/a") büyük harfle yazılsa da bulunur', () => {
    const h = searchMevzuat('İİK 169/A')[0];
    expect(h.kod).toBe('İİK');
    expect(h.no).toBe('169/a');
  });

  it('harf sözcüğün başı değildir: "217/agir" harf sayılmaz', () => {
    expect(parseCitation('217/agir').harf).toBeUndefined();
  });
});

describe('Türkçe katlama — şapkalı harf', () => {
  it('"hakim" ve "hâkim" aynı sonucu verir', () => {
    const ad = (q: string) => searchMevzuat(q, 6).map((h) => `${h.kod}-${h.no}`);
    expect(ad('hakim')).toEqual(ad('hâkim'));
    expect(ad('hakim').length).toBeGreaterThan(0);
  });

  it('aramaNormalize şapkalı harfi düzler; aramaKatla uzunluğu korur', () => {
    expect(aramaNormalize('Hâkimler ve Savcılar')).toBe('hakimler ve savcilar');
    expect(aramaNormalize('millî lâik kanunî')).toBe('milli laik kanuni');
    const s = 'İĞNE Hâkim  ışık   ÇOK';
    expect(aramaKatla(s).length).toBe(s.length);
    expect(aramaKatla(s)).toBe('igne hakim  isik   cok');
  });
});

describe('web: eksik indeks KALICI saklanmaz', () => {
  afterEach(() => {
    vi.doUnmock('@/data/laws/loader');
    vi.resetModules();
  });

  it('bir kanun inemezse indeks "tam" sayılmaz; ağ düzelince tamamlanır', async () => {
    vi.resetModules();
    const inenler = new Set<string>();
    const durum = { bInebilir: false };
    vi.doMock('@/data/laws/loader', () => ({
      LAW_INDEX: [
        { short: 'AAA', name: 'A Kanunu', slug: 'a', count: 1 },
        { short: 'BBB', name: 'B Kanunu', slug: 'b', count: 1 },
      ],
      ensureLaw: async (slug: string) => {
        if (slug === 'b' && !durum.bInebilir) throw new Error('ağ yok');
        inenler.add(slug);
      },
      lawReady: (slug: string) => inenler.has(slug),
      loadLaw: (slug: string) =>
        inenler.has(slug)
          ? { short: slug.toUpperCase().repeat(3), name: `${slug} Kanunu`, source: '', articles: [{ no: '1', text: `${slug} haksız fiil tazminatı` }] }
          : null,
    }));
    const m = await import('@/data/laws/searchMevzuat');

    // 1) ağ hatası: indeks eksik, kalıcı DEĞİL; inen kanunda arama yine çalışır
    expect(await m.warmMevzuatIndex()).toBe(false);
    expect(m.mevzuatIndeksiHazir()).toBe(false);
    expect(m.searchMevzuat('haksız fiil').map((h) => h.kod)).toEqual(['AAA']);

    // 2) ağ düzeldi: aynı çağrı eksik kanunu yeniden dener ve indeksi tamamlar
    durum.bInebilir = true;
    expect(await m.warmMevzuatIndex()).toBe(true);
    expect(m.mevzuatIndeksiHazir()).toBe(true);
    expect(m.searchMevzuat('haksız fiil').map((h) => h.kod).sort()).toEqual(['AAA', 'BBB']);
  });
});
