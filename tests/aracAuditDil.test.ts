import { afterEach, describe, expect, it } from 'vitest';

import {
  grupAdi, hataTipiAdi, ozelHataTipleriniAyarla, parcaBolgeAdi, parcaTamAdi,
} from '../arac-audit-app/src/cekirdek/katalog';
import { DONEMLER } from '../arac-audit-app/src/cekirdek/sayac';
import { sistemAdi } from '../arac-audit-app/src/cekirdek/sistemler';
import { vinDogrula } from '../arac-audit-app/src/cekirdek/vin';

// Ürün sahibi, 26.10.2026: "İng Türkçe seçenek de olsun." Arayüz metinleri
// bileşenlerde t('tr', 'en') ile çift; bu test, ekranların kullandığı katalog
// ve doğrulama metinlerinin iki dilde de doğru seçildiğini korur.

describe('katalog adları — arayüz dilinde', () => {
  afterEach(() => ozelHataTipleriniAyarla([]));

  it('hata tipi, grup, parça, bölge, sistem', () => {
    expect(hataTipiAdi('cizik', 'tr')).toBe('Çizik');
    expect(hataTipiAdi('cizik', 'en')).toBe('Scratch');
    expect(grupAdi('montaj', 'tr')).toBe('Montaj / Uyum');
    expect(grupAdi('montaj', 'en')).toBe('Fit & Finish');
    expect(parcaTamAdi('kaput', 'en')).toBe('Hood');
    expect(parcaBolgeAdi('sase_alti', 'tr')).toBe('Dış · Alt');
    expect(parcaBolgeAdi('sase_alti', 'en')).toBe('Exterior · Underbody');
    expect(sistemAdi('motor', 'en')).toBe('Engine room');
  });

  it('İngilizcesi boş ekip tipi İngilizce arayüzde Türkçe adıyla görünür; bilinmeyen kimlik olduğu gibi', () => {
    ozelHataTipleriniAyarla([{ id: 'ht_x', grup: 'montaj', ad: 'Klips izi', en: '', derece: '0', ozel: true }]);
    expect(hataTipiAdi('ht_x', 'en')).toBe('Klips izi');
    expect(hataTipiAdi('yok-boyle', 'en')).toBe('yok-boyle');
    expect(grupAdi('yok-boyle', 'en')).toBe('yok-boyle');
    expect(parcaBolgeAdi('yok-boyle', 'en')).toBe('');
  });

  it('sayaç dönemlerinin iki dilde adı var', () => {
    for (const d of DONEMLER) {
      expect(d.ad && d.uzun && d.en && d.enUzun).toBeTruthy();
    }
    expect(DONEMLER.map((d) => d.enUzun)).toEqual(['Today', 'This week', 'Last week', 'This month', 'This year']);
  });
});

describe('VIN iletileri — dil yalnız iletiyi değiştirir', () => {
  it('Türkçe varsayılan, İngilizce istenince İngilizce; sonuç aynı', () => {
    const tr = vinDogrula('NLHB51ABPDH12');
    const en = vinDogrula('NLHB51ABPDH12', 'en');
    expect(tr.gecerli).toBe(false);
    expect(en.gecerli).toBe(false);
    expect(tr.hatalar[0]).toContain('karakter olmalı');
    expect(en.hatalar[0]).toBe('VIN must be 17 characters — 13 read.');
    expect(vinDogrula('', 'en').hatalar[0]).toBe('VIN is empty.');
    expect(vinDogrula('NLHB51ABPDH1234S6', 'en').bilgi.uretici).toBe('Hyundai Assan — Türkiye (verify)');
    expect(vinDogrula('NLHB51ABPDH1234S6').bilgi.uretici).toBe('Hyundai Assan — Türkiye (doğrulayın)');
    // I/O/Q doğrulamadan ÖNCE 1/0'a çevriliyor (vinNormalize); yasak harf
    // iletisi bu yoldan oluşmaz — sonuç iki dilde de aynı.
    expect(vinDogrula('NLHB51ABPDH1234I6', 'en').gecerli).toBe(vinDogrula('NLHB51ABPDH1234I6').gecerli);
  });
});
