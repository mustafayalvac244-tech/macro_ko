import { yerelGunISO } from '@/lib/yerelGun';
// UDF ÜRETİCİ — üretilen dilekçeyi UYAP'ın kendi formatında verir.
// ---------------------------------------------------------------------------
// NEDEN VAR. Uygulama UDF OKUYABİLİYORDU (doc-extract: ZIP içinden content.xml)
// ama YAZAMIYORDU. Sonuç: avukat dilekçeyi burada üretiyor, sonra metni
// kopyalayıp UYAP Editör'e yapıştırıyor ve biçimlendirmeyi elden geçiriyordu.
// Rakip (Lexedes) hazır UDF veriyor; bu, "dilekçeyi biz yazdık" iddiasının
// tamamlanması için gereken son adım. UDF, UYAP'ın dilekçe/evrak için zorunlu
// tuttuğu formattır — .txt bir dilekçe UYAP'a doğrudan girmez.
//
// ── FORMAT NEREDEN DOĞRULANDI ──────────────────────────────────────────────
// UYAP'ın yayımlanmış bir şeması yok. İlk sürüm bir forum örneğinden
// (delphiturkiye.com) alınmıştı: format_id 1.7, tek stil ("default").
//
// 04.10.2026 GÜNCELLEMESİ (avukat: "UDF'de yüklemede sıkıntı var"). Şablon,
// UYAP'a yüklenecek dosya üretmek için yazılmış açık kaynak aracın şablonuyla
// AYNI hâle getirildi: github.com/saidsurucu/UDF-Toolkit > main.py. Üç fark
// vardı ve üçü de giderildi:
//   1. format_id 1.7 → 1.8 (güncel UYAP belgeleri 1.8; udfpdf paketi de
//      UYAP çıktısını "format v1.8" diye tanımlıyor),
//   2. <elements resolver="hvl-default"> bir stile atıf yapıyor ama
//      <styles> içinde "hvl-default" adlı stil YOKTU — yalnız "default" vardı,
//   3. paragraflarda LeftIndent/RightIndent yoktu (o araçta hep var).
// Paragraf sonundaki "\n"i paragrafın içinde saymayı SÜRDÜRÜYORUZ: UYAP
// Editör Java Swing ile yazılmış ve Swing belge modelinde paragraf kendi
// satır sonunu kapsar; udfpdf okuyucusu da gerçek UDF'lerde paragraf
// metninin içinde "\n" bekliyor.
//
// HÂLÂ ÖLÇÜLMEDİ: gerçek UYAP Editör'de açılması. Editörün Linux sürümü
// (5.4.20, uyap.gov.tr) 04.10'da indirildi, deneme koşusu yapılmadı.
// Doğrulama, bir avukatın dosyayı UYAP Editör'de açmasıyla olacak.
//
//     .udf  =  ZIP
//                └── content.xml
//
//     <template format_id="1.8">
//       <content><![CDATA[ bütün metin, tek parça ]]></content>
//       <properties><pageFormat .../></properties>
//       <elements resolver="hvl-default">
//         <paragraph Alignment="0" LeftIndent="0.0" RightIndent="0.0">
//           <content startOffset="0" length="24" family=".." size=".." />
//         </paragraph>
//       </elements>
//       <styles><style name="default" .../><style name="hvl-default" .../></styles>
//     </template>
//
// EN KRİTİK KURAL: <elements> içindeki startOffset/length değerleri CDATA
// metnindeki KARAKTER KONUMLARIDIR ve metni BOŞLUKSUZ, ÇAKIŞMASIZ örtmek
// zorundadır. Bir karakter eksik ya da fazla sayılırsa UYAP Editör belgeyi ya
// eksik açar ya hiç açmaz. Bu yüzden offset'ler tek bir yerde, metnin
// kendisinden türetiliyor ve testte toplamın metin uzunluğuna eşitliği
// kontrol ediliyor (tests/udf.test.ts).
//
// ── NEDEN KÜTÜPHANE YOK ────────────────────────────────────────────────────
// ZIP'i elle yazıyoruz (sıkıştırmasız "stored" yöntem). İki sebep:
//   1. Yeni bir npm paketi JS paketine girer ve bu sorun değil; ama JSZip
//      gibi bir kütüphane yalnız bu iş için ~100 KB ekler. UDF dosyaları
//      birkaç kilobayt; sıkıştırmanın kazancı yok.
//   2. Elle yazılan ZIP'in her baytı testlenebilir. Python'un zipfile'ı ile
//      açılabildiği doğrulandı.
//
// ── SINIRLAR, AÇIKÇA ───────────────────────────────────────────────────────
// • GERÇEK UYAP EDİTÖR'DE HENÜZ AÇILMADI. Yapı doğrulandı ve kendi
//   okuyucumuzla turlandı, ama UYAP Editör'ün kabul ettiği ölçülmedi.
//   İlk gerçek dosyayı bir avukat açana kadar bu "çalışıyor" sayılmamalı.
// • Tablo, resim, imza ve üstbilgi/altbilgi ÜRETİLMİYOR. Dilekçe metni düz
//   paragraflardan oluşuyor; UYAP Editör'de bunlar elle eklenebilir.

