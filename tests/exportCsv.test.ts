import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/utils/csvMetni';

/**
 * CSV dışa aktarma — muhasebeciye giden dosya.
 *
 * Bu dosyanın hiç testi yoktu ve iki gerçek kusur taşıyordu: tutarlar Türkçe
 * Excel'de metin olarak açılıyordu, ve kullanıcıdan gelen metinler formül
 * olarak çalışabiliyordu. İkisi de aşağıda kilitlendi.
 */

// BOM'u ayıklayıp satırlara böler (BOM Excel'in UTF-8 okuması için gerekli).
const satirlar = (csv: string) => csv.replace(/^﻿/, '').split('\r\n');

describe('toCsv — Türkçe Excel uyumu', () => {
  it('sayıları VİRGÜLLÜ yazar (noktalı yazılırsa Türkçe Excel metin sayar)', () => {
    const csv = toCsv(['tutar'], [[1234.5]]);
    expect(satirlar(csv)[1]).toBe('1234,50');
  });

  it('negatif tutarı sayı olarak bırakır — tırnaklamaz', () => {
    // Gider satırları negatiftir; tırnaklansaydı sütun toplanamazdı.
    const csv = toCsv(['tutar'], [[-1234.5]]);
    expect(satirlar(csv)[1]).toBe('-1234,50');
  });

  it('her zaman iki ondalık basar (kuruş kaybolmasın)', () => {
    expect(satirlar(toCsv(['t'], [[7]]))[1]).toBe('7,00');
  });

  it('BOM ile başlar ve CRLF kullanır', () => {
    const csv = toCsv(['a'], [['b']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('ayırıcı noktalı virgüldür', () => {
    expect(satirlar(toCsv(['a', 'b'], [['x', 'y']]))[0]).toBe('a;b');
  });
});

describe('toCsv — formül enjeksiyonu', () => {
  it("'=' ile başlayan hücreyi etkisizleştirir", () => {
    const csv = toCsv(['ad'], [["=cmd|'/c calc'!A1"]]);
    expect(satirlar(csv)[1]).toBe("'=cmd|'/c calc'!A1");
  });

  it("'+' ve '@' ile başlayanları da etkisizleştirir", () => {
    expect(satirlar(toCsv(['a'], [['+1+1']]))[1]).toBe("'+1+1");
    expect(satirlar(toCsv(['a'], [['@SUM(A1)']]))[1]).toBe("'@SUM(A1)");
  });

  it("metin olarak gelen '-' formülünü etkisizleştirir ama sayıya dokunmaz", () => {
    expect(satirlar(toCsv(['a'], [['-2+3']]))[1]).toBe("'-2+3");
    // Sayıya benzeyen metin (ör. eski çağrı yerlerinden gelen) korunur.
    expect(satirlar(toCsv(['a'], [['-15,50']]))[1]).toBe('-15,50');
  });
});

describe('toCsv — kaçış', () => {
  it('noktalı virgül ve tırnak içeren metni tırnaklar', () => {
    expect(satirlar(toCsv(['a'], [['Ali; Veli']]))[1]).toBe('"Ali; Veli"');
    expect(satirlar(toCsv(['a'], [['12" boru']]))[1]).toBe('"12"" boru"');
  });

  it('satır sonu içeren notu tek hücrede tutar', () => {
    const csv = toCsv(['not'], [['birinci\nikinci']]);
    expect(csv).toContain('"birinci\nikinci"');
  });

  it('null ve undefined boş hücre olur', () => {
    expect(satirlar(toCsv(['a', 'b'], [[null, undefined]]))[1]).toBe(';');
  });
});
