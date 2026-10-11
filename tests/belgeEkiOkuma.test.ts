import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { docxMetni, duzMetinOku, metinCoz, rtfMetni } from '../supabase/functions/_shared/belgeMetni';
import * as sunucu from '../supabase/functions/_shared/belgeEki';
import * as istemci from '@/lib/belgeEkiKurallari';
import { metinDosyasiCoz } from '@/utils/metinKodlama';
import { aiHataMetni } from '@/lib/aiHata';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * BELGE EKİ OKUMA — 08.10.2026 denetiminin altı bulgusu (09.10.2026).
 *
 * Ortak tema: avukat yapay zekâya bir belge veriyor ve belgenin NE KADARININ,
 * NASIL okunduğunu bilmiyordu. Her blok bir bulgunun kanıtı; önce düştüğü
 * görüldü, sonra düzeltildi.
 */

// "%PDF-1.7" ile başlayan base64 (belgeEki.test.ts'teki sabit).
const PDF = 'JVBERi0xLjcKJcfsj6IK';

// ─────────────────────────────────────────────────────────────────────────
// GERÇEK .docx ÖRNEĞİ. Aşağıdaki XML, Word'ün izlenen değişiklik biçimiyle
// (ECMA-376 w:del/w:ins/w:moveFrom) yazıldı ve Python zipfile ile geçerli bir
// .docx paketine konuldu ([Content_Types].xml + _rels/.rels +
// word/document.xml, 1.578 bayt). Test önce paketin içinin bu XML olduğunu
// doğrular — sabit elle değiştirilirse düşer.
// ─────────────────────────────────────────────────────────────────────────
const DOCX_XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
  // 1) başlık
  '<w:p><w:r><w:t>ANKARA 5. ASLİYE HUKUK MAHKEMESİ</w:t></w:r></w:p>',
  // 2) izlenen değişiklik: "10.000 TL" SİLİNDİ, "20.000 TL" EKLENDİ
  '<w:p><w:r><w:t xml:space="preserve">Kira bedeli aylık </w:t></w:r>',
  '<w:del w:id="1" w:author="Av. Deneme" w:date="2026-10-01T10:00:00Z"><w:r w:rsidDel="00B21A"><w:delText>10.000 TL</w:delText></w:r></w:del>',
  '<w:ins w:id="2" w:author="Av. Deneme" w:date="2026-10-01T10:01:00Z"><w:r><w:t>20.000 TL</w:t></w:r></w:ins>',
  '<w:r><w:t xml:space="preserve"> olarak belirlenmiştir.</w:t></w:r></w:p>',
  // 3) kelime run sınırında bölünmüş (yazım denetimi işareti + kalın), sekme
  //    DURAĞI tanımı (sekme karakteri değil), sekme, satır sonu
  '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="4536"/></w:tabs></w:pPr><w:r><w:t>Mahke</w:t></w:r><w:proofErr w:type="spellStart"/>',
  '<w:r w:rsidR="00C3F2"><w:rPr><w:b/></w:rPr><w:t>mesi</w:t></w:r><w:proofErr w:type="spellEnd"/>',
  '<w:r><w:t xml:space="preserve"> kararı</w:t></w:r><w:r><w:tab/><w:t>12.03.</w:t></w:r><w:r w:rsidR="00D4E5"><w:t>2024</w:t></w:r>',
  '<w:r><w:br/><w:t>İkinci satır: ığüşöç ĞÜŞÖÇ</w:t></w:r></w:p>',
  // 4) paragraf İŞARETİ silinmiş (kendinden kapanan w:del) → sonraki
  //    paragrafla birleşir; XML kaçışları (onaltılık dahil)
  '<w:p><w:pPr><w:rPr><w:del w:id="3" w:author="Av. Deneme" w:date="2026-10-01T10:02:00Z"/></w:rPr></w:pPr>',
  '<w:r><w:t xml:space="preserve">Davac&#x131; vekili: Av. A &amp; B </w:t></w:r><w:r><w:t>&quot;Hukuk&quot; Bürosu</w:t></w:r></w:p>',
  // 5) taşınan metin: eski yeri (moveFrom) metne girmez, yeni yeri girer
  '<w:moveFromRangeStart w:id="4" w:author="Av. Deneme" w:date="2026-10-01T10:03:00Z" w:name="move1"/>',
  '<w:p><w:moveFrom w:id="5" w:author="Av. Deneme" w:date="2026-10-01T10:03:00Z"><w:r><w:t>Taşınan cümle eski yerinde.</w:t></w:r></w:moveFrom></w:p>',
  '<w:moveFromRangeEnd w:id="4"/>',
  '<w:moveToRangeStart w:id="6" w:author="Av. Deneme" w:date="2026-10-01T10:03:00Z" w:name="move1"/>',
  '<w:p><w:moveTo w:id="7" w:author="Av. Deneme" w:date="2026-10-01T10:03:00Z"><w:r><w:t>Taşınan cümle yeni yerinde.</w:t></w:r></w:moveTo></w:p>',
  '<w:moveToRangeEnd w:id="6"/>',
  // 6) alan: kodu (PAGE) metne girmez, sonucu (1) girer
  '<w:p><w:r><w:t xml:space="preserve">Sayfa </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r>',
  '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>',
  '<w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
  // 7) tablo
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Esas No</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2024/123</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
  // 8) boş ve kendinden kapanan w:t
  '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r><w:r><w:t/></w:r></w:p>',
  '<w:sectPr/></w:body></w:document>',
].join('');

