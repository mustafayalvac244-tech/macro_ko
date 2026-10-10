import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DIŞA AKTARMA AKIŞI — 09.10.2026 denetimi, ajan 20.
 *
 * Bulgular (hepsi kodda doğrulandı):
 *  • Android'de `Share.share({ url })` URL'yi YOK SAYAR (node_modules/react-native/
 *    Libraries/Share/Share.js: Android'de yalnız title + message alınır). UDF
 *    düğmesi Android'de boş bir paylaşım açıyor ve "paylaşıldı" sayıyordu.
 *  • Paylaşım sayfası kapatılınca (iOS: dismissedAction) "paylaşıldı" deniyordu.
 *  • Başarısız dışa aktarma da "avukat düzeltmeyi bitirdi" ölçümünü tetikliyordu.
 */

const durum = vi.hoisted(() => ({ os: 'android' as string }));
const rn = vi.hoisted(() => ({ paylas: vi.fn() }));
const dosya = vi.hoisted(() => ({
  sec: vi.fn(),
  olustur: vi.fn(),
  yaz: vi.fn(),
  onbellekYaz: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return durum.os;
    },
  },
  Share: { share: rn.paylas, dismissedAction: 'dismissedAction', sharedAction: 'sharedAction' },
}));

vi.mock('expo-file-system', () => {
  class File {
    uri = 'file:///onbellek/dilekce.udf';
    constructor(..._a: unknown[]) {}
    create() {}
    write(b: unknown) {
      dosya.onbellekYaz(b);
    }
  }
  return {
    File,
    Paths: { cache: 'onbellek' },
    Directory: { pickDirectoryAsync: (...a: unknown[]) => dosya.sec(...a) },
  };
});

const { metniPaylas } = await import('@/lib/cikti');
const { udfDisaAktar } = await import('@/lib/udfCikti');
const { ciktiBasarili, ciktiMesajAnahtari } = await import('@/lib/ciktiMesaji');

beforeEach(() => {
  durum.os = 'android';
  rn.paylas.mockReset();
  dosya.sec.mockReset();
  dosya.olustur.mockReset();
  dosya.yaz.mockReset();
  dosya.onbellekYaz.mockReset();
});

describe('UDF — Android', () => {
  it('Share.share(url) KULLANILMAZ (Android url\'yi yok sayar); klasör seçtirip dosyayı yazar', async () => {
    dosya.olustur.mockReturnValue({ write: dosya.yaz });
    dosya.sec.mockResolvedValue({ createFile: dosya.olustur });

    const sonuc = await udfDisaAktar('Sayın Mahkemeye\n\nTalep olunur.', 'Dava Dilekçesi');

    expect(sonuc).toBe('indirildi');
    expect(rn.paylas).not.toHaveBeenCalled();
    expect(dosya.sec).toHaveBeenCalledTimes(1);
    const [ad, mime] = dosya.olustur.mock.calls[0];
    expect(ad).toMatch(/\.udf$/);
    expect(mime).toBe('application/octet-stream');
    // UDF bir ZIP: "PK" ile başlamalı.
    const bayt = dosya.yaz.mock.calls[0][0] as Uint8Array;
    expect(bayt[0]).toBe(0x50);
    expect(bayt[1]).toBe(0x4b);
  });

  it('klasör seçimi iptal edilirse "iptal" döner — hata ya da başarı değil', async () => {
    dosya.sec.mockRejectedValue(Object.assign(new Error('The file picker was cancelled by the user'), { code: 'ERR_PICKER_CANCELLED' }));
    expect(await udfDisaAktar('metin', 'Dilekçe')).toBe('iptal');
  });

  it('başka bir yazma hatası "hata" döner', async () => {
    dosya.sec.mockRejectedValue(new Error('disk dolu'));
    expect(await udfDisaAktar('metin', 'Dilekçe')).toBe('hata');
  });
});

describe('UDF — iOS', () => {
  it('dosyayı önbelleğe yazıp paylaşım sayfasını açar', async () => {
    durum.os = 'ios';
    rn.paylas.mockResolvedValue({ action: 'sharedAction' });
    expect(await udfDisaAktar('metin', 'Dilekçe')).toBe('paylasildi');
    expect(rn.paylas).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///onbellek/dilekce.udf' }));
  });

  it('paylaşım sayfası kapatılırsa "iptal" (eskiden "paylaşıldı" sayılıyordu)', async () => {
    durum.os = 'ios';
    rn.paylas.mockResolvedValue({ action: 'dismissedAction' });
    expect(await udfDisaAktar('metin', 'Dilekçe')).toBe('iptal');
  });
});

describe('metniPaylas — natif', () => {
  it('sayfa kapatılırsa iptal', async () => {
    rn.paylas.mockResolvedValue({ action: 'dismissedAction' });
    expect(await metniPaylas('metin', 'Başlık')).toBe('iptal');
  });

  it('paylaşılırsa paylasildi, reddedilirse hata', async () => {
    rn.paylas.mockResolvedValueOnce({ action: 'sharedAction' });
    expect(await metniPaylas('metin')).toBe('paylasildi');
    rn.paylas.mockRejectedValueOnce(new Error('x'));
    expect(await metniPaylas('metin')).toBe('hata');
  });
});

describe('sonuç yorumu', () => {
  it('yalnız gerçekten dışarı çıkan sonuçlar BAŞARILI sayılır', () => {
    expect(ciktiBasarili('kopyalandi')).toBe(true);
    expect(ciktiBasarili('indirildi')).toBe(true);
    expect(ciktiBasarili('paylasildi')).toBe(true);
    expect(ciktiBasarili('hata')).toBe(false);
    expect(ciktiBasarili('desteklenmiyor')).toBe(false);
    expect(ciktiBasarili('iptal')).toBe(false);
  });

  it('her sonuç için kullanıcıya gösterilecek anahtar; yalnız paylaşıldı/iptal sessiz', () => {
    expect(ciktiMesajAnahtari('kopyalandi')).toBe('cikti.copied');
    expect(ciktiMesajAnahtari('indirildi')).toBe('cikti.downloaded');
    expect(ciktiMesajAnahtari('desteklenmiyor')).toBe('cikti.unsupported');
    expect(ciktiMesajAnahtari('hata')).toBe('cikti.failed');
    expect(ciktiMesajAnahtari('paylasildi')).toBeNull();
    expect(ciktiMesajAnahtari('iptal')).toBeNull();
  });
});
