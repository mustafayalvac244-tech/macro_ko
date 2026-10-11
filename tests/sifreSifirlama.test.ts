import { describe, expect, it } from 'vitest';
import { yeniSifreyiKaydet, type SifirlamaIstemcisi } from '../src/lib/sifreSifirlama';

/**
 * ŞİFRE SIFIRLAMA — "kod kullanıldı" kilidi (09.10.2026 denetimi).
 *
 * Kod verifyOtp ile bir kez harcanır ve karşılığında bir KURTARMA OTURUMU
 * açılır. Ardından şifre kaydı düşerse (ör. "yeni şifre eskisiyle aynı",
 * ağ hatası) oturum hâlâ açıktır: şifreyi düzeltip yeniden kaydetmek için
 * YENİ KOD GEREKMEZ. Ekran ise ikinci denemeyi "Bu kod kullanıldı; yeni bir
 * kod isteyin" diyerek kesiyordu — kullanıcı geri sayımı bekleyip yeni posta
 * almak zorunda kalıyordu.
 */
function sahteIstemci(o: { verifyHata?: string; updateHatalari?: Array<string | null>; oturum?: boolean }) {
  const cagri = { verify: 0, update: 0 };
  const hatalar = [...(o.updateHatalari ?? [null])];
  const istemci: SifirlamaIstemcisi = {
    async verifyOtp() {
      cagri.verify++;
      return { error: o.verifyHata ? { message: o.verifyHata } : null };
    },
    async updateUser() {
      cagri.update++;
      const h = hatalar.length ? hatalar.shift()! : null;
      return { error: h ? { message: h } : null };
    },
    async getSession() {
      return { data: { session: o.oturum === false ? null : { user: { id: 'u' } } } };
    },
  };
  return { istemci, cagri };
}

const girdi = { email: 'avukat@ornek.com', kod: '123456', sifre: 'YeniSifre9', kodDogrulandi: false };

describe('yeniSifreyiKaydet', () => {
  it('kod doğrulandı, şifre kaydı düştü: ikinci deneme YENİ KOD İSTEMEDEN şifreyi kaydeder', async () => {
    const { istemci, cagri } = sahteIstemci({
      updateHatalari: ['New password should be different from the old password.', null],
    });

    const ilk = await yeniSifreyiKaydet(istemci, girdi);
    expect(ilk.tur).toBe('hata');
    expect(ilk.kodDogrulandi).toBe(true);
    // Kullanıcıya "yeni kod iste" denmez; şifreyi düzeltip tekrar deneyebilir.
    if (ilk.tur === 'hata') expect(ilk.ek).not.toBe('forgot.codeUsed');

    const ikinci = await yeniSifreyiKaydet(istemci, { ...girdi, sifre: 'BaskaSifre7', kodDogrulandi: ilk.kodDogrulandi });
    expect(ikinci.tur).toBe('bitti');
    expect(cagri.verify).toBe(1); // harcanmış kod bir daha gönderilmez
    expect(cagri.update).toBe(2);
  });

  it('kod doğrulandıktan sonra kod kutusu boş olsa da şifre kaydedilir', async () => {
    const { istemci } = sahteIstemci({});
    const s = await yeniSifreyiKaydet(istemci, { ...girdi, kod: '', kodDogrulandi: true });
    expect(s.tur).toBe('bitti');
  });

  it('kurtarma oturumu düşmüşse yeni kod istenir', async () => {
    const { istemci, cagri } = sahteIstemci({ oturum: false });
    const s = await yeniSifreyiKaydet(istemci, { ...girdi, kodDogrulandi: true });
    expect(s).toMatchObject({ tur: 'hata', alan: 'code', anahtar: 'forgot.codeUsed' });
    expect(cagri.update).toBe(0);
  });

  it('kod boşsa (henüz doğrulanmadı) kod istenir', async () => {
    const { istemci, cagri } = sahteIstemci({});
    const s = await yeniSifreyiKaydet(istemci, { ...girdi, kod: '  ' });
    expect(s).toMatchObject({ tur: 'hata', alan: 'code', anahtar: 'forgot.needCode' });
    expect(cagri.verify).toBe(0);
  });

  it('kısa şifre sunucuya gitmeden reddedilir', async () => {
    const { istemci, cagri } = sahteIstemci({});
    const s = await yeniSifreyiKaydet(istemci, { ...girdi, sifre: 'kisa' });
    expect(s).toMatchObject({ tur: 'hata', alan: 'password', anahtar: 'auth.passwordTooShort' });
    expect(cagri.verify + cagri.update).toBe(0);
  });

  it('yanlış kod: kod harcanmaz, sunucu mesajı kod kutusuna', async () => {
    const { istemci, cagri } = sahteIstemci({ verifyHata: 'Token has expired or is invalid' });
    const s = await yeniSifreyiKaydet(istemci, girdi);
    expect(s).toMatchObject({ tur: 'hata', alan: 'code', kodDogrulandi: false, sunucu: 'Token has expired or is invalid' });
    expect(cagri.update).toBe(0);
  });

  it('ilk denemede başarı', async () => {
    const { istemci } = sahteIstemci({});
    expect(await yeniSifreyiKaydet(istemci, girdi)).toEqual({ tur: 'bitti', kodDogrulandi: true });
  });
});
