import { afterEach, describe, expect, it, vi } from 'vitest';
import * as natif from '@/data/laws/loader';
import * as web from '@/data/laws/loader.web';

/**
 * KANUN YÜKLEYİCİSİNİN İKİ SÜRÜMÜ.
 *
 * BULUNAN KUSUR (ölçüm, 2026-09-10): 16 kanun JSON'u (diskte 4,89 MB) web JS
 * paketine gömülüyordu — kullanıcı Mevzuat ekranını hiç açmasa bile her
 * açılışta iniyordu. Ölçülen paket: 13.446.844 bayt ham / 2.908.585 bayt gzip.
 * Metro tree-shaking yapmadığı için `Platform.OS === 'web'` kontrolü bunu
 * ÇÖZMEZ; tek yol modülü platforma göre AYIRMAK (loader.web.ts).
 *
 * BU TESTİN VARLIK SEBEBİ: iki dosya artık elle senkron tutuluyor. Birinde
 * bir dışa aktarım eklenip diğerinde unutulursa TypeScript bunu YAKALAMAZ —
 * tsc yalnız `./loader`ı (natif) çözer, `.web.ts` başka bir modül olarak
 * derlenir ve çağıran kod web'de çalışma anında patlar. Aşağıdaki karşılaştırma
 * o sessiz sapmayı derleme değil, TEST zamanında yakalar.
 */
describe('kanun yükleyici — natif ve web sürümü', () => {
  it('aynı dışa aktarım kümesine sahiptir', () => {
    const anahtar = (m: object) => Object.keys(m).sort();
    expect(anahtar(web)).toEqual(anahtar(natif));
  });

  it('LAW_INDEX iki sürümde de aynıdır (dizin her ikisinde de gömülü)', () => {
    expect(web.LAW_INDEX).toEqual(natif.LAW_INDEX);
    expect(natif.LAW_INDEX.length).toBeGreaterThan(0);
  });
});

describe('natif yükleyici', () => {
  it('kanunu senkron döndürür (metin pakette gömülü)', () => {
    const law = natif.loadLaw('turk-ceza');
    expect(law?.short).toBe('TCK');
    expect(law?.articles.length).toBeGreaterThan(0);
  });

  it('bilinmeyen slug için null döner', () => {
    expect(natif.loadLaw('olmayan-kanun')).toBeNull();
  });

  it('lawReady natifte her zaman true (indirme yok)', () => {
    expect(natif.lawReady('turk-ceza')).toBe(true);
    expect(natif.lawReady('olmayan-kanun')).toBe(false);
  });
});

describe('web yükleyici', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ensureLaw çağrılmadan metin YOK, çağrıldıktan sonra VAR', async () => {
    const sahte = { short: 'TCK', name: 'test', source: 'test', articles: [{ no: '1', text: 'a' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => sahte }))
    );

    expect(web.lawReady('turk-ceza')).toBe(false);
    expect(web.loadLaw('turk-ceza')).toBeNull();

    await web.ensureLaw('turk-ceza');

    expect(web.lawReady('turk-ceza')).toBe(true);
    expect(web.loadLaw('turk-ceza')?.short).toBe('TCK');
  });

  it('aynı kanun için eşzamanlı çağrılar TEK indirme yapar', async () => {
    const sahte = { short: 'HMK', name: 'test', source: 'test', articles: [] };
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => sahte }));
    vi.stubGlobal('fetch', f);

    await Promise.all([web.ensureLaw('hmk'), web.ensureLaw('hmk'), web.ensureLaw('hmk')]);

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('önbellekteki kanun için ağa TEKRAR gitmez', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ short: 'x', name: '', source: '', articles: [] }) }));
    vi.stubGlobal('fetch', f);

    await web.ensureLaw('cmk');
    await web.ensureLaw('cmk');

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('HTTP hatası yutulmaz — çağıran ekran "yüklenemedi" diyebilsin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    await expect(web.ensureLaw('iik')).rejects.toThrow(/404/);
    expect(web.lawReady('iik')).toBe(false);
  });

  it('bilinmeyen slug için ağa hiç gitmez', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);

    await web.ensureLaw('olmayan-kanun');

    expect(f).not.toHaveBeenCalled();
    expect(web.loadLaw('olmayan-kanun')).toBeNull();
  });

  it('istek yolu public/veri/kanun altına gider (dışa aktarımın koyduğu yer)', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ short: 'y', name: '', source: '', articles: [] }) }));
    vi.stubGlobal('fetch', f);

    await web.ensureLaw('avukatlik');

    const url = f.mock.calls[0][0] as string;
    expect(url.endsWith('/veri/kanun/avukatlik.json')).toBe(true);
  });
});
