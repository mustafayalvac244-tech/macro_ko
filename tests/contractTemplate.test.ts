import { describe, expect, it } from 'vitest';
import { buildContract, type ContractInput } from '@/utils/contractTemplate';

/**
 * AVUKATLIK ÜCRET SÖZLEŞMESİ ÜRETİCİSİ — uyarılar birer EMNİYET SUPABIDIR.
 *
 * Bu dosyanın hiç testi yoktu. Ürettiği metin avukatın müvekkiline imzalatacağı
 * sözleşmedir; uyarılar da onu geçersiz bir hükümden koruyan tek mekanizmadır.
 * Bir yeniden düzenlemede bu uyarılardan biri sessizce kaybolursa, avukat
 * Avukatlık Kanunu'na aykırı bir sözleşme imzalatır ve bunu kimse fark etmez.
 * Testlerin asıl amacı bu sessiz kaybı imkânsız kılmak.
 *
 * DÜRÜSTLÜK NOTU: burada kanunun DOĞRU yorumlandığını tasdik etmiyorum — ben
 * hukukçu değilim. Test edilen şey, kodun KENDİ beyan ettiği kuralları
 * gerçekten uyguladığıdır (Av.K. m. 163, 164/2 ve 164/son atıfları koddan
 * gelir). Atıfların isabetini bir meslektaşınıza teyit ettirmeniz gerekir.
 */

const temel = (o: Partial<ContractInput> = {}): ContractInput => ({
  tur: 'vekalet',
  avukatAd: 'Ayşe Yılmaz',
  muvekkilAd: 'Mehmet Demir',
  feeModel: 'maktu',
  maktuTutar: 50000,
  ...o,
});

const uyariVar = (uyarilar: string[], parca: string) => uyarilar.some((u) => u.includes(parca));

describe('buildContract — %25 nispi ücret sınırı (Av.K. m. 164/2)', () => {
  it('sınırın üzerinde oran girilirse UYARIR', () => {
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 40, davaDegeri: 1000000 }));
    expect(uyariVar(r.warnings, '%25')).toBe(true);
    expect(uyariVar(r.warnings, '164/2')).toBe(true);
  });

  it('tam sınırda (%25) uyarmaz', () => {
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 25, davaDegeri: 1000000 }));
    expect(uyariVar(r.warnings, '164/2')).toBe(false);
  });

  it('karma ücrette de sınırı denetler', () => {
    const r = buildContract(temel({ feeModel: 'karma', maktuTutar: 20000, nispiOran: 30 }));
    expect(uyariVar(r.warnings, '164/2')).toBe(true);
  });

  it('maktu ücrette bu uyarı çıkmaz', () => {
    const r = buildContract(temel({ feeModel: 'maktu', maktuTutar: 999999 }));
    expect(uyariVar(r.warnings, '164/2')).toBe(false);
  });
});

describe('buildContract — nispi ücretin sakıncalı olduğu alanlar', () => {
  it.each(['Aile Hukuku', 'Ceza Hukuku', 'İdare Hukuku'])('%s alanında nispi ücrete uyarır', (alan) => {
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 10, davaDegeri: 100000, hukukAlani: alan }));
    expect(uyariVar(r.warnings, 'nispi (yüzde) ücret uygun olmayabilir')).toBe(true);
  });

  it('ticaret hukukunda bu uyarıyı vermez', () => {
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 10, davaDegeri: 100000, hukukAlani: 'Ticaret Hukuku' }));
    expect(uyariVar(r.warnings, 'nispi (yüzde) ücret uygun olmayabilir')).toBe(false);
  });

  it('maktu ücret seçilmişse alan sakıncalı olsa da uyarmaz', () => {
    const r = buildContract(temel({ feeModel: 'maktu', maktuTutar: 30000, hukukAlani: 'Aile Hukuku' }));
    expect(uyariVar(r.warnings, 'nispi (yüzde) ücret uygun olmayabilir')).toBe(false);
  });
});

describe('buildContract — eksik bilgi uyarıları', () => {
  it('ücret hiç girilmezse AAÜT uyarısı verir', () => {
    const r = buildContract(temel({ feeModel: 'maktu', maktuTutar: undefined }));
    expect(uyariVar(r.warnings, 'Asgari Ücret Tarifesi')).toBe(true);
  });

  it('nispi ücrette dava değeri yoksa uyarır', () => {
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 10, davaDegeri: undefined }));
    expect(uyariVar(r.warnings, 'değeri girilmedi')).toBe(true);
  });

  it('taraf adı eksikse uyarır', () => {
    const r = buildContract(temel({ muvekkilAd: '' }));
    expect(uyariVar(r.warnings, 'Taraf bilgileri eksik')).toBe(true);
  });

  it('yazılı şekil uyarısı HER ZAMAN verilir (m. 163)', () => {
    const r = buildContract(temel());
    expect(uyariVar(r.warnings, 'm. 163')).toBe(true);
  });
});

describe('buildContract — sözleşme metni', () => {
  it('vekâlet ve danışmanlıkta farklı başlık üretir', () => {
    expect(buildContract(temel()).title).toContain('AVUKATLIK ÜCRET SÖZLEŞMESİ');
    expect(buildContract(temel({ tur: 'danismanlik', feeModel: 'danismanlik', aylikDanismanlik: 15000 })).title)
      .toContain('DANIŞMANLIK');
  });

  it('taraf adlarını metne yazar', () => {
    const r = buildContract(temel());
    expect(r.body).toContain('Ayşe Yılmaz');
    expect(r.body).toContain('Mehmet Demir');
  });

  it('karşı yan vekâlet ücretinin avukata ait olduğunu yazar (m. 164/son)', () => {
    // Bu hüküm sözleşmede yazılı olmazsa avukat karşı yan vekâlet ücretini
    // isteyemeyebilir; metinden düşmesi doğrudan gelir kaybıdır.
    expect(buildContract(temel()).body).toContain('164/son');
  });

  it('maktu tutarı metinde gösterir', () => {
    expect(buildContract(temel({ maktuTutar: 50000 })).body).toContain('50.000');
  });

  it('nispi ücrette hesaplanan tutarı gösterir', () => {
    // 1.000.000 × %10 = 100.000
    const r = buildContract(temel({ feeModel: 'nispi', nispiOran: 10, davaDegeri: 1000000 }));
    expect(r.body).toContain('100.000');
  });
});
