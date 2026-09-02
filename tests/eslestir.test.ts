import { describe, expect, it } from 'vitest';
import { gecer, sadelestir } from '../scripts/eslestir.mjs';

/**
 * Bu testlerin HEPSİ gerçek ölçüm kazalarından türetildi. Her biri, bir zamanlar
 * DOĞRU bir AI cevabını "yanlış" saydıran bir eşleştirme hatasıdır. Ölçüm aracı
 * yanılınca, ölçüme dayanan her karar da yanılıyor: bir keresinde bu yüzden
 * "kurallar kaliteyi düşürdü" diye yanlış bir sonuca varmak üzereydim.
 */
describe('sadelestir', () => {
  it('Türkçe aksanları düşürür (yazım farkı hukuk farkı değildir)', () => {
    expect(sadelestir('TEBLİĞİNDEN')).toBe('tebliginden');
    expect(sadelestir('Şiddetli Geçimsizlik')).toBe('siddetli gecimsizlik');
  });

  it('bölünmez ve dar boşlukları normal boşluğa çevirir', () => {
    expect(sadelestir('30 gün')).toBe('30 gun');
    expect(sadelestir('30 gün')).toBe('30 gun');
  });

  it('farklı tire karakterlerini sadeleştirir', () => {
    expect(sadelestir('m.‑4/1‑a')).toBe('m.-4/1-a');
  });

  it('çoklu boşluğu teke indirir', () => {
    expect(sadelestir('iki   hafta')).toBe('iki hafta');
  });

  it('boş/eksik girdide çökmez', () => {
    expect(sadelestir(null)).toBe('');
    expect(sadelestir(undefined)).toBe('');
  });
});

describe('gecer — düz kalıp', () => {
  it('seçenekli kalıpta biri geçse yeterlidir', () => {
    expect(gecer('süre iki haftadır', 'iki hafta|2 hafta|14 gün')).toBe(true);
    expect(gecer('süre 14 gündür', 'iki hafta|2 hafta|14 gün')).toBe(true);
    expect(gecer('süre bir aydır', 'iki hafta|2 hafta|14 gün')).toBe(false);
  });

  it('KAZA 1: yumuşak g olmadan yazılan kelimeyi yakalar', () => {
    // Model "tebliğinden" yerine "tebliginden" yazmıştı ve doğru cevap
    // yanlış sayılmıştı.
    expect(gecer('gerekçeli kararın tebliginden itibaren', 'tebliğ')).toBe(true);
  });

  it('KAZA 2: bölünmez boşluklu sayıyı yakalar', () => {
    expect(gecer('en az 30 gün süre verilir', 'otuz gün|30 gün')).toBe(true);
  });
});

describe('gecer — düzenli ifade (re:)', () => {
  it('KAZA 3: araya giren parantezli sayıyı yakalar', () => {
    // "on (10) yıldır" — ne "on yıl" ne "10 yıl" düz kalıbı eşleşiyordu.
    const kalip = 're:on\\W*(\\(?10\\)?)?\\W*y[ıi]l|10\\W*y[ıi]l';
    expect(gecer('zamanaşımı süresi on (10) yıldır', kalip)).toBe(true);
    expect(gecer('zamanaşımı süresi on yıldır', kalip)).toBe(true);
    expect(gecer('zamanaşımı süresi 10 yıldır', kalip)).toBe(true);
  });

  it('yanlış cevabı yine de eler', () => {
    const kalip = 're:on\\W*(\\(?10\\)?)?\\W*y[ıi]l|10\\W*y[ıi]l';
    expect(gecer('zamanaşımı süresi beş yıldır', kalip)).toBe(false);
  });

  it('bozuk düzenli ifade çökertmez, false döner', () => {
    expect(gecer('herhangi bir metin', 're:[unclosed')).toBe(false);
  });
});
