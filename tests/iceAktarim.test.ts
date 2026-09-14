import { describe, expect, it } from 'vitest';
import {
  ayiriciTahmin,
  basliklariEslestir,
  csvAyristir,
  sadelestir,
  satirlariCevir,
  tarihCevir,
} from '../src/utils/iceAktarim';

/**
 * Bu testleri ben yazdım ve örnek dosyaları da ben uydurdum. GERÇEK bir UYAP
 * ya da Sinerji çıktısı henüz elimde yok — ölçtüğüm şey ayrıştırıcının
 * tanımladığım kurallara uyması, gerçek dosyaları okuyabildiği DEĞİL.
 * Gerçek doğrulama, avukattan bir dışa aktarma dosyası gelince yapılır.
 */

describe('ayiriciTahmin', () => {
  it('TÜRKÇE EXCEL NOKTALI VİRGÜL YAZAR — onu bulmalı', () => {
    // Bu tek satır, Türkiye'den gelen dosyaların çoğunu temsil ediyor.
    // Virgüle sabitlenmiş bir okuyucu bunu TEK SÜTUN görürdü.
    expect(ayiriciTahmin('Esas No;Mahkeme;Müvekkil')).toBe(';');
  });

  it('virgüllü dosyayı da bulur', () => {
    expect(ayiriciTahmin('Esas No,Mahkeme,Müvekkil')).toBe(',');
  });

  it('sekmeli dosyayı bulur', () => {
    expect(ayiriciTahmin('Esas No\tMahkeme\tMüvekkil')).toBe('\t');
  });

  it('tırnak içindeki ayırıcı sayıma KATILMAZ', () => {
    // "Yılmaz, Ahmet" hücresi virgül sayısını şişirip yanlış ayırıcı
    // seçtirebilirdi.
    expect(ayiriciTahmin('"Yılmaz, Ahmet";Mahkeme;Tarih')).toBe(';');
  });
});

