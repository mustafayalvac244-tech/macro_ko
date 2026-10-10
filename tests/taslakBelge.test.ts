import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/en';

/**
 * 09.10.2026 denetim bulgusu (Belge İnceleme): sonuç yalnız ekran durumundaydı;
 * ücretli ve bekletilen incelemeyi avukat geri/yenile/yan menüyle çıkınca
 * kaybediyordu. Dilekçe taslağıyla aynı kalıp: hesaba bağlı cihaz deposu,
 * çıkışta ve hesap silmede silinir.
 */
const depo = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => depo.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      depo.set(k, v);
    },
    removeItem: async (k: string) => {
      depo.delete(k);
    },
    multiRemove: async (ks: string[]) => {
      ks.forEach((k) => depo.delete(k));
    },
  },
}));

const { taslakAnahtarlari, taslakOku, taslakYaz, sohbetGecmisiniSil } = await import('../src/lib/sohbetDeposu');
const oku = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('belge incelemesi sonucu cihazda saklanır', () => {
  it('yazılan sonuç aynı hesapta geri okunur', async () => {
    await taslakYaz('u1', 'belge', { metin: 'SONUÇ', zaman: 1 });
    expect(await taslakOku<{ metin: string }>('u1', 'belge')).toEqual({ metin: 'SONUÇ', zaman: 1 });
  });

  it('başka hesabın sonucu görünmez', async () => {
    await taslakYaz('u1', 'belge', { metin: 'A hesabının müvekkil belgesi', zaman: 1 });
    expect(await taslakOku('u2', 'belge')).toBeNull();
  });

  it('belge ve dilekçe taslakları birbirine karışmaz', async () => {
    await taslakYaz('u3', 'dilekce', { metin: 'dilekçe' });
    await taslakYaz('u3', 'belge', { metin: 'inceleme' });
    expect((await taslakOku<{ metin: string }>('u3', 'dilekce'))?.metin).toBe('dilekçe');
    expect((await taslakOku<{ metin: string }>('u3', 'belge'))?.metin).toBe('inceleme');
  });

  it('çıkışta / hesap silmede belge sonucu da silinir', async () => {
    expect(taslakAnahtarlari('u4')).toHaveLength(2);
    await taslakYaz('u4', 'belge', { metin: 'gizli' });
    await taslakYaz('u4', 'dilekce', { metin: 'gizli' });
    await sohbetGecmisiniSil('u4');
    expect(await taslakOku('u4', 'belge')).toBeNull();
    expect(await taslakOku('u4', 'dilekce')).toBeNull();
  });
});

describe('belge ekranı depoyu kullanır', () => {
  const ekran = oku('app/document-review.tsx');

  it('açılışta okur, sonuç gelince ve elle düzeltilince yazar', () => {
    expect(ekran).toMatch(/taslakOku<[^>]+>\(userId, 'belge'\)/);
    expect(ekran).toMatch(/taslakYaz\(userId, 'belge'/);
    expect(ekran).toMatch(/onMetinDegisti=/);
  });

  it('sonuçla BİRLİKTE uyarıları da saklar (geri gelen sonuç temiz görünmesin)', () => {
    // Uydurma madde/tutar, ayıklanan tarih ve taranmış sayfa uyarısı olmadan
    // geri yüklenen bir inceleme, denetlenmiş gibi görünürdü.
    for (const alan of ['uydurmaMadde', 'uydurmaTutar', 'kararDenetimi', 'ayiklanan', 'ekUyari']) {
      expect(ekran, alan).toMatch(new RegExp(`Taslak = \\{[^}]*${alan}`, 's'));
    }
  });

  it('kullanıcı geri yüklenen sonucu temizleyebilir', () => {
    expect(ekran).toMatch(/taslakSil\(userId, 'belge'\)/);
    expect(tr['docrev.sonucGeriYuklendi']).toContain('{zaman}');
    expect(en['docrev.sonucGeriYuklendi']).toContain('{zaman}');
    expect(tr['docrev.sonucTemizle']).toBeTruthy();
    expect(en['docrev.sonucTemizle']).toBeTruthy();
  });
});
