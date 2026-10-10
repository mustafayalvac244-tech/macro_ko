import { describe, expect, it, vi } from 'vitest';
import {
  davaKayitHatasi,
  durumSecimi,
  formDoldurulsunMu,
  kaydedilecekDurum,
  ucretAlanlari,
  yeniDavaKaydet,
} from '../src/utils/davaFormu';
import { onbellekYamasi } from '../src/utils/onbellekYamasi';
import type { TKey } from '../src/i18n';

/**
 * DAVA FORMU (app/case-form.tsx) — 09.10.2026 denetimi. Saf mantık
 * src/utils/davaFormu.ts'e çıkarıldı; her blok bir kusuru kilitler.
 */

describe('durum: düzenleme durumu bozmaz', () => {
  it('seçiciye dokunulmadıysa bekleyen/askıdaki dava "aktif"e çevrilmez', () => {
    expect(kaydedilecekDurum('pending', durumSecimi('pending'))).toBe('pending');
    expect(kaydedilecekDurum('on_hold', durumSecimi('on_hold'))).toBe('on_hold');
  });

  it('kazanılan/kaybedilen dava "kapalı"ya çevrilmez', () => {
    expect(kaydedilecekDurum('won', durumSecimi('won'))).toBe('won');
    expect(kaydedilecekDurum('lost', durumSecimi('lost'))).toBe('lost');
  });

  it('kullanıcı açık/kapalı seçimini değiştirdiyse yeni seçim yazılır', () => {
    expect(kaydedilecekDurum('pending', 'closed')).toBe('closed');
    expect(kaydedilecekDurum('won', 'active')).toBe('active');
  });

  it('yeni davada seçim aynen yazılır', () => {
    expect(kaydedilecekDurum(null, 'active')).toBe('active');
    expect(kaydedilecekDurum(undefined, 'closed')).toBe('closed');
  });
});

describe('ücret: görünmeyen kutunun değeri kaydedilmez', () => {
  const girdi = { tutar: '50.000', oran: '15', avans: '20.000' };

  it('yüzde türünde, önceki türden kalan tutar kaydedilmez', () => {
    expect(ucretAlanlari('percentage', girdi)).toEqual({ tamam: true, fee_amount: null, fee_percent: 15, fee_advance: null });
  });

  it('sabit ücrette yalnız tutar kaydedilir', () => {
    expect(ucretAlanlari('fixed', girdi)).toEqual({ tamam: true, fee_amount: 50000, fee_percent: null, fee_advance: null });
  });

  it('peşin + yüzde türünde avans ve oran kaydedilir, tutar kaydedilmez', () => {
    expect(ucretAlanlari('advance_percentage', girdi)).toEqual({ tamam: true, fee_amount: null, fee_percent: 15, fee_advance: 20000 });
  });

  it('aylık + başarı primi türünde tutar ve oran kaydedilir', () => {
    expect(ucretAlanlari('retainer_success', girdi)).toEqual({ tamam: true, fee_amount: 50000, fee_percent: 15, fee_advance: null });
    expect(ucretAlanlari('retainer', girdi)).toEqual({ tamam: true, fee_amount: 50000, fee_percent: null, fee_advance: null });
  });

  it('görünmeyen kutudaki okunamayan değer kaydı engellemez', () => {
    expect(ucretAlanlari('percentage', { tutar: 'abc', oran: '15', avans: '' })).toEqual({
      tamam: true, fee_amount: null, fee_percent: 15, fee_advance: null,
    });
  });

  it('görünen kutudaki okunamayan değer kaydı durdurur', () => {
    expect(ucretAlanlari('fixed', { tutar: '1.25.000', oran: '', avans: '' })).toEqual({ tamam: false, okunamayan: '1.25.000' });
  });

  it('formun tanımadığı bir türde hiçbir ücret alanı silinmez', () => {
    expect(ucretAlanlari('saatlik', girdi)).toEqual({ tamam: true, fee_amount: 50000, fee_percent: 15, fee_advance: 20000 });
  });
});