describe('csvAyristir', () => {
  it('basit satırları ayırır', () => {
    const s = csvAyristir('a;b;c\n1;2;3');
    expect(s).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('tırnak içindeki ayırıcıyı bölmez', () => {
    const s = csvAyristir('ad;mahkeme\n"Yılmaz; Ahmet";İstanbul 9. İş');
    expect(s[1]).toEqual(['Yılmaz; Ahmet', 'İstanbul 9. İş']);
  });

  it('tırnak içindeki SATIR SONUNU bölmez', () => {
    const s = csvAyristir('ad;not\n"Ahmet";"birinci satır\nikinci satır"');
    expect(s).toHaveLength(2);
    expect(s[1][1]).toBe('birinci satır\nikinci satır');
  });

  it('çift tırnakla kaçırılmış tırnağı çözer', () => {
    const s = csvAyristir('a\n"o ""Ahmet"" dedi"');
    expect(s[1][0]).toBe('o "Ahmet" dedi');
  });

  it('EXCEL BOM ATILIR — yoksa ilk başlık hiç eşleşmez', () => {
    // Bu sessiz bir kusurdur: hata vermez, sadece eşleşmez.
    const s = csvAyristir('﻿Esas No;Mahkeme');
    expect(s[0][0]).toBe('Esas No');
  });

  it('CRLF satır sonlarını tek satır sayar', () => {
    const s = csvAyristir('a;b\r\n1;2\r\n');
    expect(s).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('boş satırları atar', () => {
    const s = csvAyristir('a;b\n\n1;2\n\n\n');
    expect(s).toHaveLength(2);
  });
});

describe('sadelestir', () => {
  it('Türkçe harfleri ve büyük/küçük farkını siler', () => {
    expect(sadelestir('MÜVEKKİL')).toBe('muvekkil');
    expect(sadelestir('Müvekkil')).toBe('muvekkil');
    expect(sadelestir('Karşı Taraf')).toBe('karsi taraf');
    expect(sadelestir('Esas No.')).toBe('esas no');
  });

  it('noktasız ı ve noktalı İ aynı yere iner', () => {
    // toLocaleLowerCase('tr') kullanılsaydı bu ikisi AYRILIRDI.
    expect(sadelestir('AÇILIŞ')).toBe(sadelestir('açılış'));
  });
});

describe('basliklariEslestir', () => {
  it('tipik bir başlık satırını eşler', () => {
    const e = basliklariEslestir(['Esas No', 'Mahkeme', 'Müvekkil', 'Karşı Taraf', 'Açılış Tarihi']);
    expect(e.esasNo).toBe(0);
    expect(e.mahkeme).toBe(1);
    expect(e.muvekkil).toBe(2);
    expect(e.karsiTaraf).toBe(3);
    expect(e.acilisTarihi).toBe(4);
  });

  it('icra terimlerini de tanır (alacaklı/borçlu)', () => {
    const e = basliklariEslestir(['Dosya No', 'İcra Müdürlüğü', 'Alacaklı', 'Borçlu']);
    expect(e.esasNo).toBe(0);
    expect(e.mahkeme).toBe(1);
    expect(e.muvekkil).toBe(2);
    expect(e.karsiTaraf).toBe(3);
  });

  it('AYNI SÜTUN İKİ ALANA ATANMAZ', () => {
    // "Tarih" hem açılış hem başka bir alana uyabilirdi; ilk alan alır,
    // sütun bir daha kullanılmaz. Aksi hâlde iki alan da yanlış dolardı.
    const e = basliklariEslestir(['Tarih', 'Durum']);
    const kullanilan = Object.values(e);
    expect(new Set(kullanilan).size).toBe(kullanilan.length);
  });

  it('tanımadığı başlığı eşlemez, uydurmaz', () => {
    const e = basliklariEslestir(['Zübüzük', 'Falanca']);
    expect(Object.keys(e)).toHaveLength(0);
  });
});

describe('tarihCevir', () => {
  it('GG.AA.YYYY biçimini çevirir', () => {
    expect(tarihCevir('04.02.2026')).toBe('2026-02-04');
    expect(tarihCevir('4/2/2026')).toBe('2026-02-04');
  });

  it('ISO biçimini korur', () => {
    expect(tarihCevir('2026-02-04')).toBe('2026-02-04');
  });

  it('TANIMADIĞINI ÇEVİRMEZ — tahmin etmez', () => {
    // Tarihsiz dosya, yanlış tarihli dosyadan iyidir.
    expect(tarihCevir('Şubat 2026')).toBeNull();
    expect(tarihCevir('')).toBeNull();
    expect(tarihCevir(null)).toBeNull();
  });

  it('olanaksız gün/ay reddedilir', () => {
    expect(tarihCevir('32.01.2026')).toBeNull();
    expect(tarihCevir('01.13.2026')).toBeNull();
  });
});

describe('satirlariCevir', () => {
  const eslesme = { esasNo: 0, mahkeme: 1, muvekkil: 2, acilisTarihi: 3 };

  it('satırları kayda çevirir', () => {
    const { kayitlar } = satirlariCevir(
      [['2026/418', 'İstanbul 9. İş Mahkemesi', 'Mehmet Korkmaz', '04.02.2026']],
      eslesme,
    );
    expect(kayitlar).toHaveLength(1);
    expect(kayitlar[0].esasNo).toBe('2026/418');
    expect(kayitlar[0].acilisTarihi).toBe('2026-02-04');
  });

  it('başlık sütunu yoksa esas no + mahkemeden üretir', () => {
    const { kayitlar } = satirlariCevir(
      [['2026/418', 'İstanbul 9. İş Mahkemesi', 'Mehmet Korkmaz', '']],
      eslesme,
    );
    expect(kayitlar[0].baslik).toBe('2026/418 — İstanbul 9. İş Mahkemesi');
  });

  it('adlandırılamayan satırı ATLAR ve SEBEBİNİ SÖYLER', () => {
    // Sessizce atmak en kötüsü: avukat 300 dosya yükleyip 280 görür ve
    // hangilerinin kaybolduğunu asla bilemez.
    const { kayitlar, atlananlar } = satirlariCevir([['', '', '', '']], eslesme);
    expect(kayitlar).toHaveLength(0);
    expect(atlananlar).toHaveLength(1);
    expect(atlananlar[0].satirNo).toBe(1);
    expect(atlananlar[0].sebep).toContain('adlandırılamıyor');
  });

  it('boş hücreler null olur, boş metin olmaz', () => {
    const { kayitlar } = satirlariCevir([['2026/418', '  ', 'Ahmet', '']], eslesme);
    expect(kayitlar[0].mahkeme).toBeNull();
    expect(kayitlar[0].acilisTarihi).toBeNull();
  });

  it('eşlenmemiş alan null kalır', () => {
    const { kayitlar } = satirlariCevir([['2026/418', 'Mahkeme', 'Ahmet', '']], eslesme);
    expect(kayitlar[0].karsiTaraf).toBeNull();
    expect(kayitlar[0].durum).toBeNull();
  });
});

describe('uçtan uca — Türkçe Excel çıktısı taklidi', () => {
  it('BOM + noktalı virgül + tırnaklı hücre birlikte çalışır', () => {
    const dosya =
      '﻿Esas No;Mahkeme;Müvekkil;Açılış Tarihi\r\n' +
      '2026/418;İstanbul 9. İş Mahkemesi;"Korkmaz, Mehmet";04.02.2026\r\n' +
      '2026/903;İstanbul 6. Asliye Ticaret;Doruk İnşaat A.Ş.;20.11.2025\r\n';

    const satirlar = csvAyristir(dosya);
    const eslesme = basliklariEslestir(satirlar[0]);
    const { kayitlar, atlananlar } = satirlariCevir(satirlar.slice(1), eslesme);

    expect(atlananlar).toHaveLength(0);
    expect(kayitlar).toHaveLength(2);
    expect(kayitlar[0].muvekkil).toBe('Korkmaz, Mehmet');
    expect(kayitlar[0].acilisTarihi).toBe('2026-02-04');
    expect(kayitlar[1].mahkeme).toBe('İstanbul 6. Asliye Ticaret');
  });
});
