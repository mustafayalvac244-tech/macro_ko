import { describe, expect, it } from 'vitest';
import {
  hesaplaSmm,
  VARSAYILAN_KDV_ORANI,
  VARSAYILAN_STOPAJ_ORANI,
} from '../src/utils/serbestMeslekMakbuzu';

describe('hesaplaSmm', () => {
  it('oran verilmezse KDV ve stopaj sıfırdır, belge toplamı matrahla eşittir', () => {
    const h = hesaplaSmm(10000);
    expect(h.kdvTutari).toBe(0);
    expect(h.stopajTutari).toBe(0);
    expect(h.belgeToplami).toBe(10000);
    expect(h.tahsilEdilecek).toBe(10000);
  });

  it('yalnız KDV uygulanırsa stopaj kesilmez, tahsil edilecek belge toplamına eşittir', () => {
    const h = hesaplaSmm(10000, VARSAYILAN_KDV_ORANI, null);
    expect(h.kdvTutari).toBe(2000);
    expect(h.stopajTutari).toBe(0);
    expect(h.belgeToplami).toBe(12000);
    expect(h.tahsilEdilecek).toBe(12000);
  });

  it('KDV + stopaj birlikte: stopaj yalnız matrahtan kesilir, KDV eksilmez', () => {
    // 10.000 TL ücret, %20 KDV = 12.000 TL makbuz toplamı; %20 stopaj yalnız
    // 10.000 üzerinden (2.000 TL) kesilir — KDV üzerinden stopaj kesilmez.
    const h = hesaplaSmm(10000, 20, 20);
    expect(h.kdvTutari).toBe(2000);
    expect(h.stopajTutari).toBe(2000);
    expect(h.belgeToplami).toBe(12000);
    expect(h.tahsilEdilecek).toBe(10000);
  });

  it('gerçek kişi müvekkilden stopajsız, KDV\'li tahsilat', () => {
    const h = hesaplaSmm(5000, VARSAYILAN_KDV_ORANI, null);
    expect(h.tahsilEdilecek).toBe(6000);
  });

  it('kuruş yuvarlaması: 3333.33 matrah üzerinden hesap iki basamağa yuvarlanır', () => {
    const h = hesaplaSmm(3333.33, 20, 20);
    expect(h.kdvTutari).toBe(666.67);
    expect(h.stopajTutari).toBe(666.67);
    expect(h.belgeToplami).toBe(4000);
    expect(h.tahsilEdilecek).toBe(3333.33);
  });

  it('geçersiz/negatif matrahı sıfır kabul eder, uydurma tutar üretmez', () => {
    expect(hesaplaSmm(-500, 20, 20).matrah).toBe(0);
    expect(hesaplaSmm(NaN, 20, 20).matrah).toBe(0);
  });

  it('sıfır oran, oran uygulanmamış (null) durumundan farklıdır — ikisi de kesinti üretmez ama alan doldurulur', () => {
    const sifirOranli = hesaplaSmm(10000, 0, 0);
    expect(sifirOranli.kdvOrani).toBe(0);
    expect(sifirOranli.kdvTutari).toBe(0);
    const uygulanmamis = hesaplaSmm(10000, null, null);
    expect(uygulanmamis.kdvOrani).toBeNull();
    expect(uygulanmamis.kdvTutari).toBe(0);
  });
});