describe('düzenleme formu yalnız ilk yüklemede doldurulur', () => {
  it('ilk yüklemede ve başka bir dava açıldığında doldurulur', () => {
    expect(formDoldurulsunMu(null, { id: 'd1' })).toBe(true);
    expect(formDoldurulsunMu('d1', { id: 'd2' })).toBe(true);
    expect(formDoldurulsunMu(null, undefined)).toBe(false);
  });

  it('kayıt hatasında iyimser yamanın geri alınması formu eski değerlerle ezmez', () => {
    // useUpdateCase: onMutate önbelleği yamalar, onError eski nesneyi geri koyar.
    // İkisi de ayrıntı sorgusuna AYNI kimlikli YENİ bir nesne verir; form
    // nesneye bağlıyken her seferinde yeniden dolduruluyor ve kullanıcının
    // yazdıkları kayıtlı (eski) değerlerle eziliyordu.
    const eski = { id: 'd1', title: 'Eski başlık' };
    const yamali = onbellekYamasi<typeof eski>(eski, 'd1', { title: 'Yeni başlık' }) as typeof eski;
    expect(yamali).not.toBe(eski);
    expect(formDoldurulsunMu('d1', yamali)).toBe(false);
    expect(formDoldurulsunMu('d1', eski)).toBe(false);
  });
});

describe('yeni dava: ilk duruşma yazılamazsa ikinci dava açılmaz', () => {
  type D = { id: string; title: string };

  it('duruşma hatasında oluşan dava geri verilir; ikinci denemede yalnız duruşma denenir', async () => {
    const olustur = vi.fn(async (): Promise<D> => ({ id: 'd1', title: 'Alacak' }));
    const guncelle = vi.fn(async (d: D): Promise<D> => d);
    const durusmaEkle = vi
      .fn<(d: D) => Promise<unknown>>()
      .mockRejectedValueOnce({ message: 'Network request failed' })
      .mockResolvedValueOnce({ id: 'h1' });

    const ilk = await yeniDavaKaydet<D>(null, { olustur, guncelle, durusmaEkle });
    expect(ilk.tamam).toBe(false);
    expect(ilk.dava.id).toBe('d1');

    const ikinci = await yeniDavaKaydet<D>(ilk.dava, { olustur, guncelle, durusmaEkle });
    expect(ikinci).toEqual({ tamam: true, dava: { id: 'd1', title: 'Alacak' } });
    expect(olustur).toHaveBeenCalledTimes(1);
    expect(guncelle).toHaveBeenCalledTimes(1);
    expect(durusmaEkle).toHaveBeenCalledTimes(2);
    expect(durusmaEkle).toHaveBeenLastCalledWith({ id: 'd1', title: 'Alacak' });
  });

  it('dava yazılamazsa hata çağırana gider, duruşma denenmez', async () => {
    const hata = { message: 'plan_limiti:dava:5', code: '23514' };
    const durusmaEkle = vi.fn(async () => ({}));
    await expect(
      yeniDavaKaydet(null, { olustur: async () => Promise.reject(hata), guncelle: async (d) => d, durusmaEkle }),
    ).rejects.toBe(hata);
    expect(durusmaEkle).not.toHaveBeenCalled();
  });

  it('duruşma seçilmediyse yalnız dava yazılır', async () => {
    const sonuc = await yeniDavaKaydet<D>(null, { olustur: async () => ({ id: 'd2', title: 'Tespit' }), guncelle: async (d) => d });
    expect(sonuc).toEqual({ tamam: true, dava: { id: 'd2', title: 'Tespit' } });
  });
});

describe('kayıt hatası metni', () => {
  const t = (k: TKey, v?: Record<string, string | number>) => (v ? `${k}|${JSON.stringify(v)}` : k);

  it('plan limiti (PostgREST düz nesne) "tekrar deneyin" denmez, plan cümlesi gösterilir', () => {
    expect(davaKayitHatasi({ message: 'plan_limiti:dava:5', code: '23514', details: null, hint: null }, t)).toBe(
      'plan.doldu.dava|{"n":"5"}',
    );
  });

  it('plan limiti Error olarak gelirse ham kod gösterilmez', () => {
    expect(davaKayitHatasi(new Error('plan_limiti:dava:5'), t)).toBe('plan.doldu.dava|{"n":"5"}');
    expect(davaKayitHatasi(new Error('plan_limiti:dava:0'), t)).toBe('plan.kapali.dava');
  });

  it('diğer hatalar eskisi gibi', () => {
    expect(davaKayitHatasi({ message: 'boom', code: 'XX000' }, t)).toBe('caseForm.saveFailed');
    expect(davaKayitHatasi(new Error('duplicate key value violates unique constraint'), t)).toBe('Bu kayıt zaten mevcut.');
  });
});
