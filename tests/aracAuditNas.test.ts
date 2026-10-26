import { describe, expect, it } from 'vitest';

import {
  ARAC_SUTUNLARI, auditSkoru, demeritDegeri, excelTarihi, kaynakKodu, modelKodu, nasSayfalari, PROBLEM_KAYNAKLARI,
  PROBLEM_SUTUNLARI, sinifDegeri, sistemDegeri, skoraGirerMi, varsayilanSistem, vbaYuvarla,
} from '../arac-audit-app/src/cekirdek/nas';
import { aracEtiketi, ARAC_INDEKS } from '../arac-audit-app/src/cekirdek/model3d';
import { Denetim, Hata } from '../arac-audit-app/src/cekirdek/tipler';

// 26.10.2026 — ekibin Excel'i ("NAS — New Audit System") okundu; ürün sahibi
// "içeriği buna göre yap, Excel'de her şey var" dedi. Buradaki beklentiler
// Excel'in makrosundan ve listelerinden. Testleri ben yazdım: Excel'le aynı
// sonucu verdiğinin kanıtı değil, Excel'den OKUDUĞUM kuralların kodda
// durduğunun kanıtı.

describe('PROBLEM SOURCE', () => {
  it('liste Excel\'deki beş değer, AUDIT başta', () => {
    expect(PROBLEM_KAYNAKLARI).toEqual(['AUDIT', '3M - DEALER CLAIM', 'LONG TERM', 'NCBS', 'DURABILITY']);
  });

  it('eski sürümün yazımları Excel koduna çevrilir; Türkçe büyük harf kuralı uygulanmaz', () => {
    expect(kaynakKodu('HMC Audit')).toBe('AUDIT');
    expect(kaynakKodu('')).toBe('AUDIT');
    expect(kaynakKodu(undefined)).toBe('AUDIT');
    expect(kaynakKodu('Durability')).toBe('DURABILITY'); // "DURABİLİTY" değil
    expect(kaynakKodu(' long  term ')).toBe('LONG TERM');
  });

  it('skora yalnız AUDIT girer', () => {
    expect(skoraGirerMi('AUDIT')).toBe(true);
    expect(skoraGirerMi('HMC Audit')).toBe(true);
    expect(skoraGirerMi('DURABILITY')).toBe(false);
    expect(skoraGirerMi('3M - DEALER CLAIM')).toBe(false);
  });
});

describe('DEMERIT ve CLASS', () => {
  it('demerit derecenin sayısı; eski "kabul edilebilir" 0', () => {
    expect(demeritDegeri({ derece: '3', kabulEdilebilir: false })).toBe(3);
    expect(demeritDegeri({ derece: '0', kabulEdilebilir: false })).toBe(0);
    expect(demeritDegeri({ derece: '3', kabulEdilebilir: true })).toBe(0);
  });

  it('class yoksa ya da tanınmıyorsa MINOR (Excel formu MINOR ile açılır)', () => {
    expect(sinifDegeri({})).toBe('MINOR');
    expect(sinifDegeri({ sinif: 'MAJOR' })).toBe('MAJOR');
    expect(sinifDegeri({ sinif: 'X' as never })).toBe('MINOR');
  });
});

describe('SYSTEM önerisi', () => {
  it('bölgeye ve hata tipine göre', () => {
    expect(varsayilanSistem('kaput', 'cizik')).toBe('EXTERIOR');
    expect(varsayilanSistem('kaput', 'toz_kir')).toBe('PAINT');
    expect(varsayilanSistem('sase_alti', 'cizik')).toBe('CHASSIS');
    expect(varsayilanSistem('kaput_alti', 'gevsek')).toBe('CHASSIS');
    expect(varsayilanSistem('f_klima', 'calismiyor')).toBe('ELECTRIC');
    expect(varsayilanSistem('s_guc', 'calismiyor')).toBe('DRIVE');
    expect(varsayilanSistem('surucu_koltuk', 'leke')).toBe('INTERIOR');
  });

  it('kayıtta elle seçilen sistem önerinin önüne geçer', () => {
    expect(sistemDegeri({ sistem: 'BODY', parcaId: 'kaput', hataTipiId: 'cizik' })).toBe('BODY');
    expect(sistemDegeri({ sistem: '', parcaId: 'kaput', hataTipiId: 'cizik' })).toBe('EXTERIOR');
  });
});

