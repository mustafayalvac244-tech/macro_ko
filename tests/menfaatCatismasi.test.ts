import { describe, expect, it } from 'vitest';
import {
  adAnahtari,
  adEslesmesi,
  adSozcukleri,
  ciddiMi,
  menfaatTara,
  tcAyniMi,
  turkceSadelestir,
} from '@/utils/menfaatCatismasi';

/**
 * MENFAAT ÇATIŞMASI.
 *
 * Avukatlık Kanunu m.38/b: avukat aynı işte menfaati zıt tarafa hizmet edemez.
 * Kaçırmanın bedeli disiplin sorumluluğu ve dosyadan çekilmektir.
 *
 * YÖN ASİMETRİK: yanlış negatif meslekî risk, yanlış pozitif yalnız fazladan
 * bir uyarı satırıdır. Testler bu yüzden ağırlıklı olarak KAÇIRMAMAYI sınar;
 * ilgisiz adların eşleşmediği de ayrıca bağlanır ki uyarı yığını oluşmasın.
 *
 * Aşağıdaki beş varyasyon ESKİ eşleştiricide ölçülerek kaçırıldığı görülen
 * gerçek biçimlerdir (bkz. menfaatCatismasi.ts başlığı).
 */

describe('turkceSadelestir', () => {
  it('Türkçe küçültme kuralını uygular (I -> ı)', () => {
    expect(turkceSadelestir('IŞIK')).toBe('isik');
    expect(turkceSadelestir('İSTANBUL')).toBe('istanbul');
  });

  it('aynı kişinin Türkçesiz yazımını aynı yere indirir', () => {
    expect(turkceSadelestir('Şükrü Güneş')).toBe(turkceSadelestir('Sukru Gunes'));
  });
});

describe('adSozcukleri — gürültüyü atar', () => {
  it('unvanı düşürür', () => {
    expect(adSozcukleri('Av. Ahmet Yılmaz')).toEqual(['ahmet', 'yilmaz']);
  });

  it('şirket eklerini düşürür', () => {
    expect(adAnahtari('Yılmaz İnşaat A.Ş.')).toBe(adAnahtari('Yılmaz İnşaat Anonim Şirketi'));
  });

  it('noktalama ve tireyi boşluk sayar', () => {
    expect(adAnahtari('Ahmet Yılmaz-Demir')).toBe(adAnahtari('Ahmet Yılmaz Demir'));
    expect(adAnahtari('YILMAZ, Ahmet')).toBe(adAnahtari('Ahmet Yılmaz'));
  });

  it('sözcük sırasını önemsizleştirir', () => {
    expect(adAnahtari('Ahmet Yılmaz')).toBe(adAnahtari('Yılmaz Ahmet'));
  });
});

describe('adEslesmesi — eski tarayıcının KAÇIRDIĞI beş biçim', () => {
  it('soyad önce yazımını yakalar (UYAP biçimi)', () => {
    expect(adEslesmesi('Ahmet Yılmaz', 'Yılmaz Ahmet')).toBe('kesin');
  });

  it('virgüllü yazımı yakalar', () => {
    expect(adEslesmesi('Ahmet Yılmaz', 'YILMAZ, Ahmet')).toBe('kesin');
  });

  it('A.Ş. ile Anonim Şirketi aynı sayar', () => {
    expect(adEslesmesi('Yılmaz İnşaat A.Ş.', 'Yılmaz İnşaat Anonim Şirketi')).toBe('kesin');
  });

  it('tireli soyadı yakalar', () => {
    expect(adEslesmesi('Ahmet Yılmaz-Demir', 'Ahmet Yılmaz Demir')).toBe('kesin');
  });

  it('üç adlı kişide sıra farkını yakalar', () => {
    expect(adEslesmesi('Mehmet Ali Kaya', 'Kaya Mehmet Ali')).toBe('kesin');
  });
});

describe('adEslesmesi — güç dereceleri', () => {
  it('kısa unvanın tamamı uzunun içindeyse güçlü sayar', () => {
    expect(adEslesmesi('Yılmaz İnşaat', 'Yılmaz İnşaat Turizm Ltd. Şti.')).toBe('guclu');
  });

  it('yalnız soyadı paylaşan adlar ZAYIF sayılır (atılmaz ama öne çıkmaz)', () => {
    expect(adEslesmesi('Ahmet Yılmaz', 'Mehmet Yılmaz')).toBe('zayif');
  });

  it('ilgisiz adları eşleştirmez', () => {
    expect(adEslesmesi('Ahmet Yılmaz', 'Hasan Kaya')).toBeNull();
  });

  it('tek sözcüklük ad ayırt edici sayılmaz', () => {
    // Yalnız "Ahmet" ile eşleşmek, her Ahmet'i çatışma yapardı.
    expect(adEslesmesi('Ahmet', 'Ahmet Kaya')).toBeNull();
  });

  it('boş/anlamsız girdide eşleşme üretmez', () => {
    expect(adEslesmesi('', 'Ahmet Yılmaz')).toBeNull();
    expect(adEslesmesi('   ', 'Ahmet Yılmaz')).toBeNull();
    expect(adEslesmesi('Av.', 'Ahmet Yılmaz')).toBeNull();
  });
});

