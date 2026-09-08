import { describe, expect, it } from 'vitest';
import { aramaEslesir, aramaNormalize } from '../src/utils/arama';

/**
 * Türkçe arama — düz toLowerCase() kullanmanın sessizce yanlış sonuç verdiği
 * durumları kilitler. Bir hukuk uygulamasında "İcra" ve "Şikayet" en sık
 * aranan kelimeler; bunların bulunamaması özelliği işe yaramaz kılar.
 */
describe('aramaEslesir — Türkçe büyük/küçük harf', () => {
  it('"icra" yazarak "İcra Takip Talebi" bulunur (düzeltilen kusur)', () => {
    // Düz toLowerCase ile bu FALSE dönüyordu: "İ".toLowerCase() birleşik
    // noktalı bir harf üretir ve "icra" ile eşleşmez.
    expect(aramaEslesir('İcra Takip Talebi', 'icra')).toBe(true);
  });

  it('büyük harfle yazılmış sorgu da bulur', () => {
    expect(aramaEslesir('İcra Takip Talebi', 'İCRA')).toBe(true);
    expect(aramaEslesir('İcra Takip Talebi', 'Icra')).toBe(true);
  });

  it('noktasız ı ile yazılanı da bulur', () => {
    expect(aramaEslesir('Ödeme Emri Itiraz', 'ıtiraz')).toBe(true);
  });
});

describe('aramaEslesir — Türkçe karakter olmadan yazma', () => {
  it('"sikayet" yazarak "Şikayet Dilekçesi" bulunur', () => {
    expect(aramaEslesir('Şikayet Dilekçesi', 'sikayet')).toBe(true);
  });

  it('"odeme" yazarak "Ödeme Emri" bulunur', () => {
    expect(aramaEslesir('Ödeme Emri', 'odeme')).toBe(true);
  });

  it('"gorusme" yazarak "Görüşme Tutanağı" bulunur', () => {
    expect(aramaEslesir('Görüşme Tutanağı', 'gorusme')).toBe(true);
  });

  it('tam Türkçe yazım da çalışmaya devam eder', () => {
    expect(aramaEslesir('Şikayet Dilekçesi', 'şikayet')).toBe(true);
    expect(aramaEslesir('Görüşme Tutanağı', 'görüşme')).toBe(true);
  });
});

describe('aramaEslesir — sınır durumlar', () => {
  it('boş sorgu her şeyi geçirir (süzgeç kapalı demektir)', () => {
    expect(aramaEslesir('herhangi bir belge', '')).toBe(true);
    expect(aramaEslesir('herhangi bir belge', '   ')).toBe(true);
    expect(aramaEslesir('herhangi bir belge', null)).toBe(true);
  });

  it('null/undefined metin çökmez', () => {
    expect(aramaEslesir(null, 'icra')).toBe(false);
    expect(aramaEslesir(undefined, 'icra')).toBe(false);
  });

  it('alakasız sorgu eşleşmez', () => {
    expect(aramaEslesir('İcra Takip Talebi', 'boşanma')).toBe(false);
  });
});

describe('aramaNormalize', () => {
  it('Türkçe harfleri ASCII karşılığına katlar', () => {
    expect(aramaNormalize('ŞÇĞÖÜİI')).toBe('scgouii');
  });

  it('fazla boşlukları tekler ve kırpar', () => {
    expect(aramaNormalize('  İcra   Takip  ')).toBe('icra takip');
  });
});
