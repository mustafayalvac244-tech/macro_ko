import { describe, expect, it } from 'vitest';
import { udfDosyaAdi, udfIcerikXml, udfUret } from '../src/lib/udf';
import { stripXml } from '../supabase/functions/_shared/belgeMetni';

/**
 * UDF ÜRETİCİ — offset aritmetiği bu dosyanın tek gerçek riski.
 *
 * <elements> içindeki startOffset/length değerleri CDATA metnindeki karakter
 * konumlarıdır ve metni BOŞLUKSUZ, ÇAKIŞMASIZ örtmek zorundadır. Bir karakter
 * kayarsa UYAP Editör belgeyi eksik açar ya da hiç açmaz — ve bunu ancak
 * gerçek bir avukat, gerçek bir dosyada fark eder. O yüzden burada sayıyla
 * sınanıyor.
 *
 * NE SINANMIYOR, AÇIKÇA: UYAP Editör'ün bu dosyayı kabul ettiği. Test,
 * yapının kendi içinde tutarlı olduğunu ve kendi okuyucumuzun geri
 * okuyabildiğini gösterir; gerçek editörde açılması ÖLÇÜLMEDİ.
 */

/** content.xml'den (startOffset, length) çiftlerini sırayla çıkarır. */
function ofsetler(xml: string): Array<{ bas: number; boy: number }> {
  const bulunan: Array<{ bas: number; boy: number }> = [];
  const desen = /startOffset="(\d+)" length="(\d+)"/g;
  let e: RegExpExecArray | null;
  while ((e = desen.exec(xml)) !== null) bulunan.push({ bas: Number(e[1]), boy: Number(e[2]) });
  return bulunan;
}

/** CDATA bloğunun içindeki ham metni verir. */
function cdataMetni(xml: string): string {
  const bas = xml.indexOf('<![CDATA[') + '<![CDATA['.length;
  const son = xml.lastIndexOf(']]></content>');
  return xml.slice(bas, son);
}

const DILEKCE = [
  'ANKARA 5. ASLİYE HUKUK MAHKEMESİ’NE',
  '',
  'DAVACI    : Ahmet Yılmaz',
  'VEKİLİ    : Av. [Ad Soyad]',
  'DAVALI    : Mehmet Demir',
  '',
  'KONU      : Alacak istemimizden ibarettir.',
  '',
  'AÇIKLAMALAR',
  'Müvekkil ile davalı arasında sözleşme imzalanmıştır. Davalı edimini yerine',
  'getirmemiştir.',
  '',
  'NETİCE-İ TALEP',
  'Davanın kabulüne karar verilmesini saygıyla talep ederiz.',
].join('\n');

describe('udfIcerikXml — offset aritmetiği', () => {
  it('paragraf offsetleri metni boşluksuz ve çakışmasız örter', () => {
    const xml = udfIcerikXml(DILEKCE);
    const metin = cdataMetni(xml);
    const parcalar = ofsetler(xml);

    expect(parcalar.length).toBeGreaterThan(0);
    let beklenen = 0;
    for (const p of parcalar) {
      // Her paragraf, bir öncekinin bittiği yerden başlamalı.
      expect(p.bas).toBe(beklenen);
      beklenen += p.boy;
    }
    // Toplam, CDATA metninin TAM uzunluğu olmalı — bir karakter bile sapmamalı.
    expect(beklenen).toBe(metin.length);
  });

  it('boş satırlar da paragraf olarak sayılır (bölüm boşlukları korunur)', () => {
    const xml = udfIcerikXml('A\n\nB');
    // Üç satır: "A", "", "B" → üç paragraf.
    expect(ofsetler(xml)).toHaveLength(3);
    // Boş satır bile en az 1 karakterdir (satır sonu).
    expect(ofsetler(xml)[1].boy).toBe(1);
  });

  it('Windows satır sonu (\\r\\n) offsetleri kaydırmaz', () => {
    const crlf = udfIcerikXml('Birinci satır\r\nİkinci satır');
    const lf = udfIcerikXml('Birinci satır\nİkinci satır');
    // Normalizasyon olmasaydı "\r" fazladan bir karakter sayılır ve her
    // paragraf bir kayardı.
    expect(ofsetler(crlf)).toEqual(ofsetler(lf));
    expect(cdataMetni(crlf)).not.toContain('\r');
  });

  it('metinde "]]>" geçse bile CDATA erken kapanmaz ve uzunluk değişmez', () => {
    // "]]>" ham hâliyle yazılsa CDATA orada biter ve dosyanın kalanı bozulur.
    const xml = udfIcerikXml('a ]]> b');
    expect(xml).toContain(']]]]><![CDATA[>');
    // Kaçış, KARAKTER SAYISINI değiştirmemeli; yoksa offsetler tutmaz.
    const toplam = ofsetler(xml).reduce((t, p) => t + p.boy, 0);
    expect(toplam).toBe('a ]]> b\n'.length);
  });
});

