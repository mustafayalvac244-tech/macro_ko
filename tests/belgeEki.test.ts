import { describe, expect, it } from 'vitest';
import {
  EK_EN_COK,
  EK_METIN_TAVANI,
  PDF_SAYFA_TAVANI,
  denetimKaynagi,
  ekAciklamasi,
  ekleriAyikla,
  pdfBloklari,
  taranmisSayfaVar,
} from '../supabase/functions/_shared/belgeEki';

// "%PDF-1.7" → base64 "JVBERi0xLjc="
const PDF = 'JVBERi0xLjcKJcfsj6IK';

describe('ekleriAyikla', () => {
  it('dizi değilse boş döner', () => {
    expect(ekleriAyikla(undefined).ekler).toEqual([]);
    expect(ekleriAyikla('x').ekler).toEqual([]);
  });

  it('PDF sayfa tavanı içindeyse görüntüsüyle gider', () => {
    const r = ekleriAyikla([{ ad: 'dava.pdf', metin: 'metin', pdf: PDF, sayfa: 5 }]);
    expect(r.ekler[0].pdf).toBe(PDF);
    expect(r.pdfdenMetne).toEqual([]);
  });

  it('tavanı aşan PDF metne düşer ve bu söylenir', () => {
    const r = ekleriAyikla([
      { ad: 'a.pdf', metin: 'a', pdf: PDF, sayfa: PDF_SAYFA_TAVANI },
      { ad: 'b.pdf', metin: 'b', pdf: PDF, sayfa: 1 },
    ]);
    expect(r.ekler[0].pdf).toBe(PDF);
    expect(r.ekler[1].pdf).toBeUndefined();
    expect(r.ekler[1].metin).toBe('b');
    expect(r.pdfdenMetne).toEqual(['b.pdf']);
  });

  it('sayfa sayısı bilinmeyen PDF görüntüsüyle gönderilmez', () => {
    const r = ekleriAyikla([{ ad: 'x.pdf', metin: 'x', pdf: PDF }]);
    expect(r.ekler[0].pdf).toBeUndefined();
    expect(r.pdfdenMetne).toEqual(['x.pdf']);
  });

  it('metni de görüntüsü de olmayan ek okunamayan sayılır', () => {
    const r = ekleriAyikla([{ ad: 'taranmis.pdf', metin: '', pdf: PDF, sayfa: PDF_SAYFA_TAVANI + 1 }]);
    expect(r.ekler).toEqual([]);
    expect(r.okunamayan).toEqual(['taranmis.pdf']);
  });

  it('PDF imzası olmayan veri PDF sayılmaz', () => {
    const r = ekleriAyikla([{ ad: 'sahte.pdf', metin: 'm', pdf: 'aGVsbG8=', sayfa: 1 }]);
    expect(r.ekler[0].pdf).toBeUndefined();
  });

  it('data: ön ekini kırpar', () => {
    const r = ekleriAyikla([{ ad: 'a.pdf', metin: '', pdf: `data:application/pdf;base64,${PDF}`, sayfa: 1 }]);
    expect(r.ekler[0].pdf).toBe(PDF);
  });

  it('ek sayısını ve metin tavanını uygular', () => {
    const cok = Array.from({ length: EK_EN_COK + 2 }, (_, i) => ({ ad: `e${i}.txt`, metin: 'x'.repeat(EK_METIN_TAVANI) }));
    const r = ekleriAyikla(cok);
    // İlk ek tavanı doldurur; sonrakilerin metni kalmaz, okunamayan sayılır.
    expect(r.ekler.length).toBe(1);
    expect(r.ekler[0].metin.length).toBe(EK_METIN_TAVANI);
    expect(r.okunamayan.length).toBe(EK_EN_COK - 1);
  });

  it('toplam PDF boyutu tavanı aşarsa reddeder', () => {
    const buyuk = 'JVBER' + 'A'.repeat(12 * 1024 * 1024);
    expect(ekleriAyikla([{ ad: 'b.pdf', metin: '', pdf: buyuk, sayfa: 1 }]).hata).toBe('ek_buyuk');
  });

  it('ad satır sonu taşımaz', () => {
    expect(ekleriAyikla([{ ad: 'a\nb.txt', metin: 'm' }]).ekler[0].ad).toBe('a b.txt');
  });
});