const DOCX_B64 =
  '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';

/** ZIP'in yerel dosya başlıklarını sırayla okur (doc-extract'te bu işi JSZip yapıyor). */
function zipAc(b64: string): Record<string, string> {
  const b = Buffer.from(b64, 'base64');
  const dosyalar: Record<string, string> = {};
  let i = 0;
  while (b.readUInt32LE(i) === 0x04034b50) {
    const yontem = b.readUInt16LE(i + 8);
    const sikisik = b.readUInt32LE(i + 18);
    const adUz = b.readUInt16LE(i + 26);
    const ekUz = b.readUInt16LE(i + 28);
    const ad = b.toString('utf8', i + 30, i + 30 + adUz);
    const bas = i + 30 + adUz + ekUz;
    const veri = b.subarray(bas, bas + sikisik);
    dosyalar[ad] = (yontem === 8 ? inflateRawSync(veri) : veri).toString('utf8');
    i = bas + sikisik;
  }
  return dosyalar;
}

describe('BULGU 3 — DOCX: izlenen değişiklikler ve run sınırları', () => {
  const paket = zipAc(DOCX_B64);
  const metin = docxMetni(paket['word/document.xml'] ?? '');

  it('örnek gerçek bir .docx paketi ve içi yukarıdaki XML', () => {
    expect(Object.keys(paket)).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
    expect(paket['word/document.xml']).toBe(DOCX_XML);
  });

  it('SİLİNEN metin (w:del/w:delText) ve taşınan metnin eski yeri metne girmez', () => {
    // Eski çıkarıcı "Kira bedeli aylık 10.000 TL 20.000 TL" veriyordu: model
    // iki tutarı da belgede yazıyor sanır.
    expect(metin).not.toContain('10.000 TL');
    expect(metin).toContain('Kira bedeli aylık 20.000 TL olarak belirlenmiştir.');
    expect(metin).not.toContain('eski yerinde');
    expect(metin).toContain('Taşınan cümle yeni yerinde.');
  });

  it('run sınırında kelimenin ve tarihin ORTASINA boşluk girmez', () => {
    // Eski çıkarıcı her etiketi boşluğa çeviriyordu: "Mahke mesi", "12.03. 2024".
    expect(metin).toContain('Mahkemesi kararı');
    expect(metin).toContain('12.03.2024');
  });

  it('alan KODU metne girmez, alan SONUCU girer', () => {
    expect(metin).not.toContain('PAGE');
    expect(metin).toContain('Sayfa 1');
  });

  it('tam çıktı: sekme ve satır sonu korunur, sekme durağı sekme sayılmaz, silinen paragraf işareti birleşir', () => {
    expect(metin).toBe(
      'ANKARA 5. ASLİYE HUKUK MAHKEMESİ\n' +
        'Kira bedeli aylık 20.000 TL olarak belirlenmiştir.\n' +
        'Mahkemesi kararı\t12.03.2024\n' +
        'İkinci satır: ığüşöç ĞÜŞÖÇ\n' +
        'Davacı vekili: Av. A & B "Hukuk" Bürosu\n' +
        'Taşınan cümle yeni yerinde.\n' +
        'Sayfa 1\n' +
        'Esas No\n' +
        '2024/123',
    );
  });

  it('silinen SEKME de metne girmez; silinmiş boş tablo satırı sonraki metni yutmaz', () => {
    // Word silinen sekmeyi <w:del><w:r><w:tab/></w:r></w:del> yazar. Boş bir
    // tablo satırı silinince satır özelliğinde kendinden kapanan <w:del/>
    // kalır; açılış etiketi sanılsa sonraki </w:del>'e kadar her şey giderdi.
    const xml =
      '<w:body><w:p><w:r><w:t>A</w:t></w:r><w:del w:id="1" w:author="X" w:date="2026-10-01T10:00:00Z"><w:r><w:tab/><w:delText>B</w:delText></w:r></w:del><w:r><w:t>C</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:trPr><w:del w:id="2" w:author="X" w:date="2026-10-01T10:00:00Z"/></w:trPr><w:tc><w:p/></w:tc></w:tr></w:tbl>' +
      '<w:p><w:r><w:t>Kalan paragraf</w:t></w:r></w:p>' +
      '<w:p><w:del w:id="3" w:author="X" w:date="2026-10-01T10:00:00Z"><w:r><w:delText>silinen</w:delText></w:r></w:del><w:r><w:t>son</w:t></w:r></w:p></w:body>';
    expect(docxMetni(xml)).toBe('AC\nKalan paragraf\nson');
  });

  it('boş girdide çökmez', () => {
    expect(docxMetni('')).toBe('');
    expect(docxMetni(undefined as unknown as string)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// RTF ÖRNEKLERİ — iki gerçek üreticinin biçimi:
//  • WordPad (Türkçe Windows): \ansicpg1254, Türkçe harfler \'xx kaçışıyla.
//  • Word: \uN + yedek karakter (\uc1), \* hedefleri, bilgi/stil tabloları,
//    tema verisi, alan, resim; kaçışlı süslü parantez ve ters bölü.
// ─────────────────────────────────────────────────────────────────────────
const RTF_WORDPAD =
  '{\\rtf1\\ansi\\ansicpg1254\\deff0\\nouicompat\\deflang1055{\\fonttbl{\\f0\\fnil\\fcharset162 Calibri;}}\r\n' +
  '{\\colortbl ;\\red255\\green0\\blue0;}\r\n' +
  '{\\*\\generator Riched20 10.0.19041}\\viewkind4\\uc1 \r\n' +
  "\\pard\\sa200\\sl276\\slmult1\\f0\\fs22\\lang31 ANKARA 5. ASL\\'ddYE HUKUK MAHKEMES\\'dd\\par\r\n" +
  "Davac\\'fd: \\'d6rnek \\'deirket A.\\'de.\\par\r\n" +
  "\\cf1 Kira bedeli 20.000 TL olarak belirlenmi\\'fetir.\\cf0\\par\r\n" +
  '}\r\n';

const RTF_WORD =
  '{\\rtf1\\adeflang1025\\ansi\\ansicpg1252\\uc1\\adeff31507\\deff0' +
  '{\\fonttbl{\\f0\\fbidi \\froman\\fcharset0\\fprq2{\\*\\panose 02020603050405020304}Times New Roman;}{\\f1\\froman\\fcharset162\\fprq2 Times New Roman Tur;}}\r\n' +
  '{\\colortbl;\\red0\\green0\\blue0;}\r\n' +
  '{\\stylesheet{\\ql \\li0\\ri0\\widctlpar\\fs24\\lang1055 \\snext0 \\sqformat \\spriority0 Normal;}}\r\n' +
  '{\\info{\\author Av. Deneme}{\\operator Av. Deneme}{\\creatim\\yr2026\\mo10\\dy1\\hr10\\min0}}\r\n' +
  '{\\*\\xmlnstbl {\\xmlns1 http://schemas.microsoft.com/office/word/2003/wordml}}\r\n' +
  '\\paperw11906\\paperh16838\\margl1417\\margr1417\r\n' +
  "\\pard\\plain \\ltrpar\\ql \\fs24\\lang1055 {\\f1\\insrsid1 DAVACI\\tab : Ay\\u351\\'fee Y\\u305\\'fdlmaz\\par }\r\n" +
  '{\\f1\\insrsid1 Talep: \\ldblquote 50.000 TL\\rdblquote  tazminat\\line \\{ek-1\\} ve C:\\\\belgeler\\par }\r\n' +
  "{\\f1\\insrsid1 Tan\\'fdk\\par }\r\n" +
  '{\\*\\themedata 504b030414000600080000002100e9de0fbfff0000001c020000130000005b436f6e74656e745f54797065735d2e78}\r\n' +
  '{\\field{\\*\\fldinst {\\insrsid1  PAGE }}{\\fldrslt {\\insrsid1 2}}}\\par\r\n' +
  '{\\pict\\wmetafile8\\picw100\\pich100 0100090000035000000000002700000000000400}\r\n' +
  '}';

describe('BULGU 4a — RTF', () => {
  it('WordPad: Türkçe harfler doğru; yazı tipi/renk tablosu ve süslü parantez metne girmez', () => {
    // Eski yol: "{ { { Calibri;}} { ; ;} … ASL\'ddYE HUKUK MAHKEMES\'dd …"
    expect(rtfMetni(RTF_WORDPAD)).toBe(
      'ANKARA 5. ASLİYE HUKUK MAHKEMESİ\nDavacı: Örnek Şirket A.Ş.\nKira bedeli 20.000 TL olarak belirlenmiştir.',
    );
  });

  it('Word: \\u kaçışı + yedek karakter, hedef grupları, kaçışlı karakterler, alan sonucu', () => {
    expect(rtfMetni(RTF_WORD)).toBe(
      'DAVACI\t: Ayşe Yılmaz\nTalep: “50.000 TL” tazminat\n{ek-1} ve C:\\belgeler\nTanık\n2',
    );
  });

  it('uçtaki yol: .rtf baytları RTF olarak çevrilir', () => {
    expect(duzMetinOku('dilekce.rtf', new TextEncoder().encode(RTF_WORDPAD))).toEqual({
      metin: 'ANKARA 5. ASLİYE HUKUK MAHKEMESİ\nDavacı: Örnek Şirket A.Ş.\nKira bedeli 20.000 TL olarak belirlenmiştir.',
    });
  });

  it('boş girdide çökmez', () => {
    expect(rtfMetni('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// DÜZ METİN — kodlama ve ikili dosya.
// ─────────────────────────────────────────────────────────────────────────
const METIN = 'Davacı: Örnek Şirket A.Ş. — İstanbul 3. İş Mahkemesi\nğüşıöç ĞÜŞİÖÇ';
const CP1254: Record<string, number> = {
  ı: 0xfd, İ: 0xdd, ş: 0xfe, Ş: 0xde, ğ: 0xf0, Ğ: 0xd0, ü: 0xfc, Ü: 0xdc, ö: 0xf6, Ö: 0xd6, ç: 0xe7, Ç: 0xc7, '—': 0x97,
};
const cp1254 = (s: string) => Uint8Array.from([...s].map((h) => CP1254[h] ?? h.charCodeAt(0)));
const utf16le = (s: string) => new Uint8Array(Buffer.from('\ufeff' + s, 'utf16le'));
const utf16be = (s: string) => {
  const le = utf16le(s);
  const be = new Uint8Array(le.length);
  for (let i = 0; i + 1 < le.length; i += 2) {
    be[i] = le[i + 1]!;
    be[i + 1] = le[i]!;
  }
  return be;
};
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x21, 0x00]);

describe('BULGU 4b — düz metin: Windows-1254 ve ikili dosya', () => {
  it('Windows-1254 .txt doğru okunur (uç ve istemci)', () => {
    // Eski yol UTF-8 sanıyordu: "Davac�: �irket".
    expect(duzMetinOku('dilekce.txt', cp1254(METIN))).toEqual({ metin: METIN });
    expect(metinDosyasiCoz(cp1254(METIN))).toBe(METIN);
  });

  it('UTF-8 (BOM\'lu ve BOM\'suz) ve UTF-16 (BOM\'lu) okunur', () => {
    const utf8 = new TextEncoder().encode(METIN);
    const bomlu = new TextEncoder().encode('\ufeff' + METIN);
    for (const b of [utf8, bomlu, utf16le(METIN), utf16be(METIN)]) {
      expect(metinCoz(b)).toBe(METIN);
      expect(metinDosyasiCoz(b)).toBe(METIN);
    }
  });

  it('ikili dosya (JPEG, PNG, ZIP) metin diye okunmaz — uzantısı .txt olsa bile', () => {
    // Eski yol PNG'yi "�PNG\r\n\u001a\n\rIHDR" diye yapay zekâya gönderiyordu.
    for (const [ad, b] of [['foto.jpg', JPEG], ['ekran.png', PNG], ['tablo.xlsx', ZIP], ['yeniden-adlandirilmis.txt', PNG]] as const) {
      expect(duzMetinOku(ad, b)).toEqual({ hata: 'unsupported' });
      expect(metinCoz(b)).toBeNull();
      expect(metinDosyasiCoz(b)).toBeNull();
    }
  });

  it('uzantısız ya da .csv düz metin yine okunur', () => {
    expect(duzMetinOku('notlar', new TextEncoder().encode(METIN))).toEqual({ metin: METIN });
    expect(duzMetinOku('liste.csv', cp1254('Ad;Şehir\nAyşe;İzmir'))).toEqual({ metin: 'Ad;Şehir\nAyşe;İzmir' });
  });

  it('istemci, sunucuda okunacak türleri ve yerelde okunacakları ayırır', () => {
    for (const ad of ['a.pdf', 'b.UDF', 'c.docx', 'd.doc', 'e.rtf']) expect(istemci.sunucudaOkunur(ad)).toBe(true);
    for (const ad of ['a.txt', 'b.csv', 'notlar', 'd.jpg']) expect(istemci.sunucudaOkunur(ad)).toBe(false);
  });

  it('istemci yerel dosyayı UTF-8 sanmıyor: kodlama çözücüsünden geçiriyor', () => {
    const kaynak = readFileSync(new URL('../src/lib/belgeEki.ts', import.meta.url), 'utf8');
    expect(kaynak).toContain('metinDosyasiCoz(');
    expect(kaynak).not.toMatch(/dosyaMetni\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BULGU 1 — metin tavanı SESSİZ kırpıyordu.
// ─────────────────────────────────────────────────────────────────────────
describe('BULGU 1 — metin tavanında kırpılan belge söylenir', () => {
  const T = sunucu.EK_METIN_TAVANI;

  it('tavanı aşan ekin kaç karakterinin okunduğu yanıtta döner', () => {
    const r = sunucu.ekleriAyikla([{ ad: 'sozlesme.docx', metin: 'x'.repeat(T + 55_000) }]);
    expect(r.ekler[0]!.metin.length).toBe(T);
    expect(sunucu.ekUyarisi(r, true)?.kirpilan).toEqual([{ ad: 'sozlesme.docx', okunan: T, toplam: T + 55_000 }]);
  });

  it('ikinci ek kalan bütçeyi alır ve o da söylenir; bütçesi kalmayan okunamayan sayılır', () => {
    const r = sunucu.ekleriAyikla([
      { ad: 'a.udf', metin: 'a'.repeat(T - 10_000) },
      { ad: 'b.docx', metin: 'b'.repeat(30_000) },
      { ad: 'c.txt', metin: 'c'.repeat(100) },
    ]);
    const u = sunucu.ekUyarisi(r, true);
    expect(u?.kirpilan).toEqual([{ ad: 'b.docx', okunan: 10_000, toplam: 30_000 }]);
    expect(u?.okunamayan).toEqual(['c.txt']);
  });

  it('görüntüsüyle okunan PDF kırpılmış sayılmaz — sayfaların tamamını model gördü', () => {
    const r = sunucu.ekleriAyikla([{ ad: 'karar.pdf', metin: 'x'.repeat(T + 10_000), pdf: PDF, sayfa: 18 }]);
    expect(sunucu.ekUyarisi(r, true)).toBeUndefined();
    // Ama görüntü modele ulaşmadıysa (yedek model) yalnız metninin başı okundu.
    expect(sunucu.ekUyarisi(r, false)?.kirpilan).toEqual([{ ad: 'karar.pdf', okunan: T, toplam: T + 10_000 }]);
  });

  it('tavanın altındaki ek kırpılmış sayılmaz', () => {
    expect(sunucu.ekUyarisi(sunucu.ekleriAyikla([{ ad: 'a.udf', metin: 'x'.repeat(T) }]), true)).toBeUndefined();
  });

  it('istemci tavanı sunucununkiyle aynı ve gönderMEDEN aynı kırpmayı bilir', () => {
    expect(istemci.EK_METIN_TAVANI).toBe(T);
    const ekler = [
      { ad: 'a.pdf', metin: 'a'.repeat(30_000), pdf: PDF, sayfa: 15 },
      { ad: 'b.docx', metin: 'b'.repeat(25_000) },
      { ad: 'c.udf', metin: 'c'.repeat(5_000) },
    ];
    expect(istemci.ekMetinPayi(ekler)).toEqual([30_000, T - 30_000, 0]);
    // Bütçesi biten ek "okunacak" diye gösterilmez ve gönderilmez.
    expect(istemci.ekOkumaPlani(ekler)).toEqual(['gorsel', 'metin', 'yok']);
    const r = sunucu.ekleriAyikla(istemci.ekGovdesi(ekler));
    expect(r.ekler.map((e) => e.metin.length)).toEqual(istemci.ekMetinPayi(ekler).slice(0, 2));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BULGU 2 — yedek model PDF görüntüsünü göremez; ekran bunu BELGE BELGE
// söylemeli. Eski uyarı model çağrısından ÖNCE kuruluyordu: tamamen taranmış
// PDF yedek modele hiç ulaşmadığı hâlde "okunamayan" listesine girmiyordu.
// ─────────────────────────────────────────────────────────────────────────
describe('BULGU 2 — yedek modele düşüşte PDF görüntüsü', () => {
  const s = sunucu.ekleriAyikla([
    { ad: 'tebligat.pdf', metin: '', pdf: PDF, sayfa: 2, taranmis: 2 },
    { ad: 'dava.pdf', metin: 'DAVA DİLEKÇESİ', pdf: PDF, sayfa: 3, taranmis: 1 },
  ]);

  it('Claude PDF\'i gördüyse: taranmış sayfa uyarısı, okunamayan yok', () => {
    expect(sunucu.ekUyarisi(s, true)).toEqual({ pdfdenMetne: [], okunamayan: [], taranmis: true, kirpilan: [] });
  });

  it('yedek model yazdıysa: taranmış PDF OKUNAMADI, metinli PDF yalnız metniyle okundu', () => {
    expect(sunucu.ekUyarisi(s, false)).toEqual({ pdfdenMetne: ['dava.pdf'], okunamayan: ['tebligat.pdf'], kirpilan: [] });
  });

  it('PDF ve kırpma yoksa uyarı yok', () => {
    expect(sunucu.ekUyarisi(sunucu.ekleriAyikla([{ ad: 'a.udf', metin: 'kısa' }]), false)).toBeUndefined();
    expect(sunucu.ekUyarisi(sunucu.ekleriAyikla(undefined), true)).toBeUndefined();
  });

  it('ai-chat uyarıyı model çağrısından SONRA, PDF\'in görülüp görülmediğine göre kurar', () => {
    const kaynak = readFileSync(new URL('../supabase/functions/ai-chat/index.ts', import.meta.url), 'utf8');
    expect(kaynak.match(/ekUyari: ekUyarisi\(ekSonuc, provider === 'claude' && faturali\)/g)?.length).toBe(2);
    expect(kaynak).not.toMatch(/const ekUyari = /);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BULGU 5 — hata eşlemesi ve toplam boyut.
// ─────────────────────────────────────────────────────────────────────────
describe('BULGU 5 — ek okuma hataları ve toplam boyut', () => {
  it.each([
    ['empty', 'bos'],
    ['unsupported', 'desteklenmiyor'],
    ['unauthorized', 'oturum'],
    ['too_large', 'buyuk'],
    ['doc_legacy', 'eskiDoc'],
    ['parse_failed', 'okunamadi'],
    ['bad_base64', 'okunamadi'],
    ['', 'okunamadi'],
  ])('doc-extract "%s" → %s', (kod, beklenen) => {
    expect(istemci.ekHatasi(kod)).toBe(beklenen);
  });

  it('her ek hatasının Türkçe ve İngilizce metni var', () => {
    const sozluk = (d: Record<string, string>, h: string) => d[`ek.hata.${h}`];
    for (const h of istemci.EK_HATALARI) {
      expect(sozluk(tr, h), `tr ek.hata.${h}`).toBeTruthy();
      expect(sozluk(en, h), `en ek.hata.${h}`).toBeTruthy();
    }
  });

  // n baytlık bir PDF'in base64'ü (imzası geçerli).
  const pdfBayt = (n: number) => 'JVBER' + 'A'.repeat(Math.ceil((n * 4) / 3) - 5);
  const MB = 1024 * 1024;

  it('görüntüsüyle gidecek PDF\'lerin toplamı tavanı aşarsa istemci GÖNDERMEDEN bilir; sunucu aynı gövdeyi reddeder', () => {
    const ekler = [
      { ad: 'a.pdf', metin: 'a', pdf: pdfBayt(5 * MB), sayfa: 5 },
      { ad: 'b.pdf', metin: 'b', pdf: pdfBayt(4 * MB), sayfa: 5 },
    ];
    expect(istemci.ekBoyutuAsiyor(ekler)).toBe(true);
    expect(sunucu.ekleriAyikla(istemci.ekGovdesi(ekler)).hata).toBe('ek_buyuk');
    expect(istemci.ekBoyutuAsiyor([ekler[0]!])).toBe(false);
    expect(sunucu.ekleriAyikla(istemci.ekGovdesi([ekler[0]!])).hata).toBeUndefined();
  });

  it('metne düşen PDF\'in baytı gönderilmez, toplamı da şişirmez', () => {
    const ekler = [
      { ad: 'a.pdf', metin: 'a', pdf: pdfBayt(5 * MB), sayfa: 15 },
      { ad: 'b.pdf', metin: 'b', pdf: pdfBayt(5 * MB), sayfa: 10 },
    ];
    expect(istemci.ekBoyutuAsiyor(ekler)).toBe(false);
    expect(sunucu.ekleriAyikla(istemci.ekGovdesi(ekler)).hata).toBeUndefined();
  });

  it('ekran uyarı metinleri iki dilde var', () => {
    for (const k of ['ek.kirpilacak', 'ek.kirpildi', 'ek.sinirDoldu', 'ek.toplamBuyuk', 'ai.errSoruUzun'] as const) {
      expect((tr as Record<string, string>)[k], `tr ${k}`).toBeTruthy();
      expect((en as Record<string, string>)[k], `en ${k}`).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BULGU 6 — sunucuda soru uzunluğu tavanı yoktu.
// ─────────────────────────────────────────────────────────────────────────
describe('BULGU 6 — soru uzunluğu tavanı', () => {
  const kaynak = readFileSync(new URL('../supabase/functions/ai-chat/index.ts', import.meta.url), 'utf8');

  it('ai-chat uzun soruyu hak/kota rezervasyonundan ÖNCE reddeder', () => {
    const bekci = kaynak.indexOf('promptQuestion.length > SORU_TAVANI');
    expect(bekci).toBeGreaterThan(0);
    expect(bekci).toBeLessThan(kaynak.indexOf('deneme_hakki_rezerve_et'));
    expect(bekci).toBeLessThan(kaynak.indexOf('kotaRezerve(cfg'));
    expect(kaynak.slice(bekci, bekci + 200)).toContain("'soru_uzun'");
  });

  it('belge inceleme kutusunun tavanı sunucu tavanının altında (meşru istek reddedilmez)', () => {
    const ekran = readFileSync(new URL('../app/document-review.tsx', import.meta.url), 'utf8');
    const tavan = Number(ekran.match(/const MAX_CHARS = (\d+)/)?.[1]);
    expect(tavan).toBeGreaterThan(0);
    expect(tavan).toBeLessThanOrEqual(sunucu.SORU_TAVANI);
  });

  it('istemci soru_uzun kodunu kendi mesajına çevirir (internet suçlanmaz)', () => {
    const t = ((k: string) => k) as unknown as Parameters<typeof aiHataMetni>[1];
    expect(aiHataMetni({ error: 'soru_uzun' }, t)).toBe('ai.errSoruUzun');
  });

  // Belge inceleme kutusu 12.000'de kesiyordu; yalnız "fazlası kırpıldı"
  // diyordu — 40.000 karakterlik sözleşme yapıştıran avukat ne kadarının
  // gittiğini bilmiyordu. Sayı artık söyleniyor (kırpılan karakter).
  it('kutu tavanı aşan metni keser ve KAÇ karakterin gittiğini sayar', () => {
    const uzun = 'a'.repeat(30_000);
    const s = istemci.metniSinirla(uzun, 12_000);
    expect(s.metin.length).toBe(12_000);
    expect(s.kirpilan).toBe(18_000);
    expect(istemci.metniSinirla('kısa metin', 12_000)).toEqual({ metin: 'kısa metin', kirpilan: 0 });
    expect(istemci.metniSinirla('a'.repeat(12_000), 12_000).kirpilan).toBe(0);
  });

  it('belge inceleme ekranı kırpılan sayıyı gösterir; iki dilde metin var', () => {
    const ekran = readFileSync(new URL('../app/document-review.tsx', import.meta.url), 'utf8');
    expect(ekran).toContain('metniSinirla(');
    expect(ekran).toContain("t('docrev.kirpildi'");
    expect(tr['docrev.kirpildi']).toContain('{n}');
    expect(en['docrev.kirpildi']).toContain('{n}');
  });

  it('mesajdaki sayı sunucu tavanıyla aynı', () => {
    expect(tr['ai.errSoruUzun']).toContain(sunucu.SORU_TAVANI.toLocaleString('tr-TR'));
    expect(en['ai.errSoruUzun']).toContain(sunucu.SORU_TAVANI.toLocaleString('en-US'));
  });
});