describe('Audit Skoru', () => {
  it('round(100 × demerit / araç), VBA yuvarlamasıyla', () => {
    expect(auditSkoru(2, 3)).toBe(67);
    expect(auditSkoru(1, 8)).toBe(12); // 12,5 → çift olana
    expect(auditSkoru(0, 0)).toBeNull();
    expect(vbaYuvarla(2.5)).toBe(2);
    expect(vbaYuvarla(3.5)).toBe(4);
    expect(vbaYuvarla(2.51)).toBe(3);
  });
});

describe('model kodu', () => {
  it('Excel\'in MODEL kodları; ekranda kod · ad', () => {
    expect(modelKodu('ioniq3')).toBe('BJ');
    expect(modelKodu('i20')).toBe('BC3');
    expect(modelKodu('bayon')).toBe('CUV');
    expect(modelKodu('bilinmeyen')).toBe('bilinmeyen');
    expect(aracEtiketi(ARAC_INDEKS.ioniq3)).toBe('BJ · IONIQ 3');
    expect(aracEtiketi(ARAC_INDEKS.bc4cuv)).toBe('BC4 CUV');
    expect(aracEtiketi(undefined, 'yedek')).toBe('yedek');
  });
});

describe('Excel\'e aktar — NAS sayfaları', () => {
  const hata = (o: Partial<Hata>): Hata => ({
    id: 'h1', parcaId: 'kaput', hataTipiId: 'cizik', derece: '2', kabulEdilebilir: false, sorunTipi: 'Part',
    sorumlu: '', adet: 1, konum: '', aciklama: '', fotograflar: [], zaman: '2026-10-26T09:05:00', durum: 'acik', ...o,
  });
  const denetim = (o: Partial<Denetim>): Denetim => ({
    id: 'd1', aracId: 'ioniq3', vin: '', bodyNo: '015253', plaka: '', raporNo: '', denetci: 'Denetçi A', hat: '', vardiya: '',
    denetimTipi: 'HMC Audit', faz: '', ekip: '', spec: '', km: null,
    baslangic: '2026-10-26T09:00:00', bitis: null, durum: 'tamam', hatalar: [], ...o,
  });
  const deger = (h: unknown) => (h && typeof h === 'object' && 'v' in h ? (h as { v: unknown }).v : h);

  it('iki sayfa, Excel\'deki adlar ve sütunlar', () => {
    const [araclar, problemler] = nasSayfalari([denetim({})]);
    expect(araclar!.ad).toBe('AUDIT_CARS_LIST');
    expect(problemler!.ad).toBe('PROBLEMS_LIST');
    expect(araclar!.satirlar[0]!.map(deger)).toEqual([...ARAC_SUTUNLARI]);
    expect(problemler!.satirlar[0]!.map(deger)).toEqual([...PROBLEM_SUTUNLARI]);
  });

  it('satırlar Excel\'in alanlarıyla dolar; hatasız araç da araç listesinde', () => {
    const [araclar, problemler] = nasSayfalari([
      denetim({
        hatalar: [
          hata({ derece: '3', sinif: 'MAJOR', sorumlu: 'ASSEMBLY', fotograflar: ['f_1', 'f_2'] }),
          hata({ id: 'h2', hataTipiId: 'toz_kir', derece: '3', kabulEdilebilir: true, zaman: '2026-10-26T09:06:00' }),
        ],
      }),
      denetim({ id: 'd2', bodyNo: '', vin: 'NLHB51ABPDH123456', aracId: 'i20', denetimTipi: 'DURABILITY', baslangic: '2026-10-26T10:00:00' }),
    ]);
    const arac = araclar!.satirlar.slice(1).map((r) => r.map(deger));
    expect(arac.map((r) => r.slice(2, 6))).toEqual([['AUDIT', 'BJ', '015253', 2], ['DURABILITY', 'BC3', '123456', 0]]);
    expect(arac[0]![7]).toBe('AUDITBJ015253');

    const p = problemler!.satirlar.slice(1).map((r) => Object.fromEntries(PROBLEM_SUTUNLARI.map((ad, i) => [ad, deger(r[i])])));
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({
      'PROBLEM SOURCE': 'AUDIT', MODEL: 'BJ', BODY: '015253', CLASS: 'MAJOR', DEMERIT: 3, SYSTEM: 'EXTERIOR',
      RESPONSIBLE: 'ASSEMBLY', AUDITOR: 'Denetçi A', 'PHOTO LINK': 'fotograflar/f_1.jpg, fotograflar/f_2.jpg',
      'VERIFICATION BODY NO': '',
    });
    // Eski "kabul edilebilir" kayıt: demerit 0; boya tipi PAINT; class yoksa MINOR.
    expect(p[1]).toMatchObject({ DEMERIT: 0, SYSTEM: 'PAINT', CLASS: 'MINOR' });
    // Tarih metin değil, Excel tarih seri numarası.
    expect(typeof p[0]!.DATE).toBe('number');
    expect(p[0]!.DATE).toBeCloseTo(excelTarihi('2026-10-26T09:05:00')!, 6);
  });

  // 26.10.2026 — takip: ekibin dosyasında PROGRESS'in tek değeri "SHARED".
  it('takip: açık kayıt boş; paylaşılan SHARED; önlem uygulanan tarihli; doğrulanan body\'li', () => {
    const [, problemler] = nasSayfalari([denetim({
      hatalar: [
        hata({ id: 'a' }),
        hata({ id: 'b', durum: 'atandi', onlem: 'Tedarikçiye bildirildi', zaman: '2026-10-26T09:06:00' }),
        hata({ id: 'c', durum: 'giderildi', onlem: 'Klips değişti', giderilmeZamani: '2026-10-27T08:00:00', zaman: '2026-10-26T09:07:00' }),
        hata({ id: 'd', durum: 'kapali', onlem: 'Kalıp düzeltildi', giderilmeZamani: '2026-10-27T08:00:00', dogrulamaBody: '015300', zaman: '2026-10-26T09:08:00' }),
      ],
    })]);
    const p = problemler!.satirlar.slice(1).map((r) => Object.fromEntries(PROBLEM_SUTUNLARI.map((ad, i) => [ad, deger(r[i])])));
    expect(p.map((x) => x.PROGRESS)).toEqual(['', 'SHARED', 'SHARED', 'SHARED']);
    expect(p.map((x) => x.COUNTERMEASURE)).toEqual(['', 'Tedarikçiye bildirildi', 'Klips değişti', 'Kalıp düzeltildi']);
    expect(p[0]!['CM APPLICATION DATE']).toBe('');
    expect(p[1]!['CM APPLICATION DATE']).toBe('');
    expect(p[2]!['CM APPLICATION DATE']).toBeCloseTo(excelTarihi('2026-10-27T08:00:00')!, 6);
    expect(p.map((x) => x['VERIFICATION BODY NO'])).toEqual(['', '', '', '015300']);
  });

  it('Excel tarih seri numarası yerel saatle: 1.1.2026 00:00 = 46023', () => {
    expect(excelTarihi(new Date(2026, 0, 1).toISOString())).toBeCloseTo(46023, 6);
    expect(excelTarihi('bozuk')).toBeNull();
  });
});