/** UDF sayfa düzeni — UYAP'ın varsayılanına yakın (birim: punto). */
const SAYFA = {
  mediaSizeName: 1, // A4
  kenar: 56.7, // ~2 cm
  yon: 1, // dikey
} as const;

/** Yazı tipi — dilekçelerde yerleşik kullanım. */
const YAZI = { aile: 'Times New Roman', boyut: 12 } as const;

/**
 * Paragraf hizası (Java Swing StyledDocument değerleri; UDF bunları kullanıyor).
 * 0 sola, 1 ortaya, 2 sağa, 3 iki yana yaslı.
 */
const HIZA = { sol: 0, orta: 1, sag: 2, iki: 3 } as const;

/** XML metin/öznitelik kaçışı. CDATA dışındaki her yerde şart. */
function xmlKacis(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Bir satırın hizasını seçer.
 *
 * SEZGİSEL VE SINIRLI — bunu saklamıyoruz. Dilekçede mahkeme başlığı ve
 * "NETİCE-İ TALEP" gibi başlıklar ortalı, gövde iki yana yaslı yazılır.
 * Kısa ve BÜYÜK HARFLE yazılmış satırı başlık sayıyoruz. Yanılırsa sonuç
 * bozuk bir belge değil, yalnız farklı hizalanmış bir satırdır ve avukat
 * UYAP Editör'de tek tıkla değiştirir.
 */
function hizaSec(satir: string): number {
  const s = satir.trim();
  if (!s) return HIZA.sol;
  // Türkçe büyük harf kontrolü: toLocaleUpperCase('tr') ile karşılaştırma,
  // "i/İ" ve "ı/I" çiftlerini doğru ele alır.
  const buyukMu = s === s.toLocaleUpperCase('tr') && /\p{L}/u.test(s);
  // "DAVACI    : AHMET YILMAZ", "VEKİLİ : AV. …" de büyük harfli ve kısa;
  // eskiden başlık sayılıp ORTALANIYOR ve KALIN yapılıyordu (08.10.2026,
  // gerçek UYAP Editör'de ölçüldü) — iki noktaları hizalı taraf bloğu bozuluyordu.
  // İki noktadan sonra değer varsa satır başlık değildir; "AÇIKLAMALAR :" gibi
  // iki noktayla BİTEN başlık başlık kalır.
  const etiketDeger = /:\s*\S/.test(s);
  if (buyukMu && !etiketDeger && s.length <= 80) return HIZA.orta;
  return HIZA.iki;
}

/** CRC-32 (ZIP'in istediği). Tablo ilk çağrıda kurulur. */
let crcTablosu: Uint32Array | null = null;
function crc32(veri: Uint8Array): number {
  if (!crcTablosu) {
    crcTablosu = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTablosu[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < veri.length; i++) c = crcTablosu[(c ^ veri[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * content.xml üretir.
 *
 * Dışa açık çünkü TESTLENEBİLİR olması gerekiyor: offset aritmetiği bu
 * dosyanın en kırılgan yeri ve onu ZIP'in içinden çıkarmadan sınayabilmek
 * testi hem hızlı hem okunur kılıyor.
 */
/**
 * UYAP Editör'ün AÇAMADIĞI karakterleri temizler (08.10.2026, gerçek
 * UYAP Editör 5.4.20'de ölçüldü):
 *  - Emoji ve BMP dışı her karakter (📌, 📎, 🔴): editör "Dosya açılamadı!"
 *    diyor — JDOM vekil çiftini (0xd83d) tek tek "geçersiz XML karakteri"
 *    sayıyor. BMP içindekiler (⚠️ ✅ ₺ §) sorunsuz açıldı.
 *  - XML 1.0'da yasak kontrol karakterleri (Word/PDF'ten yapıştırılan \f, \v
 *    vb.): content.xml geçerli XML olmuyor.
 *  - "]]>": CDATA'yı bölerek kaçırmak XML olarak doğru ama editör (JDOM)
 *    parçaları birleştirip "CDATA cannot internally contain..." diyerek
 *    açmıyor. Araya boşluk koyuyoruz: "]] >".
 *  - Satır başı markdown (### Başlık, **BAŞLIK**): editörde yıldızlarıyla
 *    basılıyordu.
 * Temizlik offset hesabından ÖNCE yapılır; offsetler temiz metinden türer.
 */
export function udfMetniTemizle(metin: string): string {
  return metin
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ' ')
    .replace(/]]>/g, ']] >')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^([ \t]*)\*\*(.+?)\*\*[ \t]*$/gm, '$1$2');
}

export function udfIcerikXml(metin: string): string {
  // SATIR SONU NORMALİZASYONU ŞART. Windows'tan gelen "\r\n" iki karakterdir;
  // offset'ler ona göre hesaplanır ama CDATA'ya yazılan metin farklı olursa
  // her paragraf bir karakter kayar ve belge bozulur. (udfMetniTemizle içinde.)
  const duz = udfMetniTemizle(metin);

  // Paragraflar satır satır. Boş satır da bir paragraftır (dilekçede
  // bölümler arası boşluk taşır) — atlanırsa metin sıkışır.
  const satirlar = duz.split('\n');

  const parcalar: string[] = [];
  let ofset = 0;
  for (const satir of satirlar) {
    const hiza = hizaSec(satir);
    // Uzunluğa satır sonu karakteri DE dahildir: CDATA'da "\n" gerçek bir
    // karakter ve örtülmezse toplam, metin uzunluğunu tutmaz.
    const uzunluk = satir.length + 1;
    parcalar.push(
      `<paragraph Alignment="${hiza}" LeftIndent="0.0" RightIndent="0.0">` +
        `<content startOffset="${ofset}" length="${uzunluk}" family="${xmlKacis(YAZI.aile)}" size="${YAZI.boyut}"` +
        // Ortalanan başlık KALIN (mahkeme başlığı, AÇIKLAMALAR, NETİCE-İ
        // TALEP). 04.10.2026: gerçek UYAP Editör 5.4.20'de açılıp kalın
        // göründüğü doğrulandı (scripts/udf-editor-denetim.md).
        `${hiza === HIZA.orta ? ' bold="true"' : ''} />` +
        `</paragraph>`
    );
    ofset += uzunluk;
  }

  // CDATA metni, offset'lerin saydığı metinle BİREBİR aynı olmalı: her
  // satırın sonunda "\n" var, yani son satırdan sonra da bir tane.
  const govde = satirlar.join('\n') + '\n';

  // "]]>" udfMetniTemizle'de "]] >" yapıldı; burada artık geçemez.
  const cdata = govde;

  return (
    `<?xml version="1.0" encoding="UTF-8" ?>\n` +
    `<template format_id="1.8">\n` +
    `<content><![CDATA[${cdata}]]></content>\n` +
    `<properties><pageFormat mediaSizeName="${SAYFA.mediaSizeName}" ` +
    `leftMargin="${SAYFA.kenar}" rightMargin="${SAYFA.kenar}" ` +
    `topMargin="${SAYFA.kenar}" bottomMargin="${SAYFA.kenar}" ` +
    `paperOrientation="${SAYFA.yon}" headerFOffset="20.0" footerFOffset="20.0" /></properties>\n` +
    `<elements resolver="hvl-default">${parcalar.join('')}</elements>\n` +
    // İKİ STİL. "hvl-default", <elements resolver="hvl-default"> atfının
    // karşılığı; "default" UYAP'ın kendi arayüz stili (değerler UDF-Toolkit
    // şablonundan birebir).
    `<styles><style name="default" description="Geçerli" family="Dialog" size="12" ` +
    `bold="false" italic="false" foreground="-13421773" ` +
    `FONT_ATTRIBUTE_KEY="javax.swing.plaf.FontUIResource[family=Dialog,name=Dialog,style=plain,size=12]" />` +
    `<style name="hvl-default" family="${xmlKacis(YAZI.aile)}" size="${YAZI.boyut}" description="Gövde" /></styles>\n` +
    `</template>`
  );
}

/**
 * Tek dosyalık, SIKIŞTIRMASIZ (stored) ZIP kurar.
 *
 * Alanlar ZIP belirtimindeki sırayla ve little-endian yazılır. Sıkıştırma
 * yok çünkü UDF birkaç kilobayt; deflate eklemek kazanç değil, hata yüzeyi.
 */
function zipKur(dosyaAdi: string, icerik: Uint8Array): Uint8Array {
  const ad = new TextEncoder().encode(dosyaAdi);
  const crc = crc32(icerik);
  const boy = icerik.length;

  const yaz = (hedef: DataView, konum: number, deger: number, bayt: 2 | 4) => {
    if (bayt === 2) hedef.setUint16(konum, deger, true);
    else hedef.setUint32(konum, deger >>> 0, true);
  };

  const yerelBoy = 30 + ad.length;
  const merkezBoy = 46 + ad.length;
  const toplam = yerelBoy + boy + merkezBoy + 22;
  const tampon = new Uint8Array(toplam);
  const gorunum = new DataView(tampon.buffer);
  let p = 0;

  // ── Yerel dosya başlığı ──
  yaz(gorunum, p, 0x04034b50, 4); p += 4; // imza
  yaz(gorunum, p, 20, 2); p += 2;         // gereken sürüm (2.0)
  yaz(gorunum, p, 0x0800, 2); p += 2;     // bayrak: dosya adı UTF-8
  yaz(gorunum, p, 0, 2); p += 2;          // yöntem: 0 = stored
  yaz(gorunum, p, 0, 2); p += 2;          // saat — sabit, üretim tekrarlanabilir olsun
  yaz(gorunum, p, 0x21, 2); p += 2;       // tarih (1980-01-01)
  yaz(gorunum, p, crc, 4); p += 4;
  yaz(gorunum, p, boy, 4); p += 4;        // sıkıştırılmış boy
  yaz(gorunum, p, boy, 4); p += 4;        // gerçek boy
  yaz(gorunum, p, ad.length, 2); p += 2;
  yaz(gorunum, p, 0, 2); p += 2;          // ek alan yok
  tampon.set(ad, p); p += ad.length;
  tampon.set(icerik, p); p += boy;

  // ── Merkezi dizin ──
  const merkezBas = p;
  yaz(gorunum, p, 0x02014b50, 4); p += 4;
  yaz(gorunum, p, 20, 2); p += 2;         // üreten sürüm
  yaz(gorunum, p, 20, 2); p += 2;         // gereken sürüm
  yaz(gorunum, p, 0x0800, 2); p += 2;
  yaz(gorunum, p, 0, 2); p += 2;
  yaz(gorunum, p, 0, 2); p += 2;
  yaz(gorunum, p, 0x21, 2); p += 2;
  yaz(gorunum, p, crc, 4); p += 4;
  yaz(gorunum, p, boy, 4); p += 4;
  yaz(gorunum, p, boy, 4); p += 4;
  yaz(gorunum, p, ad.length, 2); p += 2;
  yaz(gorunum, p, 0, 2); p += 2;          // ek alan
  yaz(gorunum, p, 0, 2); p += 2;          // yorum
  yaz(gorunum, p, 0, 2); p += 2;          // disk no
  yaz(gorunum, p, 0, 2); p += 2;          // iç öznitelik
  yaz(gorunum, p, 0, 4); p += 4;          // dış öznitelik
  yaz(gorunum, p, 0, 4); p += 4;          // yerel başlığın konumu (0)
  tampon.set(ad, p); p += ad.length;

  // ── Merkezi dizin sonu ──
  yaz(gorunum, p, 0x06054b50, 4); p += 4;
  yaz(gorunum, p, 0, 2); p += 2;          // disk
  yaz(gorunum, p, 0, 2); p += 2;          // merkezin bulunduğu disk
  yaz(gorunum, p, 1, 2); p += 2;          // bu diskteki kayıt
  yaz(gorunum, p, 1, 2); p += 2;          // toplam kayıt
  yaz(gorunum, p, merkezBoy, 4); p += 4;
  yaz(gorunum, p, merkezBas, 4); p += 4;
  yaz(gorunum, p, 0, 2); p += 2;          // yorum uzunluğu

  return tampon;
}

/** Metinden UDF (ZIP) baytları üretir. */
export function udfUret(metin: string): Uint8Array {
  const xml = new TextEncoder().encode(udfIcerikXml(metin));
  return zipKur('content.xml', xml);
}

/**
 * Dosya adını UDF için hazırlar: Türkçe harfler sadeleştirilir, boşluklar
 * tire olur. UYAP ve Windows bazı karakterlerde sorun çıkarıyor.
 */
export function udfDosyaAdi(baslik: string): string {
  // BÜYÜK/KÜÇÜK AYRI EŞLENİR. Tek sınıfta toplamak ("[ıİ]" → "i") "İşçilik"i
  // "iscilik" yapıyordu; testte yakalandı. Dosya adı avukatın gördüğü şey,
  // baş harfi küçülmüş bir ad özensiz görünür.
  const sade = baslik
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const gun = yerelGunISO();
  return `${sade || 'dilekce'}-${gun}.udf`;
}
