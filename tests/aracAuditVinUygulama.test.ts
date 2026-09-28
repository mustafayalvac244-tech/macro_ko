import { describe, expect, it } from 'vitest';

import { vinDogrula } from '../arac-audit-app/src/cekirdek/vin';

// Uygulamanın vin.ts'i (aracAuditVin.test.ts eski web sürümünün js/vin.js'ini
// sınıyor). 28.09.2026: kontrol hanesi uyarısı yalnız zorunlu olduğu
// bölgelerde; Türkiye/Avrupa şasisinde her araçta çıkan uyarı kalktı.

describe('uygulama — şasi doğrulama', () => {
  it('Türkiye üretimi (N…) şaside kontrol hanesi uyarısı çıkmaz', () => {
    const r = vinDogrula('NLHB51ABPDH1234S6');
    expect(r.gecerli).toBe(true);
    expect(r.uyarilar.join(' ')).not.toContain('Kontrol hanesi');
  });

  it('Kuzey Amerika şasisinde (1–5) uyuşmazlık uyarılır ama kayıt engellenmez', () => {
    const dogru = '1M8GDM9AXKP042788';
    expect(vinDogrula(dogru).uyarilar.join(' ')).not.toContain('Kontrol hanesi');
    const bozuk = `${dogru.slice(0, 12)}3${dogru.slice(13)}`;
    const r = vinDogrula(bozuk);
    expect(r.gecerli).toBe(true);
    expect(r.uyarilar.join(' ')).toContain('Kontrol hanesi');
  });

  it('eksik şasi geçersizdir', () => {
    expect(vinDogrula('NLHB51ABPDH12').gecerli).toBe(false);
  });
});
