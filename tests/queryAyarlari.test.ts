import { describe, expect, it, vi } from 'vitest';
import { MutationObserver, QueryClient, onlineManager } from '@tanstack/query-core';
import {
  QUERY_VARSAYILANLARI,
  odakYonetimineBagla,
  queryCacheBuster,
} from '../src/lib/queryAyarlari';

/**
 * AJAN 28 — ağ/önbellek (bulgu 10-12). Gerçek QueryClient ile: tarayıcı
 * "çevrimdışı" derken sorgu/kaydetme sessizce BEKLEMEYE alınmasın.
 */
describe('networkMode', () => {
  it('tarayıcı çevrimdışıyken sorgu yine denenir ve HATA verir (sonsuz bekleme yok)', async () => {
    onlineManager.setOnline(false);
    try {
      const istemci = new QueryClient({
        defaultOptions: { ...QUERY_VARSAYILANLARI, queries: { ...QUERY_VARSAYILANLARI.queries, retry: false } },
      });
      const fn = vi.fn().mockRejectedValue(new Error('Network request failed'));
      await istemci.fetchQuery({ queryKey: ['k'], queryFn: fn }).catch(() => {});
      expect(fn).toHaveBeenCalledTimes(1);
      expect(istemci.getQueryState(['k'])?.status).toBe('error');
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('çevrimdışıyken kaydetme BEKLEMEZ, çalışır ve hatası kullanıcıya düşer', async () => {
    onlineManager.setOnline(false);
    try {
      const istemci = new QueryClient({ defaultOptions: QUERY_VARSAYILANLARI });
      const fn = vi.fn().mockRejectedValue(new Error('Network request failed'));
      const gozlemci = new MutationObserver(istemci, { mutationFn: fn });
      await gozlemci.mutate(undefined).catch(() => {});
      expect(fn).toHaveBeenCalledTimes(1);
      expect(gozlemci.getCurrentResult().status).toBe('error');
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('queryCacheBuster', () => {
  it('şema ya da uygulama sürümü değişince değer değişir (eski önbellek atılır)', () => {
    expect(queryCacheBuster('1', '3.4.0')).not.toBe(queryCacheBuster('2', '3.4.0'));
    expect(queryCacheBuster('1', '3.4.0')).not.toBe(queryCacheBuster('1', '3.5.0'));
    expect(queryCacheBuster('1', '3.4.0')).toBe(queryCacheBuster('1', '3.4.0'));
  });
  it('sürüm okunamazsa da çökmez', () => {
    expect(typeof queryCacheBuster('1', undefined)).toBe('string');
  });
});

describe('odakYonetimineBagla (native uygulama öne gelince tazele)', () => {
  function kur() {
    let kancaOlay: ((durum: string) => void) | null = null;
    const kaldir = vi.fn();
    const appState = {
      addEventListener: (_tur: 'change', f: (durum: string) => void) => {
        kancaOlay = f;
        return { remove: kaldir };
      },
    };
    let ayarlayici: (odak: (odakta?: boolean) => void) => () => void = () => () => {};
    const focusManager = {
      setEventListener: (f: (odak: (odakta?: boolean) => void) => () => void) => void (ayarlayici = f),
    };
    odakYonetimineBagla(focusManager, appState);
    const odak = vi.fn();
    const temizle = ayarlayici(odak);
    return { odak, temizle, kaldir, olay: (d: string) => kancaOlay!(d) };
  }
  it('active → odakta, background/inactive → odak dışı', () => {
    const { odak, olay } = kur();
    olay('active');
    olay('background');
    olay('inactive');
    expect(odak.mock.calls).toEqual([[true], [false], [false]]);
  });
  it('temizleme AppState dinleyicisini kaldırır', () => {
    const { temizle, kaldir } = kur();
    temizle();
    expect(kaldir).toHaveBeenCalledTimes(1);
  });
});
