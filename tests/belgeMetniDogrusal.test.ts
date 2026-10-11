import { describe, expect, it } from 'vitest';
import { docxMetni, stripXml, udfMetni } from '../supabase/functions/_shared/belgeMetni';

/**
 * DOĞRUSAL SÜRE (10.10.2026, 50 denetçi → ajan 26).
 *
 * doc-extract kullanıcının yüklediği dosyanın içini ayrıştırıyor; dosya
 * KÖTÜ NİYETLİ ya da bozuk olabilir. Eski desenler "açan var, kapanan yok"
 * girdisinde her açanı sonuna kadar taratıyordu:
 *   • stripXml  /<[^>]+>/g       — '<' x N: ikinci dereceden (kuadratik).
 *   • udfMetni  (CDATA…)+ </content> — kapanış yoksa ÜSTEL: her ek CDATA
 *     bloğu süreyi ikiye katlıyor (ölçüldü: 20→22 blok 9→36 ms; 40 blok
 *     saatler = uç işlevi kilitlenir).
 *   • docxMetni <w:del …>…</w:del>, <w:t>…</w:t>, <w:pPr>…</w:pPr> —
 *     kapanmayan açanlarda kuadratik.
 * Sınırlar bilerek küçük: eski kodda her biri saniyeler sürer, yenisinde
 * milisaniye. Eşik (1 sn) ölçülen farkın çok altında/üstünde, titreme yapmaz.
 */
const ESIK_MS = 1000;

function sure(f: () => unknown): number {
  const b = performance.now();
  f();
  return performance.now() - b;
}

describe('stripXml — doğrusal', () => {
  it("100.000 kapanmayan '<' 1 saniyeden kısa sürede biter (eski: ~10 sn)", () => {
    expect(sure(() => stripXml('<'.repeat(100_000)))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan CDATA başlangıçları doğrusal (eski: kuadratik)', () => {
    expect(sure(() => stripXml('<![CDATA['.repeat(40_000)))).toBeLessThan(ESIK_MS);
  });

  // Beklenen değerler ESKİ (regex) uygulamanın çıktısıdır; doğrusal yeniden
  // yazım aynı sonucu vermeli.
  it.each([
    ['a<>b', 'a<>b'],
    ['a<b', 'a<b'],
    ['x<a<b>y', 'x y'],
    ['<p>Merhaba</p>', 'Merhaba'],
    ['<a>1</a><b>2</b>', '1 2'],
    ['<![CDATA[a > b]]>', 'a > b'],
    ['<![CDATA[aç', '<![CDATA[aç'],
    ['<x><![CDATA[bir]]><![CDATA[iki]]></x>', 'biriki'],
    ['önce<br/>sonra<br />bitti', 'önce\nsonra\nbitti'],
    ['<w:p>A</w:p><w:p>B</w:p>', 'A\n B'],
    ['&lt;ek&gt; &amp; &#65;', '<ek> & A'],
  ])('eski çıktıyla aynı: %j', (girdi, beklenen) => {
    expect(stripXml(girdi)).toBe(beklenen);
  });
});

describe('udfMetni — üstel geri izleme yok', () => {
  it('</content> eksik, 30 CDATA bloğu: 1 saniyeden kısa (eski: ~9 sn; 40 blok saatler)', () => {
    const xml = '<content>' + '<![CDATA[x]]>'.repeat(30);
    let cikti = '';
    expect(sure(() => { cikti = udfMetni(xml); })).toBeLessThan(ESIK_MS);
    // Tanımadığımız yapı hiç okunmamaktansa kaba okunur (stripXml'e düşer).
    expect(cikti).toBe('x'.repeat(30));
  });

  it('kapanışı bozuk (araya metin girmiş) çok parçalı içerik de hızlı', () => {
    const xml = '<content>' + '<![CDATA[a]]>'.repeat(30) + ' ARTIK </content>';
    expect(sure(() => udfMetni(xml))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan <content> tekrarları doğrusal', () => {
    expect(sure(() => udfMetni('<content><![CDATA['.repeat(20_000)))).toBeLessThan(ESIK_MS);
  });

  it('düzgün UDF değişmedi: bölünmüş CDATA birleşir, boşluk atlanır', () => {
    expect(udfMetni('<t><content>\n <![CDATA[ab]]> <![CDATA[cd]]>\n</content></t>')).toBe('abcd');
    expect(udfMetni('<content><![CDATA[a]]]]><![CDATA[> b]]></content>')).toBe('a]]> b');
  });
});

describe('docxMetni — doğrusal', () => {
  it('kapanmayan <w:del …> tekrarları (eski: kuadratik)', () => {
    expect(sure(() => docxMetni('<w:del w:id="1">'.repeat(12_000)))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan <w:t> tekrarları (eski: kuadratik)', () => {
    expect(sure(() => docxMetni('<w:t>'.repeat(40_000)))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan <w:pPr> tekrarları (eski: kuadratik)', () => {
    expect(sure(() => docxMetni('<w:pPr><w:del w:id="1"/>'.repeat(12_000)))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan <w:moveFrom> tekrarları (eski: kuadratik)', () => {
    expect(sure(() => docxMetni('<w:moveFrom>'.repeat(14_000)))).toBeLessThan(ESIK_MS);
  });

  it('kapanmayan etiket ("<w:t" ve ">" yok) doğrusal', () => {
    expect(sure(() => docxMetni('<w:t '.repeat(40_000)))).toBeLessThan(ESIK_MS);
  });

  it('20 MB gerçekçi Word XML’i hâlâ hızlı (eski ölçüm: 244 ms)', () => {
    const p = '<w:p w:rsidR="00A11234"><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Davalı taraf sözleşmenin 5. maddesi uyarınca</w:t></w:r></w:p>';
    const xml = '<w:body>' + p.repeat(Math.ceil(20_000_000 / p.length)) + '</w:body>';
    let metin = '';
    expect(sure(() => { metin = docxMetni(xml); })).toBeLessThan(5000);
    expect(metin.startsWith('Davalı taraf sözleşmenin 5. maddesi uyarınca\nDavalı')).toBe(true);
  });
});
