import { describe, it, expect } from 'vitest';
// @ts-ignore — arac-audit saf JS modülleridir (tarayıcıda derlemesiz çalışır)
import { vinNormalize, vinDogrula, kontrolHanesi, modelYili, plakaDogrula, VIN_UZUNLUK } from '../arac-audit/js/vin.js';

describe('VIN normalize', () => {
  it('ayraçları atar ve büyütür', () => {
    expect(vinNormalize('nlh b51-abp dh123456')).toBe('NLHB51ABPDH123456');
  });

  it('VIN de bulunamayan I/O/Q karakterlerini 1/0 a çevirir', () => {
    // Bu bir tahmin değil: ISO 3779 VIN alfabesinde I, O, Q hiç yoktur,
    // bu yüzden okuyucu bunları ürettiyse kesin olarak 1/0/0 demektir.
    expect(vinNormalize('IOQ12345678901234')).toBe('10012345678901234');
  });

  it('boş girdide çökmez', () => {
    expect(vinNormalize(null)).toBe('');
    expect(vinNormalize(undefined)).toBe('');
  });
});

describe('ISO 3779 kontrol hanesi', () => {
  it('bilinen geçerli VIN i doğrular', () => {
    // Referans örnek: 9. hane X olan standart doğrulama örneği
    const vin = '1M8GDM9AXKP042788';
    expect(kontrolHanesi(vin)).toBe(vin[8]);
  });

  it('tek karakter değişince kontrol hanesi tutmaz', () => {
    const vin = '1M8GDM9AXKP042788';
    const bozuk = vin.slice(0, 12) + (vin[12] === '2' ? '3' : '2') + vin.slice(13);
    expect(kontrolHanesi(bozuk)).not.toBe(bozuk[8]);
  });
});

describe('model yılı', () => {
  it('30 yıllık döngüyü içinde bulunulan yıla göre çözer', () => {
    expect(modelYili('T', 2026)).toBe(2026);
    expect(modelYili('S', 2026)).toBe(2025);
    // Gelecek yılın kodu da kabul edilir (üretim, model yılının önünde olur)
    expect(modelYili('V', 2026)).toBe(2027);
  });

  it('geçersiz kodda null döner', () => {
    expect(modelYili('I')).toBeNull();
    expect(modelYili('0')).toBeNull();
  });
});

describe('VIN doğrulama', () => {
  it('17 haneli VIN i kabul eder ve parçalara ayırır', () => {
    const r = vinDogrula('NLHB51ABPDH123456');
    const bilgi = r.bilgi as Record<string, any>;
    expect(r.gecerli).toBe(true);
    expect(r.vin).toHaveLength(VIN_UZUNLUK);
    expect(bilgi.wmi).toBe('NLH');
    expect(bilgi.seriNo).toBe('123456');
  });

  it('kısa VIN i reddeder ve kaç hane okunduğunu söyler', () => {
    const r = vinDogrula('NLH123');
    expect(r.gecerli).toBe(false);
    expect(r.hatalar[0]).toContain('6 karakter');
  });

  it('uzun VIN i de reddeder', () => {
    expect(vinDogrula('NLHB51ABPDH1234567890').gecerli).toBe(false);
  });

  it('kontrol hanesi tutmayınca ENGELLEMEZ, uyarır', () => {
    // Avrupa üretimi araçlarda 9. hane kontrol hanesi olmayabilir; kaydı
    // durdurmak sahada denetimi bloke ederdi.
    const r = vinDogrula('NLHB51ABPDH123456');
    if (!(r.bilgi as Record<string, any>).kontrolHanesiUyuyor) {
      expect(r.gecerli).toBe(true);
      expect(r.uyarilar.join(' ')).toContain('Kontrol hanesi');
    }
  });
});

describe('plaka', () => {
  it('geçerli Türk plakalarını biçimler', () => {
    expect(plakaDogrula('41abc12').bicimli).toBe('41 ABC 12');
    expect(plakaDogrula('34 A 1234').bicimli).toBe('34 A 1234');
    expect(plakaDogrula('06 AB 123').bicimli).toBe('06 AB 123');
  });

  it('boş plaka geçerlidir (fabrikada araçların çoğunda plaka yoktur)', () => {
    const r = plakaDogrula('');
    expect(r.gecerli).toBe(true);
    expect(r.bicimli).toBe('');
  });

  it('geçersiz il kodunu uyarır ama veriyi atmaz', () => {
    const r = plakaDogrula('99 XYZ 1');
    expect(r.gecerli).toBe(false);
    expect(r.plaka).toBe('99XYZ1');
    expect(r.uyarilar).toHaveLength(1);
  });

  it('harf/rakam sayısı kuralını denetler', () => {
    // 3 harfli plakada 2 rakam olmalı
    expect(plakaDogrula('34 ABC 123').uyarilar.length).toBeGreaterThan(0);
    expect(plakaDogrula('34 ABC 12').uyarilar).toHaveLength(0);
  });
});
