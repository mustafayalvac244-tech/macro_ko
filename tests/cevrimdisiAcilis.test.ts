import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ÇEVRİMDIŞI SOĞUK AÇILIŞ (09.10.2026 denetimi).
 *
 * auth-js, açılışta erişim jetonunun süresi dolmuşsa (Supabase varsayılanı 1
 * saat; bu projenin değeri ölçülmedi) önce yenilemeyi dener. Ağ yoksa yenileme
 * düşer ve getSession / INITIAL_SESSION `session: null` döner — ama diskteki
 * oturumu SİLMEZ (yalnız oturum gerçekten ölünce siler). Mağaza bu null'ı
 * "oturum yok" sayıp giriş ekranını gösteriyordu: adliyede çekmeyen yerde
 * uygulamayı açan avukat, cihazdaki önbelleğe (davalar, duruşmalar) ulaşamıyordu.
 *
 * Bu dosya authStore.initialize'ı sahte bir supabase istemcisiyle sürer.
 */

type Olay = (event: string, session: unknown) => void;

const durum = vi.hoisted(() => ({
  getSession: (() => Promise.resolve({ data: { session: null }, error: null })) as () => Promise<unknown>,
  disk: null as unknown,
  diskBekletici: null as null | Promise<unknown>,
  olay: null as null | ((event: string, session: unknown) => void),
}));

vi.mock('@/lib/supabase', () => ({
  DOCUMENTS_BUCKET: 'case-documents',
  diskOturumu: () => (durum.diskBekletici ?? Promise.resolve(durum.disk)),
  supabase: {
    auth: {
      getSession: () => durum.getSession(),
      onAuthStateChange: (cb: Olay) => {
        durum.olay = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    rpc: () => Promise.resolve({ data: null, error: { message: 'Network request failed' } }),
  },
}));
vi.mock('@/lib/queryClient', () => ({ resetQueryCache: async () => {} }));
vi.mock('@/lib/notifications', () => ({ cancelAllReminders: async () => {}, pushAdresiniSil: async () => {} }));
vi.mock('@/lib/sohbetDeposu', () => ({ sohbetGecmisiniSil: async () => {} }));
vi.mock('@/store/sayacStore', () => ({ useSayacStore: { getState: () => ({ iptal: () => {} }) } }));
vi.mock('@/lib/girdi', () => ({ dosyaBaytlari: async () => new ArrayBuffer(0) }));
vi.mock('@/lib/kullanim', () => ({ kayitKaynagi: () => ({}) }));

const DISKTEKI = { access_token: 'eski', refresh_token: 'r1', expires_at: 1, user: { id: 'avukat-1' } };
const YENI = { access_token: 'yeni', refresh_token: 'r2', expires_at: 9999999999, user: { id: 'avukat-1' } };
const agHatasi = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };

async function magaza() {
  vi.resetModules();
  const { useAuthStore } = await import('../src/store/authStore');
  return useAuthStore;
}
const bosalt = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  durum.getSession = () => Promise.resolve({ data: { session: null }, error: null });
  durum.disk = null;
  durum.diskBekletici = null;
  durum.olay = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('authStore.initialize — çevrimdışı açılış', () => {
  it('jeton yenilenemedi (ağ yok) ama oturum diskte: uygulama diskteki oturumla açılır', async () => {
    durum.getSession = () => Promise.resolve({ data: { session: null }, error: agHatasi });
    durum.disk = DISKTEKI;
    const m = await magaza();
    m.getState().initialize();
    await bosalt();
    expect(m.getState().isInitializing).toBe(false);
    expect(m.getState().session).toEqual(DISKTEKI);
  });

  it('INITIAL_SESSION boş gelse de diskte duran oturum düşürülmez', async () => {
    durum.getSession = () => new Promise(() => {}); // auth-js hâlâ yenilemeyi deniyor
    durum.disk = DISKTEKI;
    const m = await magaza();
    m.getState().initialize();
    durum.olay!('INITIAL_SESSION', null);
    await bosalt();
    expect(m.getState().session).toEqual(DISKTEKI);
  });

  it('auth-js 2 sn içinde yanıt veremezse emniyet ağı diskteki oturumla açar', async () => {
    vi.useFakeTimers();
    durum.getSession = () => new Promise(() => {});
    durum.disk = DISKTEKI;
    const m = await magaza();
    m.getState().initialize();
    await vi.advanceTimersByTimeAsync(2000);
    expect(m.getState().isInitializing).toBe(false);
    expect(m.getState().session).toEqual(DISKTEKI);
  });

  it('geç dönen disk okuması, arada gelen yeni oturumu ezmez', async () => {
    durum.getSession = () => new Promise(() => {});
    let diskiBitir!: (v: unknown) => void;
    durum.diskBekletici = new Promise((r) => (diskiBitir = r));
    const m = await magaza();
    m.getState().initialize();
    durum.olay!('INITIAL_SESSION', null); // disk okuması başlar, bekler
    durum.olay!('TOKEN_REFRESHED', YENI); // ağ geldi, jeton yenilendi
    diskiBitir(DISKTEKI);
    await bosalt();
    expect(m.getState().session).toEqual(YENI);
  });
});

describe('authStore.initialize — oturum gerçekten yoksa davranış değişmez', () => {
  it('disk boşsa giriş ekranı (session null)', async () => {
    durum.getSession = () => Promise.resolve({ data: { session: null }, error: null });
    durum.disk = null;
    const m = await magaza();
    m.getState().initialize();
    durum.olay!('INITIAL_SESSION', null);
    await bosalt();
    expect(m.getState().isInitializing).toBe(false);
    expect(m.getState().session).toBeNull();
  });

  it('SIGNED_OUT diske bakmaz, oturumu kapatır', async () => {
    durum.getSession = () => Promise.resolve({ data: { session: YENI }, error: null });
    durum.disk = DISKTEKI; // olsa bile
    const m = await magaza();
    m.getState().initialize();
    await bosalt();
    expect(m.getState().session).toEqual(YENI);
    durum.olay!('SIGNED_OUT', null);
    await bosalt();
    expect(m.getState().session).toBeNull();
  });

  it('getSession oturum döndürürse o kullanılır (disk okunmaz)', async () => {
    durum.getSession = () => Promise.resolve({ data: { session: YENI }, error: null });
    durum.disk = DISKTEKI;
    const m = await magaza();
    m.getState().initialize();
    await bosalt();
    expect(m.getState().session).toEqual(YENI);
  });
});
