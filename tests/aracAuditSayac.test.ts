import { describe, expect, it } from 'vitest';

import { donemBaslangiclari, sayacBaslangici, sayacHesapla, SayacGirdisi, skor, skoraGirenDenetim } from '../arac-audit-app/src/cekirdek/sayac';

// Ürün sahibi, 24.10.2026: şirketteki Excel formu araç baktıkça bugün / bu
// hafta / bu ay / bu yıl sayıyor — "o sistem güzel". 26.10.2026: Excel'in
// kendisi geldi; makrodaki tanımlar: G. Hafta dönemi, Audit Skoru =
// round(100 × Σ demerit / araç), yalnız PROBLEM SOURCE = AUDIT sayılır.
// Dönemler yerel saatle; tarihler yerel kurucuyla verildiği için test her saat
// diliminde aynı çıkar.

const yerel = (y: number, ay: number, gun: number, sa = 10, dk = 0) => new Date(y, ay - 1, gun, sa, dk);
const girdi = (aracId: string, an: Date, hataAdedi = 0, demerit = hataAdedi, kaynak = 'AUDIT'): SayacGirdisi => ({
  aracId, baslangic: an.toISOString(), hataAdedi, demerit, kaynak,
});
const SIRA = ['ioniq3', 'i20', 'bayon'];

describe('sayaç — dönem sınırları', () => {
  it('hafta pazartesi 00:00 başlar; geçen hafta bir önceki pazartesi', () => {
    // 21.10.2026 çarşamba
    expect(donemBaslangiclari(yerel(2026, 10, 21)).buHafta).toEqual(yerel(2026, 10, 19, 0));
    expect(donemBaslangiclari(yerel(2026, 10, 21)).gecenHafta).toEqual(yerel(2026, 10, 12, 0));
    // 25.10.2026 pazar: hafta hâlâ 19'unda başlamış
    expect(donemBaslangiclari(yerel(2026, 10, 25, 23, 59)).buHafta).toEqual(yerel(2026, 10, 19, 0));
    // 19.10.2026 pazartesi: kendisi
    expect(donemBaslangiclari(yerel(2026, 10, 19, 0, 5)).buHafta).toEqual(yerel(2026, 10, 19, 0));
  });

  it('ay ve yıl başı', () => {
    const b = donemBaslangiclari(yerel(2026, 10, 21));
    expect(b.buAy).toEqual(yerel(2026, 10, 1, 0));
    expect(b.buYil).toEqual(yerel(2026, 1, 1, 0));
    expect(b.bugun).toEqual(yerel(2026, 10, 21, 0));
  });

  it('Ocak başında okuma geçen yıla taşar: geçen hafta eksik sayılmasın', () => {
    // 6.1.2027 çarşamba: bu hafta 4.1, geçen hafta 28.12.2026
    expect(sayacBaslangici(yerel(2027, 1, 6))).toEqual(yerel(2026, 12, 28, 0));
    expect(sayacBaslangici(yerel(2026, 10, 21))).toEqual(yerel(2026, 1, 1, 0));
  });
});

