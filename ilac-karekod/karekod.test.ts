/**
 * Çalıştır: node --experimental-strip-types --test ilac-karekod/karekod.test.ts
 *
 * Vitest'e taşımak için tek değişiklik: üstteki iki import satırı yerine
 *   import { describe, it, expect } from 'vitest';
 * ve assert çağrılarını expect'e çevirmek.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GS,
  karekoduAyristir,
  kontrolHanesiDogruMu,
  sktCevir,
  kalanGun,
  type KarekodBasarili,
} from './karekod.ts';

/** Kontrol hanesi hesaplanmış, uydurma bir GTIN-14. Gerçek bir ürün değil. */
const GTIN = '08680000000013';
const TAM = `01${GTIN}212H4K9QW7X1${GS}17271200${GS}10L27B14`;

function basarili(ham: string): KarekodBasarili {
  const s = karekoduAyristir(ham);
  assert.equal(s.gecerli, true, `beklenmedik hata: ${JSON.stringify(s)}`);
  return s as KarekodBasarili;
}

describe('kontrol hanesi', () => {
  it('bilinen bir EAN-13 doğrulanır', () => {
    assert.equal(kontrolHanesiDogruMu('4006381333931'), true);
  });

  it('uydurma GTIN-14 kendi kontrol hanesiyle tutarlı', () => {
    assert.equal(kontrolHanesiDogruMu(GTIN), true);
  });

  it('baştaki sıfır kontrol hanesini değiştirmez', () => {
    assert.equal(kontrolHanesiDogruMu('8680000000013'), true);
    assert.equal(kontrolHanesiDogruMu('08680000000013'), true);
  });

  it('tek hane değişirse yakalanır', () => {
    assert.equal(kontrolHanesiDogruMu('08680000000017'), false);
  });
});

describe('son kullanma tarihi', () => {
  it('gün 00 ise ayın son günü', () => {
    assert.equal(sktCevir('271200')?.toISOString(), '2027-12-31T00:00:00.000Z');
    assert.equal(sktCevir('270200')?.toISOString(), '2027-02-28T00:00:00.000Z');
  });

  it('artık yılda şubat sonu 29 olur', () => {
    assert.equal(sktCevir('280200')?.toISOString(), '2028-02-29T00:00:00.000Z');
    assert.equal(sktCevir('280229')?.toISOString(), '2028-02-29T00:00:00.000Z');
  });

  it('normal gün doğru çözülür', () => {
    assert.equal(sktCevir('260715')?.toISOString(), '2026-07-15T00:00:00.000Z');
  });

  it('olmayan tarih sessizce kaymaz, null döner', () => {
    assert.equal(sktCevir('270230'), null); // 30 Şubat
    assert.equal(sktCevir('271301'), null); // 13. ay
    assert.equal(sktCevir('27123'), null);  // eksik hane
    assert.equal(sktCevir(null), null);
  });
});