describe('tcAyniMi', () => {
  it('biçim farkına rağmen aynı numarayı tanır', () => {
    expect(tcAyniMi('12345678901', ' 123 456 789 01 ')).toBe(true);
  });

  it('eksik/boş numarada eşleşme saymaz', () => {
    expect(tcAyniMi('1234567890', '1234567890')).toBe(false); // 10 hane
    expect(tcAyniMi(null, '12345678901')).toBe(false);
    expect(tcAyniMi('', '')).toBe(false);
  });
});

const kaynak = {
  muvekkiller: [
    { id: 'm1', full_name: 'Ahmet Yılmaz', tc_no: '12345678901' },
    { id: 'm2', full_name: 'Zeynep Kaya', company: 'Kaya Tekstil A.Ş.' },
  ],
  davalar: [
    { id: 'd1', title: 'Yılmaz v. Demir', opposing_party: 'Yılmaz Ahmet' },
    { id: 'd2', title: 'Alacak davası', opposing_party: 'Kaya Tekstil Anonim Şirketi' },
    { id: 'd3', title: 'Tazminat', opposing_party: 'Ahmet Yılmaz', opposing_counsel: 'Av. Selin Ak' },
  ],
  ofisUyeleri: [{ id: 'o1', full_name: 'Selin Ak' }],
};

describe('menfaatTara — kapsam', () => {
  it('aynı kişi BİRDEN ÇOK dosyada karşı tarafsa hepsini döndürür', () => {
    // Eski davranış ilk eşleşmede duruyordu; çatışmanın kapsamı kaç dosyaya
    // dokunduğudur.
    const b = menfaatTara({ ad: 'Ahmet Yılmaz' }, kaynak).filter((x) => x.tur === 'karsi-taraf');
    expect(b.map((x) => x.kayitId).sort()).toEqual(['d1', 'd3']);
  });

  it('şirket adını da tarar', () => {
    const b = menfaatTara({ ad: 'Zeynep Kaya', sirket: 'Kaya Tekstil A.Ş.' }, kaynak);
    expect(b.some((x) => x.tur === 'karsi-taraf' && x.kayitId === 'd2')).toBe(true);
  });

  it('karşı taraf girilirken mevcut MÜVEKKİLİ bulur', () => {
    const b = menfaatTara({ ad: 'Yılmaz Ahmet' }, kaynak);
    expect(b.some((x) => x.tur === 'muvekkil' && x.kayitId === 'm1')).toBe(true);
  });

  it('aynı TC ile mükerrer müvekkil kaydını yakalar', () => {
    const b = menfaatTara({ ad: 'A. Yılmaz', tcNo: '123 456 789 01' }, kaynak);
    expect(b.some((x) => x.tur === 'mukerrer-tc' && x.kayitId === 'm1')).toBe(true);
  });

  it('karşı vekil kendi ofisimizden biriyse bildirir', () => {
    const b = menfaatTara({ ad: 'Yeni Müvekkil' }, kaynak);
    expect(b.some((x) => x.tur === 'ofis-karsi-vekil' && x.kayitId === 'd3')).toBe(true);
  });

  it('düzenlemede kendi kaydını çatışma saymaz', () => {
    const b = menfaatTara({ ad: 'Ahmet Yılmaz', hariçTutulanId: 'm1' }, kaynak);
    expect(b.some((x) => x.tur === 'muvekkil' && x.kayitId === 'm1')).toBe(false);
  });

  it('bulgular güçten zayıfa sıralıdır', () => {
    const b = menfaatTara({ ad: 'Ahmet Yılmaz' }, kaynak);
    const sira = { kesin: 0, guclu: 1, zayif: 2 } as const;
    for (let i = 1; i < b.length; i++) {
      expect(sira[b[i]!.guc]).toBeGreaterThanOrEqual(sira[b[i - 1]!.guc]);
    }
  });

  it('ilgisiz adda hiç bulgu üretmez', () => {
    const b = menfaatTara({ ad: 'Hasan Çelik' }, { ...kaynak, ofisUyeleri: [] });
    expect(b).toEqual([]);
  });

  it('boş adda ve boş kaynakta çökmez', () => {
    expect(menfaatTara({ ad: '' }, kaynak)).toEqual([]);
    expect(menfaatTara({ ad: 'Ahmet Yılmaz' }, { muvekkiller: [], davalar: [] })).toEqual([]);
  });
});

describe('ciddiMi — uyarının tonu', () => {
  it('kesin/güçlü bulgu varsa ciddidir', () => {
    expect(ciddiMi(menfaatTara({ ad: 'Ahmet Yılmaz' }, kaynak))).toBe(true);
  });

  it('yalnız zayıf bulgu varsa ciddi sayılmaz', () => {
    const zayif = menfaatTara(
      { ad: 'Mehmet Yılmaz' },
      { muvekkiller: [], davalar: [{ id: 'd1', title: 'X', opposing_party: 'Ahmet Yılmaz' }] }
    );
    expect(zayif.every((b) => b.guc === 'zayif')).toBe(true);
    expect(ciddiMi(zayif)).toBe(false);
  });
});
