import { describe, expect, it } from 'vitest';
import { yeniKunye } from '../scripts/olcum-kunyesi.mjs';

// Ölçüm betikleri saf JS (.mjs) ve tip bildirimi yok; ozet() çağıranın
// verdiği alanları da geri döndürdüğü için dönüş tipi dinamiktir.
type Ozet = {
  tarih: string;
  sureSn: number;
  modeller: { model: string; istek: number; girdiToken: number; ciktiToken: number; maliyetTL: number }[];
  karisikModel: boolean;
  [ek: string]: unknown;
};

/**
 * ÖLÇÜM KÜNYESİ.
 *
 * BULUNAN KUSUR (2026-09-11): sekiz ölçüm betiğinin hiçbiri sonucun HANGİ
 * MODELDEN geldiğini kaydetmiyordu. eval-dilekce-hatalar.json'da "kusurlu: []"
 * yazıyor ama neyin 0 kusur verdiği belli değil — bu haliyle sonuç ne
 * karşılaştırılabilir ne de tekrarlanabilir.
 *
 * EN KRİTİK DAVRANIŞ: bir koşuda birden çok model cevap verdiyse (sağlayıcı
 * yedeğe düştü, katman değişti) sonuç TEK BİR MODELE ATFEDİLEMEZ. Künye bunu
 * `karisikModel` ile açıkça işaretler; sessizce ilk modeli yazmak, ölçümü
 * olduğundan güvenilir göstermek olurdu.
 */
describe('yeniKunye', () => {
  it('hiç kullanım gelmezse modeller boş ve uyarı verir', () => {
    const k = yeniKunye();
    const o = k.ozet();
    expect(o.modeller).toEqual([]);
    expect(o.karisikModel).toBe(false);
    expect(k.satir()).toMatch(/gelmedi/);
  });

  it('tek modeli toplar: istek, token ve maliyet', () => {
    const k = yeniKunye();
    k.gor({ model: 'claude-opus-5', girdiToken: 1000, ciktiToken: 500, maliyetTL: 1.25 });
    k.gor({ model: 'claude-opus-5', girdiToken: 2000, ciktiToken: 800, maliyetTL: 2.5 });

    const o = k.ozet();
    expect(o.modeller).toHaveLength(1);
    expect(o.modeller[0]).toMatchObject({
      model: 'claude-opus-5',
      istek: 2,
      girdiToken: 3000,
      ciktiToken: 1300,
      maliyetTL: 3.75,
    });
    expect(o.karisikModel).toBe(false);
  });

  it('BİRDEN ÇOK MODEL varsa karisikModel işaretlenir — sonuç atfedilemez', () => {
    const k = yeniKunye();
    k.gor({ model: 'claude-opus-5', girdiToken: 10, ciktiToken: 10, maliyetTL: 1 });
    k.gor({ model: 'gemini-2.0-flash', girdiToken: 10, ciktiToken: 10, maliyetTL: 0 });

    const o = k.ozet();
    expect(o.karisikModel).toBe(true);
    expect(o.modeller).toHaveLength(2);
    expect(k.satir()).toMatch(/KARIŞIK MODEL/);
  });

  it('model adı gelmezse "(bilinmiyor)" olarak kaydeder — sessizce atmaz', () => {
    const k = yeniKunye();
    k.gor({ girdiToken: 5, ciktiToken: 5, maliyetTL: 0 });
    expect(k.ozet().modeller[0].model).toBe('(bilinmiyor)');
  });

  it('bozuk/eksik kullanım nesnesi ölçümü çökertmez', () => {
    const k = yeniKunye();
    k.gor(null);
    k.gor(undefined);
    k.gor('metin');
    k.gor({ model: 'x' }); // token alanları yok
    const o = k.ozet();
    expect(o.modeller).toHaveLength(1);
    expect(o.modeller[0]).toMatchObject({ model: 'x', istek: 1, girdiToken: 0, ciktiToken: 0 });
  });

  it('özet, verilen ek alanları korur (kusurlu listesi vb.)', () => {
    const k = yeniKunye();
    k.gor({ model: 'claude-opus-5', girdiToken: 1, ciktiToken: 1, maliyetTL: 0.01 });
    const o = k.ozet({ kusurlu: [{ id: 'a' }], olculenSenaryolar: ['a', 'b'] }) as Ozet;
    expect(o.kusurlu).toEqual([{ id: 'a' }]);
    expect(o.olculenSenaryolar).toEqual(['a', 'b']);
    expect(typeof o.tarih).toBe('string');
    expect(typeof o.sureSn).toBe('number');
  });
});