describe('udfIcerikXml — yapı', () => {
  it('UYAP yapısının zorunlu parçalarını taşır', () => {
    const xml = udfIcerikXml(DILEKCE);
    expect(xml).toContain('<template format_id="1.7">');
    expect(xml).toContain('<pageFormat');
    expect(xml).toContain('<elements resolver="hvl-default">');
    expect(xml).toContain('<styles>');
    expect(xml).toContain('Times New Roman');
  });

  it('BÜYÜK HARFLİ kısa satırı ortalar, gövdeyi iki yana yaslar', () => {
    const xml = udfIcerikXml('NETİCE-İ TALEP\nDavanın kabulüne karar verilmesini talep ederiz.');
    const hizalar = [...xml.matchAll(/<paragraph Alignment="(\d)"/g)].map((m) => m[1]);
    expect(hizalar[0]).toBe('1'); // ortalı
    expect(hizalar[1]).toBe('3'); // iki yana yaslı
  });

  it('Türkçe büyük harf kuralını doğru uygular ("İ" ve "ı")', () => {
    // "İDDİA" büyük harflidir; JS'in varsayılan toUpperCase'i "i"yi "I" yapar
    // ve Türkçe metinlerde yanlış karar verilirdi.
    const xml = udfIcerikXml('İDDİA VE SAVUNMA');
    expect(xml).toContain('<paragraph Alignment="1"');
  });
});

describe('udfUret — ZIP', () => {
  const udf = udfUret(DILEKCE);

  it('geçerli bir ZIP imzasıyla başlar ve EOCD ile biter', () => {
    expect(Array.from(udf.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const son = udf.slice(udf.length - 22, udf.length - 18);
    expect(Array.from(son)).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it('içinde content.xml adında tek dosya vardır', () => {
    const bayt = new TextDecoder().decode(udf);
    expect(bayt).toContain('content.xml');
    // Merkezi dizin tek kayıt bildirmeli.
    const gorunum = new DataView(udf.buffer, udf.byteOffset, udf.byteLength);
    expect(gorunum.getUint16(udf.length - 22 + 10, true)).toBe(1);
  });

  it('KENDİ UDF OKUYUCUMUZ yazdığımızı geri okuyabiliyor', () => {
    // Tur testi: uygulamanın UDF okuyucusu (doc-extract'ın kullandığı
    // stripXml) CDATA'dan metni çıkarabilmeli. Okuyamıyorsa, ürettiğimiz
    // dosyayı kendi uygulamamız bile açamıyor demektir.
    const xml = udfIcerikXml(DILEKCE);
    const geri = stripXml(xml);
    expect(geri).toContain('ANKARA 5. ASLİYE HUKUK MAHKEMESİ');
    expect(geri).toContain('NETİCE-İ TALEP');
    expect(geri).not.toContain('CDATA');
    expect(geri).not.toContain('startOffset');
  });
});

describe('udfDosyaAdi', () => {
  it('Türkçe harfleri sadeleştirir ve .udf uzantısı verir', () => {
    const ad = udfDosyaAdi('Cevap Dilekçesi — İşçilik Alacağı');
    expect(ad).toMatch(/^Cevap-Dilekcesi-Iscilik-Alacagi-\d{4}-\d{2}-\d{2}\.udf$/);
  });

  it('başlık boşsa yine geçerli bir ad üretir', () => {
    expect(udfDosyaAdi('///')).toMatch(/^dilekce-\d{4}-\d{2}-\d{2}\.udf$/);
  });
});