describe('sayaç — sayım', () => {
  const simdi = yerel(2026, 10, 21, 15); // çarşamba

  it('her denetim girdiği bütün dönemlere sayılır; geçen hafta bu haftayı içermez', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2026, 10, 21, 9), 3, 2), // bugün
      girdi('i20', yerel(2026, 10, 19, 0, 30), 0), // pazartesi: bu hafta, hatasız
      girdi('i20', yerel(2026, 10, 18, 23), 2, 1), // pazar: geçen hafta, bu ay
      girdi('i20', yerel(2026, 10, 12, 0, 0), 1, 3), // geçen haftanın ilk anı
      girdi('i20', yerel(2026, 10, 11, 23, 59), 1, 1), // geçen haftadan önce, bu ay
      girdi('i20', yerel(2026, 3, 5), 1, 0), // bu yıl
    ], simdi, SIRA);
    expect(s.araclar).toHaveLength(1);
    expect(s.araclar[0]!.sayilar).toEqual({
      bugun: { arac: 1, hata: 3, demerit: 2 },
      buHafta: { arac: 2, hata: 3, demerit: 2 },
      gecenHafta: { arac: 2, hata: 3, demerit: 4 },
      buAy: { arac: 5, hata: 7, demerit: 7 },
      buYil: { arac: 6, hata: 8, demerit: 7 },
    });
  });

  it('geçen yıl, ileri tarih ve bozuk tarih sayılmaz', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2025, 12, 31, 23, 59), 4),
      girdi('i20', yerel(2026, 10, 22), 4), // cihaz saati geri alınmış
      { aracId: 'i20', baslangic: 'bozuk', hataAdedi: 4, demerit: 4 },
    ], simdi, SIRA);
    expect(s.araclar).toEqual([]);
    expect(s.toplam.buYil).toEqual({ arac: 0, hata: 0, demerit: 0 });
  });

  it('araçlar verilen sırada; bilinmeyen araç sona eklenir, düşmez; toplam hepsini kapsar', () => {
    const s = sayacHesapla([
      girdi('bayon', yerel(2026, 10, 21), 1),
      girdi('eski-arac', yerel(2026, 10, 21), 2),
      girdi('ioniq3', yerel(2026, 10, 20), 5),
    ], simdi, SIRA);
    expect(s.araclar.map((a) => a.aracId)).toEqual(['ioniq3', 'bayon', 'eski-arac']);
    expect(s.toplam.bugun).toEqual({ arac: 2, hata: 3, demerit: 3 });
    expect(s.toplam.buHafta).toEqual({ arac: 3, hata: 8, demerit: 8 });
  });

  it('yalnız AUDIT kaynağı sayılır; eski "HMC Audit" ve boş kaynak AUDIT sayılır', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2026, 10, 21, 9), 1, 1, 'AUDIT'),
      girdi('i20', yerel(2026, 10, 21, 10), 1, 1, 'HMC Audit'),
      girdi('i20', yerel(2026, 10, 21, 11), 1, 1, ''),
      girdi('i20', yerel(2026, 10, 21, 12), 5, 9, 'DURABILITY'),
      girdi('i20', yerel(2026, 10, 21, 13), 5, 9, 'Durability'),
      girdi('i20', yerel(2026, 10, 21, 14), 5, 9, '3M - DEALER CLAIM'),
    ], simdi, SIRA);
    expect(s.toplam.bugun).toEqual({ arac: 3, hata: 3, demerit: 3 });
  });

  // 26.10.2026 — dış değerlendirme: yeni açılmış, hatasız, bitmemiş denetim skoru düşürüyordu.
  it('devam eden denetim sayılmaz; tamamlanan ve durumu yazılmamış (eski) sayılır', () => {
    const s = sayacHesapla([
      { ...girdi('i20', yerel(2026, 10, 21, 9), 2, 4, 'AUDIT'), durum: 'tamam' },
      { ...girdi('i20', yerel(2026, 10, 21, 10), 0, 0, 'AUDIT'), durum: 'devam' },
      girdi('i20', yerel(2026, 10, 21, 11), 1, 2, 'AUDIT'),
    ], simdi, SIRA);
    expect(s.toplam.bugun).toEqual({ arac: 2, hata: 3, demerit: 6 });
  });
});

// Excel makrosu: Audit Skoru = round(100 × Σ DEMERIT / denetlenen araç).
describe('sayaç — Audit Skoru', () => {
  it('100 × demerit / araç, tam sayıya yuvarlanır', () => {
    expect(skor({ arac: 3, hata: 4, demerit: 2 })).toBe(67);
    expect(skor({ arac: 5, hata: 7, demerit: 0 })).toBe(0);
  });

  it('tam yarıda VBA gibi çifte yuvarlar (Excel ile aynı sayı)', () => {
    expect(skor({ arac: 8, hata: 0, demerit: 1 })).toBe(12); // 12,5 → 12
    expect(skor({ arac: 8, hata: 0, demerit: 3 })).toBe(38); // 37,5 → 38
    expect(skor({ arac: 40, hata: 0, demerit: 1 })).toBe(2); // 2,5 → 2
  });

  it('araç yoksa skor yok (0 değil)', () => {
    expect(skor({ arac: 0, hata: 0, demerit: 0 })).toBeNull();
  });
});

// 26.10.2026 — ikinci dış değerlendirme: ana sayfa 500, Analiz 475 (Analiz devam edeni sayıyordu).
describe('skora giren denetim: ana sayfa ve Analiz aynı kural', () => {
  it('yalnız AUDIT kaynaklı ve bitmiş', () => {
    expect(skoraGirenDenetim({ kaynak: 'HMC Audit', durum: 'tamam' })).toBe(true);
    expect(skoraGirenDenetim({ kaynak: 'HMC Audit', durum: 'devam' })).toBe(false);
    expect(skoraGirenDenetim({ kaynak: 'DURABILITY', durum: 'tamam' })).toBe(false);
  });

  it('Analiz\'in süzdüğü kümeden hesaplanan skor sayacın toplamıyla aynı', () => {
    const simdi = new Date(2026, 9, 26, 15, 0);
    const g = (o: Partial<SayacGirdisi>): SayacGirdisi => ({
      aracId: 'ioniq3', baslangic: new Date(2026, 9, 26, 9, 0).toISOString(), kaynak: 'HMC Audit', durum: 'tamam', hataAdedi: 1, demerit: 0, ...o,
    });
    const girdiler = [
      g({ demerit: 8 }), g({ demerit: 7 }), g({ demerit: 0 }),
      g({ demerit: 4, durum: 'devam' }), // açık kalmış: ikisi de saymamalı
      g({ demerit: 9, kaynak: 'DURABILITY' }),
    ];
    const sayac = sayacHesapla(girdiler, simdi, ['ioniq3']);
    const analiz = girdiler.filter(skoraGirenDenetim);
    const demerit = analiz.reduce((t, x) => t + x.demerit, 0);
    expect(analiz).toHaveLength(sayac.toplam.buAy.arac);
    expect(demerit).toBe(sayac.toplam.buAy.demerit);
    expect(Math.round((100 * demerit) / analiz.length)).toBe(500);
  });
});
