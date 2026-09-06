import { describe, expect, it } from 'vitest';
import { maddeAtiflari, uydurmaMaddeler } from '../supabase/functions/_shared/atif';
import { maddeAtiflari as maddeAtiflariBetik } from '../scripts/uydurma.mjs';

/**
 * UYDURMA MADDE DENETİMİ — artık üründe de var, yalnız ölçümde değil.
 *
 * Ölçüm betiği bu ayıklayıcıyı aylardır kullanıyordu: "UYDURMA MADDE" satırını
 * biz görüyorduk, aynı metni ekranda gören avukat hiçbir şey görmüyordu. Uydurma
 * madde en pahalı hata türüdür çünkü GERÇEK GÖRÜNÜR — biçimi doğru, numarası
 * var, cümlesi hukukçu gibi kurulmuş; yanlışlığı ancak hâkim baktığında anlaşılır.
 */
describe('maddeAtiflari', () => {
  it('kısaltmalı atıfları çıkarır', () => {
    expect(maddeAtiflari('TBK m.146 uyarınca zamanaşımı on yıldır.')).toEqual([{ kanun: 'TBK', madde: '146' }]);
    expect(maddeAtiflari('HMK md. 119 gereğince')).toEqual([{ kanun: 'HMK', madde: '119' }]);
  });

  it('fıkra ve bent eklerini madde numarasına katmaz', () => {
    // "HMK m.119/1-d" TEK maddedir; "119/1" ayrı bir madde numarası değildir.
    expect(maddeAtiflari('HMK m.119/1-d ve İİK m.62/son')).toEqual([
      { kanun: 'HMK', madde: '119' },
      { kanun: 'İİK', madde: '62' },
    ]);
  });

  it('numara ile yazılan kanunları çözer', () => {
    expect(maddeAtiflari("4857 sayılı Kanun'un 17. maddesi")).toEqual([{ kanun: 'İşK', madde: '17' }]);
  });

  it('uzun yazılışı kısa numaraya tercih eder', () => {
    // "icra ve iflas kanunu" içindeki 2004, yıl gibi görünen kanun numarasıdır;
    // uzun yazılış önce denenmezse atıf kaçardı.
    expect(maddeAtiflari('İcra ve İflas Kanunu m.68')).toEqual([{ kanun: 'İİK', madde: '68' }]);
  });

  it('bilinmeyen kanunu sessizce atlar', () => {
    // KTK havuzda yok (bkz. scripts/korpus-eksikleri.md): atfı çıkarmıyoruz ki
    // sonradan "uydurma" diye işaretlenmesin.
    expect(maddeAtiflari('KTK m.88 uyarınca')).toEqual([]);
  });

  it('aynı atfı iki kez döndürmez', () => {
    expect(maddeAtiflari('TBK m.146 ... yine TBK m.146')).toHaveLength(1);
  });
});

describe('uydurmaMaddeler', () => {
  const kanunlar = new Set(['TBK', 'HMK', 'İşK']);
  const maddeler = new Set(['TBK#146', 'HMK#119', 'İşK#21']);

  it('havuzdaki maddeyi uydurma saymaz', () => {
    expect(uydurmaMaddeler([{ kanun: 'TBK', madde: '146' }], kanunlar, maddeler)).toEqual([]);
  });

  it('havuzdaki kanunun olmayan maddesini yakalar', () => {
    expect(uydurmaMaddeler([{ kanun: 'HMK', madde: '9999' }], kanunlar, maddeler)).toEqual(['HMK m.9999']);
  });

  it('havuzda olmayan kanuna dokunmaz', () => {
    // Orada eksik olan bizim korpusumuzdur; doğru bir atfı yanlış diye
    // işaretlemek, uyarıyı gürültüye çevirir ve avukat bir daha bakmaz.
    expect(uydurmaMaddeler([{ kanun: 'KTK', madde: '88' }], kanunlar, maddeler)).toEqual([]);
  });
});

/**
 * İKİ KOPYA AYNI ŞEYİ ÇIKARMALI.
 *
 * Ayıklayıcı iki yerde duruyor: üründe (_shared/atif.ts, Deno) ve ölçüm
 * betiğinde (scripts/uydurma.mjs, düz Node). Betikler ".ts" içeri alamadığı
 * için kopya kaçınılmaz — ama bugün aynı sınıftan altı arıza çıktı (katman
 * tablosu, hata metni, tarih ayıklayıcı, dönem anahtarları, fiyat tablosu ve
 * kanun yolu talebi). Kopyalanan mantık, sessizce ayrışan mantıktır.
 *
 * Ayrışırsa ölçüm ile ürün FARKLI şeyleri kusurlu sayar; yani ölçüm, ürünün
 * gerçekte ne yaptığını ölçmüyor olur — en sinsi hata türü.
 */
describe('ayıklayıcı ile ölçüm betiği ayrışmıyor', () => {
  const ornekler = [
    'TBK m.146 uyarınca zamanaşımı on yıldır.',
    'HMK m.119/1-d ve İİK m.62/son',
    "4857 sayılı Kanun'un 17. maddesi ile İş Kanunu m.21",
    'İcra ve İflas Kanunu m.68 ve TMK madde 1',
    'KTK m.88 uyarınca (havuzda yok)',
    'Yönetim Kanunu m.7 diye bir kanun yoktur',
    'TTK m.5/A dava şartı arabuluculuk',
    '',
  ];

  it('aynı girdilerde aynı çıktı', () => {
    for (const m of ornekler) {
      expect(maddeAtiflari(m), m).toEqual(maddeAtiflariBetik(m));
    }
  });
});