describe('modele giden içerik', () => {
  const ekler = ekleriAyikla([
    { ad: 'dava.pdf', metin: 'PDF METNİ', pdf: PDF, sayfa: 3 },
    { ad: 'sozlesme.udf', metin: 'UDF METNİ' },
  ]).ekler;

  it('Claude hattında PDF metni ikinci kez gönderilmez', () => {
    const a = ekAciklamasi(ekler, true);
    expect(a).not.toContain('PDF METNİ');
    expect(a).toContain('UDF METNİ');
    expect(a).toContain('1. PDF belgesi');
  });

  it('yedek hatta her ekin metni yazılır', () => {
    const a = ekAciklamasi(ekler, false);
    expect(a).toContain('PDF METNİ');
    expect(a).toContain('UDF METNİ');
  });

  it('belge blokları yalnız PDF ekler için', () => {
    expect(pdfBloklari(ekler)).toEqual([
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF } },
    ]);
  });

  it('denetim kaynağı anlatım + tüm ek metinleri', () => {
    const k = denetimKaynagi('olay', ekler);
    expect(k).toContain('olay');
    expect(k).toContain('PDF METNİ');
    expect(k).toContain('UDF METNİ');
  });

  it('taranmış sayfa uyarısı yalnız görüntüsüyle giden PDF için', () => {
    expect(taranmisSayfaVar(ekler)).toBe(false);
    const t = ekleriAyikla([{ ad: 't.pdf', metin: '', pdf: PDF, sayfa: 2, taranmis: 2 }]).ekler;
    expect(taranmisSayfaVar(t)).toBe(true);
  });

  it('ek yoksa açıklama boş', () => {
    expect(ekAciklamasi([], true)).toBe('');
  });
});

import * as istemci from '@/lib/belgeEkiKurallari';
import * as sunucu from '../supabase/functions/_shared/belgeEki';

describe('istemci ve sunucu kuralları aynı', () => {
  it('tavanlar eşit', () => {
    expect(istemci.PDF_SAYFA_TAVANI).toBe(sunucu.PDF_SAYFA_TAVANI);
    expect(istemci.EK_EN_COK).toBe(sunucu.EK_EN_COK);
    expect(istemci.EK_DOSYA_TAVANI_BAYT).toBe(sunucu.EK_PDF_TAVANI_BAYT);
  });

  it('okuma planı sunucunun kararıyla örtüşür', () => {
    const ekler = [
      { ad: 'a.pdf', metin: 'a', pdf: PDF, sayfa: 15 },
      { ad: 'b.pdf', metin: 'b', pdf: PDF, sayfa: 10 },
      { ad: 'c.udf', metin: 'c' },
      { ad: 'd.pdf', metin: '', pdf: PDF, sayfa: 30 },
    ];
    expect(istemci.ekOkumaPlani(ekler)).toEqual(['gorsel', 'metin', 'metin', 'yok']);
    const govde = istemci.ekGovdesi(ekler);
    // Metne düşen PDF'in baytları gönderilmez; okunamayan hiç gönderilmez.
    expect(govde.map((e) => e.ad)).toEqual(['a.pdf', 'b.pdf', 'c.udf']);
    expect(govde[1].pdf).toBeUndefined();
    // Sunucu aynı gövdeyi aynı biçimde okur.
    const r = sunucu.ekleriAyikla(govde);
    expect(r.ekler.map((e) => !!e.pdf)).toEqual([true, false, false]);
  });
});
