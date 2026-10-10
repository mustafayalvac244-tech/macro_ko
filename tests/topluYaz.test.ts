import { describe, expect, it } from 'vitest';
import { muvekkilleDavaYaz } from '@/utils/topluYaz';

/**
 * TOPLU AKTARIM — öksüz müvekkil (10.10.2026 denetimi, 19. alan, bulgu 11).
 *
 * Aktarım her satırda ÖNCE müvekkili, SONRA davayı yazıyor. Ücretsiz planda
 * dava sınırı (5) müvekkil sınırından (10) önce dolar: 6. davada dava reddedilir
 * ama o satır için az önce açılan müvekkil kayıtlı kalırdı. Kullanıcı Pro'ya
 * geçmeyip vazgeçerse listesinde hiç istemediği, davasız müvekkiller birikir.
 */

describe('muvekkilleDavaYaz', () => {
  it('müvekkil adı yoksa müvekkil açılmaz, dava yazılır', async () => {
    const cagri: string[] = [];
    const sonuc = await muvekkilleDavaYaz({
      varOlanKimlik: undefined,
      muvekkilVar: false,
      muvekkilOlustur: async () => {
        cagri.push('muvekkil');
        return { id: 'c1' };
      },
      davaOlustur: async (id) => {
        cagri.push(`dava:${id}`);
      },
      muvekkilSil: async () => {
        cagri.push('sil');
      },
    });
    expect(cagri).toEqual(['dava:undefined']);
    expect(sonuc).toEqual({ kimlik: undefined, yeniAcildi: false });
  });

  it('var olan müvekkil yeniden kullanılır, yenisi açılmaz', async () => {
    const cagri: string[] = [];
    const sonuc = await muvekkilleDavaYaz({
      varOlanKimlik: 'eski',
      muvekkilVar: true,
      muvekkilOlustur: async () => {
        cagri.push('muvekkil');
        return { id: 'yeni' };
      },
      davaOlustur: async (id) => {
        cagri.push(`dava:${id}`);
      },
      muvekkilSil: async () => {
        cagri.push('sil');
      },
    });
    expect(cagri).toEqual(['dava:eski']);
    expect(sonuc).toEqual({ kimlik: 'eski', yeniAcildi: false });
  });

  it('yeni müvekkil açılır ve dava başarılıysa kalır', async () => {
    const cagri: string[] = [];
    const sonuc = await muvekkilleDavaYaz({
      varOlanKimlik: undefined,
      muvekkilVar: true,
      muvekkilOlustur: async () => {
        cagri.push('muvekkil');
        return { id: 'yeni' };
      },
      davaOlustur: async (id) => {
        cagri.push(`dava:${id}`);
      },
      muvekkilSil: async () => {
        cagri.push('sil');
      },
    });
    expect(cagri).toEqual(['muvekkil', 'dava:yeni']);
    expect(sonuc).toEqual({ kimlik: 'yeni', yeniAcildi: true });
  });

  it('dava reddedilirse az önce açılan müvekkil GERİ ALINIR ve asıl hata fırlar', async () => {
    const cagri: string[] = [];
    const limit = new Error('plan_limiti:dava:5');
    await expect(
      muvekkilleDavaYaz({
        varOlanKimlik: undefined,
        muvekkilVar: true,
        muvekkilOlustur: async () => {
          cagri.push('muvekkil');
          return { id: 'yeni' };
        },
        davaOlustur: async () => {
          throw limit;
        },
        muvekkilSil: async (id) => {
          cagri.push(`sil:${id}`);
        },
      }),
    ).rejects.toBe(limit);
    expect(cagri).toEqual(['muvekkil', 'sil:yeni']);
  });

  it('var olan müvekkil asla silinmez (dava reddedilse bile)', async () => {
    const cagri: string[] = [];
    await expect(
      muvekkilleDavaYaz({
        varOlanKimlik: 'eski',
        muvekkilVar: true,
        muvekkilOlustur: async () => ({ id: 'x' }),
        davaOlustur: async () => {
          throw new Error('ag');
        },
        muvekkilSil: async (id) => {
          cagri.push(`sil:${id}`);
        },
      }),
    ).rejects.toThrow('ag');
    expect(cagri).toEqual([]);
  });

  it('geri alma da başarısız olursa asıl (dava) hatası yutulmaz', async () => {
    const asil = new Error('plan_limiti:dava:5');
    await expect(
      muvekkilleDavaYaz({
        varOlanKimlik: undefined,
        muvekkilVar: true,
        muvekkilOlustur: async () => ({ id: 'yeni' }),
        davaOlustur: async () => {
          throw asil;
        },
        muvekkilSil: async () => {
          throw new Error('silme de düştü');
        },
      }),
    ).rejects.toBe(asil);
  });
});
