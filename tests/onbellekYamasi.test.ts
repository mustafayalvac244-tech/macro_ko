import { describe, expect, it } from 'vitest';
import { onbellekYamasi } from '../src/utils/onbellekYamasi';

/**
 * Bu testleri ben yazdım. Ölçtükleri şey, önbellek yamasının React Query'nin
 * tuttuğu ÜÇ ayrı şekil karşısında doğru davranması. Gerçek gecikmenin
 * kaybolduğu ancak canlı cihazda görülür — burada ölçülen o değil.
 */
/** Testlerde kullanılan satır şekli — icra dosyasının sadeleştirilmiş hâli. */
interface Satir {
  id: string;
  stage?: string;
  title?: string;
}

describe('onbellekYamasi', () => {
  const satirlar: Satir[] = [
    { id: 'a', stage: 'opened', title: 'A' },
    { id: 'b', stage: 'served', title: 'B' },
  ];

  it('dizide yalnız eşleşen satırı değiştirir, sırayı bozmaz', () => {
    const sonuc = onbellekYamasi<Satir>(satirlar, 'b', { stage: 'attachment' }) as Satir[];
    expect(sonuc.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sonuc[1].stage).toBe('attachment');
    expect(sonuc[1].title).toBe('B'); // diğer alanlar korunur
  });

  it('eşleşmeyen satırın NESNESİ aynı kalır', () => {
    const sonuc = onbellekYamasi<Satir>(satirlar, 'b', { stage: 'attachment' }) as Satir[];
    expect(sonuc[0]).toBe(satirlar[0]);
  });

  it('tek nesneyi (ayrıntı sorgusu) yamalar', () => {
    const tek: Satir = { id: 'a', stage: 'opened' };
    const sonuc = onbellekYamasi<Satir>(tek, 'a', { stage: 'final' }) as Satir;
    expect(sonuc.stage).toBe('final');
    expect(sonuc).not.toBe(tek); // yeni nesne — React Query yeniden çizsin
  });

  it('EŞLEŞME YOKSA AYNI REFERANS döner', () => {
    // Bu davranış performansın kendisi: yeni nesne dönseydi, tek bir dokunuş
    // ekrandaki ilgisiz bütün listeleri yeniden çizdirirdi.
    expect(onbellekYamasi<Satir>(satirlar, 'yok', { stage: 'x' })).toBe(satirlar);
    const tek: Satir = { id: 'a' };
    expect(onbellekYamasi<Satir>(tek, 'yok', { stage: 'x' })).toBe(tek);
  });

  it('boş ve beklenmedik şekillerde patlamaz', () => {
    expect(onbellekYamasi<Satir>(undefined, 'a', { stage: 'x' })).toBeUndefined();
    expect(onbellekYamasi<Satir>(null, 'a', { stage: 'x' })).toBeNull();
    expect(onbellekYamasi<Satir>('metin', 'a', { stage: 'x' })).toBe('metin');
    expect(onbellekYamasi<Satir>([], 'a', { stage: 'x' })).toEqual([]);
  });

  it('id taşımayan elemanları olduğu gibi bırakır', () => {
    const karisik = [{ id: 'a' }, null, 'x', { baslik: 'id yok' }];
    const sonuc = onbellekYamasi<Satir>(karisik, 'a', { stage: 'final' }) as unknown[];
    expect(sonuc[1]).toBeNull();
    expect(sonuc[2]).toBe('x');
    expect(sonuc[3]).toBe(karisik[3]);
  });

  it('kaynağı değiştirmez (mutasyon yok)', () => {
    const kopya = JSON.parse(JSON.stringify(satirlar));
    onbellekYamasi<Satir>(satirlar, 'a', { stage: 'closed' });
    expect(satirlar).toEqual(kopya);
  });
});