describe('karekod ayrıştırma', () => {
  it('tam karekodun dört alanı da doğru okunur', () => {
    const s = basarili(TAM);
    assert.equal(s.gtin, GTIN);
    assert.equal(s.seri, '2H4K9QW7X1');
    assert.equal(s.parti, 'L27B14');
    assert.equal(s.sktHam, '271200');
    assert.equal(s.skt?.toISOString(), '2027-12-31T00:00:00.000Z');
    assert.deepEqual(s.eksik, []);
    assert.equal(s.kalan, '');
  });

  it('GS ayıracı seri numarasını partiden ayırır', () => {
    // Bu testin tek işi şu: ayıraç işlenmezse seri "2H4K9QW7X117271200..."
    // olurdu ve kimse fark etmezdi.
    const s = basarili(TAM);
    assert.equal(s.seri, '2H4K9QW7X1');
    assert.ok(!s.seri!.includes('17271200'), 'seriye SKT yapışmış');
    assert.ok(!s.seri!.includes('L27B14'), 'seriye parti yapışmış');
  });

  it(']d2 sembol ön eki atılır', () => {
    assert.deepEqual(basarili(`]d2${TAM}`).gtin, GTIN);
  });

  it('el terminalinin yazdığı <GS> metni de ayıraç sayılır', () => {
    const metin = `01${GTIN}212H4K9QW7X1<GS>17271200<GS>10L27B14`;
    assert.equal(basarili(metin).seri, '2H4K9QW7X1');
  });

  it('alan sırası değişse de doğru okunur', () => {
    const s = basarili(`01${GTIN}1727120010L27B14${GS}212H4K9QW7X1`);
    assert.equal(s.seri, '2H4K9QW7X1');
    assert.equal(s.parti, 'L27B14');
    assert.equal(s.sktHam, '271200');
  });

  it('sabit alandan sonra gelen fazladan ayıraç hoş görülür', () => {
    const s = basarili(`01${GTIN}${GS}17271200${GS}212H4K9QW7X1`);
    assert.equal(s.gtin, GTIN);
    assert.equal(s.seri, '2H4K9QW7X1');
  });

  it('kutunun çizgili barkodu (EAN-13) okunursa GTIN kabul edilir', () => {
    // AI (01) standartta zaten 14 hane sabittir; 13 haneli GTIN karekoddan
    // gelmez, kutunun üstündeki eski çizgili barkoddan gelir.
    const s = basarili('8680000000013');
    assert.equal(s.gtin, GTIN);
    assert.deepEqual(s.eksik.sort(), ['parti', 'seri', 'skt']);
  });

  it('çizgili barkod kutuyu değil yalnız ürünü tanır — seri yok', () => {
    const s = basarili('8680000000013');
    assert.equal(s.seri, null, 'EAN-13 seri numarası taşımaz; uydurulmamalı');
    assert.equal(s.skt, null, 'EAN-13 son kullanma tarihi taşımaz');
  });

  it('kontrol hanesi tutmayan rakam dizisi barkod sayılmaz', () => {
    const s = karekoduAyristir('8680000000019');
    assert.equal(s.gecerli, false);
  });

  it('eksik alanlar sessiz undefined yerine listelenir', () => {
    const s = basarili(`01${GTIN}17271200`);
    assert.equal(s.seri, null);
    assert.equal(s.parti, null);
    assert.deepEqual(s.eksik.sort(), ['parti', 'seri']);
  });

  it('tanınmayan AI gelirse GTIN kaybolmaz, kalan raporlanır', () => {
    const s = basarili(`01${GTIN}9912ABC`);
    assert.equal(s.gtin, GTIN);
    assert.equal(s.kalan, '9912ABC');
  });
});

describe('geçersiz girdiler sessizce geçmez', () => {
  it('boş içerik', () => {
    assert.deepEqual(karekoduAyristir(''), {
      gecerli: false, sebep: 'bos', ayrinti: 'Okunan içerik boş.',
    });
  });

  it('sıradan bir QR (web adresi) ilaç karekodu sayılmaz', () => {
    const s = karekoduAyristir('https://ornek.com/kampanya');
    assert.equal(s.gecerli, false);
    assert.equal(s.gecerli === false && s.sebep, 'gs1-degil');
  });

  it('hatalı okunan GTIN kontrol hanesinden yakalanır', () => {
    const s = karekoduAyristir(`0108680000000017212H4K9QW7X1`);
    assert.equal(s.gecerli, false);
    assert.equal(s.gecerli === false && s.sebep, 'gtin-kontrol-hanesi');
  });

  it('GTIN alanı olmayan GS1 kodu reddedilir', () => {
    const s = karekoduAyristir(`10L27B14${GS}17271200`);
    assert.equal(s.gecerli, false);
    assert.equal(s.gecerli === false && s.sebep, 'gtin-yok');
  });
});

describe('kalan gün — Miat Radarı sayacı', () => {
  const bugun = new Date('2026-09-13T10:30:00Z');

  it('gelecekteki tarih pozitif', () => {
    assert.equal(kalanGun(new Date('2026-09-20T00:00:00Z'), bugun), 7);
  });

  it('bugün son kullanma günüyse 0 — ilaç hâlâ kullanılabilir', () => {
    assert.equal(kalanGun(new Date('2026-09-13T00:00:00Z'), bugun), 0);
  });

  it('geçmiş tarih negatif', () => {
    assert.equal(kalanGun(new Date('2026-09-10T00:00:00Z'), bugun), -3);
  });

  it('günün saati sonucu kaydırmaz', () => {
    const geceYarisinaYakin = new Date('2026-09-13T23:59:00Z');
    assert.equal(kalanGun(new Date('2026-09-20T00:00:00Z'), geceYarisinaYakin), 7);
  });
});
