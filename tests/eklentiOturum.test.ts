import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// eklenti saf JS; tip tanımı yok, vitest doğrudan okuyor
import * as api from '../extension/lib/api.js';

/**
 * EKLENTİ OTURUMU (10.10.2026, 50 denetçinin 29. alanı).
 *
 * Denetçi iddiası: "Sayfadan dosya aç" ölü — `girisYap` hiçbir yerden
 * çağrılmıyor, jeton hiç yazılmıyor, düğme hep "Önce giriş yapın" diyor.
 * Doğrulandı: panel.js yalnız `oturumOku`yu çağırıyordu; paneldeki uygulama
 * ise BAŞKA bir origin'de (vekilpro.app) çalıştığı için oturumu eklentinin
 * deposuna yazamaz. Jeton ayrıca kalıcı diske (storage.local) değil, tarayıcı
 * kapanınca silinen belleğe (storage.session) yazılmalı.
 */

type Depo = { veri: Record<string, unknown>; get: (k: string) => Promise<Record<string, unknown>>; set: (o: Record<string, unknown>) => Promise<void>; remove: (k: string) => Promise<void> };
const depo = (): Depo => {
  const veri: Record<string, unknown> = {};
  return {
    veri,
    get: async (k) => (k in veri ? { [k]: veri[k] } : {}),
    set: async (o) => void Object.assign(veri, o),
    remove: async (k) => void delete veri[k],
  };
};

const g = globalThis as Record<string, unknown>;
let yerel: Depo;
let oturum: Depo;
let istekler: { url: string; init: RequestInit }[];
let cevaplar: { status: number; govde: unknown }[];

beforeEach(() => {
  yerel = depo();
  oturum = depo();
  istekler = [];
  cevaplar = [];
  g.chrome = { storage: { local: yerel, session: oturum } };
  g.fetch = async (url: string, init: RequestInit) => {
    istekler.push({ url, init });
    const c = cevaplar.shift() ?? { status: 200, govde: {} };
    return { ok: c.status >= 200 && c.status < 300, status: c.status, json: async () => c.govde, text: async () => JSON.stringify(c.govde) };
  };
});
afterEach(() => {
  delete g.chrome;
  delete g.fetch;
});

const GIRIS = { access_token: 'erisim-1', refresh_token: 'yenile-1', user: { id: 'u1', email: 'a@b.c' } };

describe('eklenti oturumu — jeton diske değil belleğe yazılır', () => {
  it('girişte jeton storage.session\'a yazılır, storage.local\'a YAZILMAZ', async () => {
    cevaplar.push({ status: 200, govde: GIRIS });
    await api.girisYap('a@b.c', 'sifre');
    expect(Object.keys(oturum.veri)).toEqual(['vekil-oturum']);
    expect(Object.keys(yerel.veri)).toEqual([]);
    expect((await api.oturumOku())?.access_token).toBe('erisim-1');
    // Şifre hiçbir depoya girmez.
    expect(JSON.stringify([oturum.veri, yerel.veri])).not.toContain('sifre');
  });

  it('yanlış şifrede hata fırlar ve jeton yazılmaz', async () => {
    cevaplar.push({ status: 400, govde: { error_description: 'Invalid login credentials' } });
    await expect(api.girisYap('a@b.c', 'yanlis')).rejects.toMatchObject({ durum: 400 });
    expect(await api.oturumOku()).toBeNull();
  });

  it('401 gelince yenileme jetonuyla yeniler, yeni jeton yine belleğe yazılır', async () => {
    oturum.veri['vekil-oturum'] = GIRIS;
    cevaplar.push({ status: 401, govde: {} });
    cevaplar.push({ status: 200, govde: { access_token: 'erisim-2', refresh_token: 'yenile-2' } });
    cevaplar.push({ status: 201, govde: [{ id: 'd1' }] });
    const d = await api.davaOlustur({ title: 'x' });
    expect(d.id).toBe('d1');
    expect((oturum.veri['vekil-oturum'] as { access_token: string }).access_token).toBe('erisim-2');
    expect(Object.keys(yerel.veri)).toEqual([]);
  });

  it('çıkış hem belleği hem eski sürümlerden kalmış kalıcı kaydı siler', async () => {
    oturum.veri['vekil-oturum'] = GIRIS;
    yerel.veri['vekil-oturum'] = GIRIS;
    await api.cikisYap();
    expect(oturum.veri).toEqual({});
    expect(yerel.veri).toEqual({});
  });
});

describe('eklenti paneli — kaynak koruması', () => {
  const oku = (y: string) => readFileSync(new URL(`../extension/${y}`, import.meta.url), 'utf8');

  it('panel girişi gerçekten çağırıyor (girisYap ölü kod değil)', () => {
    expect(oku('panel.js')).toMatch(/girisYap\(/);
    expect(oku('panel.html')).toContain('id="giris"');
  });

  it('api.js\'in dışa aktardığı her işlev panelde kullanılıyor (ölü kod yok)', () => {
    const panel = oku('panel.js');
    const adlar = [...oku('lib/api.js').matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
    expect(adlar.length).toBeGreaterThan(0);
    for (const a of adlar) expect(panel, a).toContain(a);
  });

  it('başka origin\'deki çerçeveyi location.reload() ile yenilemez (SecurityError)', () => {
    expect(oku('panel.js')).not.toMatch(/contentWindow[^\n]*location\.reload/);
  });

  it('çerçeve mikrofon ve pano yetkisini devralır (web sürümü sesle yazma + kopyalama kullanıyor)', () => {
    const m = /<iframe[^>]*id="uygulama"[^>]*>/.exec(oku('panel.html'))?.[0] ?? '';
    expect(m).toMatch(/allow="[^"]*microphone/);
    expect(m).toMatch(/allow="[^"]*clipboard-write/);
  });

  it('manifest en düşük Chrome sürümünü bildirir (sidePanel API: 114)', () => {
    const man = JSON.parse(oku('manifest.json'));
    expect(Number(man.minimum_chrome_version)).toBeGreaterThanOrEqual(114);
  });

  it('manifest izinleri gereğinden geniş değil: host izni yok, yalnız dört izin', () => {
    const man = JSON.parse(oku('manifest.json'));
    expect(man.host_permissions).toBeUndefined();
    expect([...man.permissions].sort()).toEqual(['activeTab', 'scripting', 'sidePanel', 'storage']);
  });
});
