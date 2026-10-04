import { describe, expect, it } from 'vitest';
import { stripXml, udfMetni } from '../supabase/functions/_shared/belgeMetni';
import { udfIcerikXml } from '@/lib/udf';

/**
 * Bu işlev yanlış çalıştığında ekran "Dosya boş görünüyor" diyor ve avukat
 * kendi dosyasında bir sorun olduğunu sanıyor — oysa hata bizde.
 *
 * ÖLÇÜLEN ARIZA: UYAP UDF dosyalarında metin CDATA bloğunun içinde durur.
 * Etiket temizleyicisi CDATA'yı da bir etiket sanıp komple siliyordu; geriye
 * hiçbir şey kalmıyor, uç 422 "empty" dönüyordu. Ekranın açıkça vaat ettiği
 * UDF desteği çalışmıyordu ve bunu yalnız gerçek bir UDF yükleyen avukat fark
 * ederdi.
 */
describe('stripXml', () => {
  it('UDF içeriğini CDATA bloğundan çıkarır', () => {
    const udf =
      '<?xml version="1.0" encoding="UTF-8"?><template><content><![CDATA[ANKARA 5. ASLİYE HUKUK MAHKEMESİ\nNETİCE-İ TALEP: Davanın kabulü.]]></content></template>';
    const metin = stripXml(udf);
    expect(metin).toContain('ANKARA 5. ASLİYE HUKUK MAHKEMESİ');
    expect(metin).toContain('NETİCE-İ TALEP');
    expect(metin).not.toContain('CDATA');
  });

  it('CDATA içinde ">" geçse bile metni kaybetmez', () => {
    // Eski desen `<[^>]+>` idi: CDATA'nın içindeki ">" karakteri eşleşmeyi
    // erken bitirir ve metnin bir kısmı etiket sanılıp silinirdi.
    expect(stripXml('<c><![CDATA[a > b olduğundan tahliye istenmiştir]]></c>'))
      .toContain('a > b olduğundan tahliye istenmiştir');
  });

  it('DOCX paragraf sonlarını korur', () => {
    const docx = '<w:body><w:p><w:r><w:t>Birinci satır</w:t></w:r></w:p><w:p><w:r><w:t>İkinci satır</w:t></w:r></w:p></w:body>';
    expect(stripXml(docx).split('\n').map((x) => x.trim()).filter(Boolean)).toEqual(['Birinci satır', 'İkinci satır']);
  });

  it('XML kaçışlarını çözer', () => {
    expect(stripXml('<t>Ali &amp; Veli &quot;vekil&quot;</t>')).toBe('Ali & Veli "vekil"');
  });

  it('boş girdide çökmez', () => {
    expect(stripXml('')).toBe('');
    expect(stripXml(undefined as unknown as string)).toBe('');
  });
});

describe('udfMetni', () => {
  it('belgenin kendi "<…>" ifadesini silmez', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8" ?><template format_id="1.8"><content><![CDATA[Ek <ek-1> ve a < b ama c > d\n]]></content><elements resolver="hvl-default"><paragraph><content startOffset="0" length="10" /></paragraph></elements></template>';
    expect(udfMetni(xml)).toBe('Ek <ek-1> ve a < b ama c > d');
  });

  it('resim ve boş paragraf yer tutucularını atar', () => {
    const xml = '<template><content><![CDATA[Başlık\n\uFFFC\n\u200B\nGövde]]></content></template>';
    expect(udfMetni(xml)).toBe('Başlık\n\nGövde');
  });

  it('bölünmüş CDATA parçalarını birleştirir', () => {
    // "]]>" içeren metni kendi üreticimiz böyle yazar.
    const xml = udfIcerikXml('a ]]> b');
    expect(udfMetni(xml)).toBe('a ]]> b');
  });

  it('kendi ürettiğimiz UDF\'yi turlar', () => {
    const metin = 'MAHKEMESİNE\n\nDAVACI : Ayşe & Ali "Yılmaz"\nNETİCE-İ TALEP';
    expect(udfMetni(udfIcerikXml(metin))).toBe(metin);
  });

  it('CDATA yoksa kaba okumaya düşer', () => {
    expect(udfMetni('<template><content>düz metin</content></template>')).toBe('düz metin');
  });
});
