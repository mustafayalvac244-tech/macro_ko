import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { anonimIstekKorumasi, diskOturumunuCoz, oturumAnahtari } from '../src/lib/oturumKorumasi';

/**
 * ÇEVRİMDIŞI AÇILIŞIN GÜVENLİK TARAFI (09.10.2026).
 *
 * Uygulama diskteki oturumla açıldığında jeton henüz yenilenmemiş olabilir.
 * supabase-js o durumda isteği SESSİZCE anonim anahtarla gönderir
 * (_getAccessToken: `session?.access_token ?? supabaseKey`). Anonim istek RLS
 * yüzünden HATA DEĞİL BOŞ LİSTE döner — önbellekteki davalar boş listeyle
 * ezilir, avukat "davalarım silinmiş" sanır. Koruma, cihazda oturum varken
 * anonim gidecek isteği ağ hatası gibi keser: önbellek yerinde kalır.
 */
const ANON = 'anon-anahtari';
const URL_REST = 'https://proje.supabase.co/rest/v1/cases?select=*';
const URL_AUTH = 'https://proje.supabase.co/auth/v1/token?grant_type=refresh_token';

function sahte() {
  const giden: string[] = [];
  const asil = (async (input: RequestInfo | URL) => {
    giden.push(String(input));
    return new Response('[]', { status: 200 });
  }) as typeof fetch;
  return { asil, giden };
}

describe('anonimIstekKorumasi', () => {
  it('cihazda oturum varken anonim REST isteği gönderilmez, ağ hatası olur', async () => {
    const { asil, giden } = sahte();
    const f = anonimIstekKorumasi(asil, ANON, async () => true);
    const h = new Headers({ Authorization: `Bearer ${ANON}`, apikey: ANON });
    await expect(f(URL_REST, { headers: h })).rejects.toThrow(/Network request failed/);
    expect(giden).toEqual([]);
  });

  it('cihazda oturum yoksa (çıkış yapılmış) anonim istek geçer', async () => {
    const { asil, giden } = sahte();
    const f = anonimIstekKorumasi(asil, ANON, async () => false);
    await f(URL_REST, { headers: { Authorization: `Bearer ${ANON}` } });
    expect(giden).toEqual([URL_REST]);
  });

  it('kullanıcı jetonlu istek her zaman geçer ve disk okunmaz', async () => {
    const { asil, giden } = sahte();
    let okundu = 0;
    const f = anonimIstekKorumasi(asil, ANON, async () => {
      okundu++;
      return true;
    });
    await f(URL_REST, { headers: new Headers({ Authorization: 'Bearer kullanici-jetonu' }) });
    expect(giden).toEqual([URL_REST]);
    expect(okundu).toBe(0);
  });

  it('kimlik uçları (/auth/v1/) hiç kesilmez — jeton yenileme buradan geçer', async () => {
    const { asil, giden } = sahte();
    const f = anonimIstekKorumasi(asil, ANON, async () => true);
    await f(URL_AUTH, { headers: { Authorization: `Bearer ${ANON}` } });
    expect(giden).toEqual([URL_AUTH]);
  });

  it('disk okuması hata verirse istek engellenmez', async () => {
    const { asil, giden } = sahte();
    const f = anonimIstekKorumasi(asil, ANON, async () => {
      throw new Error('depo kapalı');
    });
    await f(URL_REST, { headers: { Authorization: `Bearer ${ANON}` } });
    expect(giden).toEqual([URL_REST]);
  });
});

describe('oturumAnahtari', () => {
  it('supabase-js\'in varsayılan depolama anahtarıyla birebir aynı', () => {
    for (const adres of ['https://wjshlysfmeqlnfiibknj.supabase.co', 'https://placeholder.supabase.co']) {
      const istemci = createClient(adres, 'k', { auth: { persistSession: false, autoRefreshToken: false } });
      const kutuphane = (istemci as unknown as { storageKey: string }).storageKey;
      expect(kutuphane).toBeTruthy();
      expect(oturumAnahtari(adres)).toBe(kutuphane);
    }
  });
});

describe('diskOturumunuCoz', () => {
  const gecerli = { access_token: 'a', refresh_token: 'r', expires_at: 1, token_type: 'bearer', user: { id: 'u1' } };

  it('auth-js kaydını çözer', () => {
    expect(diskOturumunuCoz(JSON.stringify(gecerli))).toEqual(gecerli);
  });

  it('boş, bozuk ya da eksik kayıtta null', () => {
    expect(diskOturumunuCoz(null)).toBeNull();
    expect(diskOturumunuCoz('')).toBeNull();
    expect(diskOturumunuCoz('{bozuk')).toBeNull();
    expect(diskOturumunuCoz('null')).toBeNull();
    expect(diskOturumunuCoz(JSON.stringify({ ...gecerli, refresh_token: undefined }))).toBeNull();
    expect(diskOturumunuCoz(JSON.stringify({ ...gecerli, user: undefined }))).toBeNull();
  });
});
