import { describe, expect, it } from 'vitest';

import { donemBaslangiclari, dpu, sayacHesapla, SayacGirdisi } from '../arac-audit-app/src/cekirdek/sayac';

// Ürün sahibi, 24.10.2026: şirketteki Excel formu araç baktıkça bugün / bu
// hafta / bu ay / bu yıl sayıyor — "o sistem güzel". Dönemler yerel saatle;
// tarihler yerel kurucuyla verildiği için test her saat diliminde aynı çıkar.

const yerel = (y: number, ay: number, gun: number, sa = 10, dk = 0) => new Date(y, ay - 1, gun, sa, dk);
const girdi = (aracId: string, an: Date, hataAdedi = 0, duzeltilecekAdedi = hataAdedi): SayacGirdisi => ({
  aracId, baslangic: an.toISOString(), hataAdedi, duzeltilecekAdedi,
});
const SIRA = ['ioniq3', 'i20', 'bayon'];

describe('sayaç — dönem sınırları', () => {
  it('hafta pazartesi 00:00 başlar', () => {
    // 21.10.2026 çarşamba
    expect(donemBaslangiclari(yerel(2026, 10, 21)).buHafta).toEqual(yerel(2026, 10, 19, 0));
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
});

describe('sayaç — sayım', () => {
  const simdi = yerel(2026, 10, 21, 15); // çarşamba

  it('her denetim girdiği bütün dönemlere sayılır, hatalar toplanır', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2026, 10, 21, 9), 3), // bugün
      girdi('i20', yerel(2026, 10, 19, 0, 30), 0), // pazartesi: bu hafta, hatasız
      girdi('i20', yerel(2026, 10, 18, 23), 2), // pazar: geçen hafta, bu ay
      girdi('i20', yerel(2026, 3, 5), 1), // bu yıl
    ], simdi, SIRA);
    expect(s.araclar).toHaveLength(1);
    expect(s.araclar[0]!.sayilar).toEqual({
      bugun: { arac: 1, hata: 3, duzeltilecek: 3 },
      buHafta: { arac: 2, hata: 3, duzeltilecek: 3 },
      buAy: { arac: 3, hata: 5, duzeltilecek: 5 },
      buYil: { arac: 4, hata: 6, duzeltilecek: 6 },
    });
  });

  it('geçen yıl, ileri tarih ve bozuk tarih sayılmaz', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2025, 12, 31, 23, 59), 4),
      girdi('i20', yerel(2026, 10, 22), 4), // cihaz saati geri alınmış
      { aracId: 'i20', baslangic: 'bozuk', hataAdedi: 4, duzeltilecekAdedi: 4 },
    ], simdi, SIRA);
    expect(s.araclar).toEqual([]);
    expect(s.toplam.buYil).toEqual({ arac: 0, hata: 0, duzeltilecek: 0 });
  });

  it('araçlar verilen sırada; bilinmeyen araç sona eklenir, düşmez; toplam hepsini kapsar', () => {
    const s = sayacHesapla([
      girdi('bayon', yerel(2026, 10, 21), 1),
      girdi('eski-arac', yerel(2026, 10, 21), 2),
      girdi('ioniq3', yerel(2026, 10, 20), 5),
    ], simdi, SIRA);
    expect(s.araclar.map((a) => a.aracId)).toEqual(['ioniq3', 'bayon', 'eski-arac']);
    expect(s.toplam.bugun).toEqual({ arac: 2, hata: 3, duzeltilecek: 3 });
    expect(s.toplam.buHafta).toEqual({ arac: 3, hata: 8, duzeltilecek: 8 });
  });
});

// Ürün sahibi, 24.10.2026: skor olarak "araç başına hata" (DPU) seçildi. Tanım
// Excel raporundaki DPU ile aynı: kabul edilebilir hatalar sayılmaz.
describe('sayaç — DPU', () => {
  const simdi = yerel(2026, 10, 21, 15);

  it('kabul edilebilir olmayan hata / araç, iki ondalık', () => {
    const s = sayacHesapla([
      girdi('i20', yerel(2026, 10, 21, 9), 3, 2), // 3 hata, 1'i kabul edilebilir
      girdi('i20', yerel(2026, 10, 21, 11), 0, 0), // hatasız araç
      girdi('i20', yerel(2026, 10, 21, 12), 1, 0), // tek hatası kabul edilebilir
    ], simdi, SIRA);
    const bugun = s.araclar[0]!.sayilar.bugun;
    expect(bugun).toEqual({ arac: 3, hata: 4, duzeltilecek: 2 });
    expect(dpu(bugun)).toBe(0.67);
  });

  it('araç yoksa DPU yok (0 değil)', () => {
    expect(dpu({ arac: 0, hata: 0, duzeltilecek: 0 })).toBeNull();
  });
});
