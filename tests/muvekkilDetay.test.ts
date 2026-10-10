import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MÜVEKKİL DETAYI — VAR OLMAYAN KİMLİKTE BOŞ EKRAN (10.10.2026).
 *
 * useClient `.single()` kullanıyordu: 0 satırda PGRST116 hatası, sorgu üç kez
 * deneniyor ve ekran (`isLoading || !client`) yalnız başlık çizerek sonsuza dek
 * boş kalıyordu. Silinmiş müvekkilin bağlantısı (web yer imi, başka cihazda
 * silinen kayıt, eski arama sonucu) açıklamasız boş sayfaydı. Dava detayında
 * aynı kusur 09.10'da maybeSingle + ekran durumu ile giderildi (hooks/useCases,
 * utils/davaEkrani); müvekkil buna uyarlanıyor.
 */

const sonuc = { data: null as unknown, error: null as unknown };
const cagrilar: string[] = [];

vi.mock('@/lib/supabase', () => {
  const zincir: Record<string, unknown> = {};
  zincir.select = () => zincir;
  zincir.eq = () => zincir;
  zincir.order = () => zincir;
  zincir.ilike = () => zincir;
  // Yalnız maybeSingle tanımlı: .single() çağrılırsa test düşer.
  zincir.maybeSingle = () => {
    cagrilar.push('maybeSingle');
    return Promise.resolve(sonuc);
  };
  return { supabase: { from: () => zincir } };
});
vi.mock('@/lib/saveError', () => ({ notifySaveError: () => {} }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => undefined }));

const { muvekkiliGetir, muvekkilYenidenDene } = await import('@/hooks/useClients');

beforeEach(() => {
  sonuc.data = null;
  sonuc.error = null;
  cagrilar.length = 0;
});

describe('muvekkiliGetir', () => {
  it('satır yoksa (silinmiş / bu hesabın değil) HATA değil null döner', async () => {
    await expect(muvekkiliGetir('yok')).resolves.toBeNull();
    expect(cagrilar).toEqual(['maybeSingle']);
  });

  it('satır varsa onu döner', async () => {
    sonuc.data = { id: 'm1', full_name: 'Test Müvekkil' };
    await expect(muvekkiliGetir('m1')).resolves.toMatchObject({ id: 'm1' });
  });

  it('gerçek sorgu hatası fırlatılır (ekran "yüklenemedi" gösterebilsin)', async () => {
    sonuc.error = { message: 'Network request failed' };
    await expect(muvekkiliGetir('m1')).rejects.toMatchObject({ message: 'Network request failed' });
  });
});

describe('muvekkilYenidenDene', () => {
  it('bozuk kimlik (22P02) tekrar denenmez', () => {
    expect(muvekkilYenidenDene(0, { code: '22P02' })).toBe(false);
  });

  it('ağ hatası iki kez daha denenir', () => {
    const ag = { message: 'Network request failed' };
    expect(muvekkilYenidenDene(0, ag)).toBe(true);
    expect(muvekkilYenidenDene(1, ag)).toBe(true);
    expect(muvekkilYenidenDene(2, ag)).toBe(false);
  });
});
