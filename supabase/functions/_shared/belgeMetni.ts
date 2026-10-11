// BELGE METNİ AYIKLAMA — saf mantık, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Buradaki tek işlev, yüklenen dosyadan avukatın göreceği
// metni çıkarıyor. Yanlış çalıştığında ekran "Dosya boş görünüyor" diyor ve
// kullanıcı, dosyasında bir sorun olduğunu sanıyor — oysa hata bizde.
// Uç işlevinin içindeyken sınanamıyordu (Deno'ya özgü şeyler var).
//
// ÖLÇÜLEN ARIZA: UYAP UDF dosyalarında metin CDATA bloğunun içinde durur
// (<content><![CDATA[ ... ]]></content>). Etiket temizleyicisi CDATA'yı da bir
// etiket sanıp KOMPLE SİLİYORDU: geriye hiçbir şey kalmıyor, uç 422 "empty"
// dönüyordu. Yani ekranın açıkça vaat ettiği UDF desteği çalışmıyordu ve bunu
// yalnız gerçek bir UDF yükleyen avukat fark ederdi.

/**
 * DOĞRUSAL SÜRE — NEDEN REGEX DEĞİL (10.10.2026, 50 denetçi → ajan 26).
 *
 * Yüklenen dosyanın içi KÖTÜ NİYETLİ ya da bozuk olabilir. Eski
 * `/<[^>]+>/g` her '<' için kapanış '>' ararken dosyanın sonuna kadar
 * tarıyordu: kapanmayan 50.000 '<' → 2,7 sn, 100.000 → 9,7 sn, 200.000 →
 * 38,5 sn (ölçüldü; denetçi 54 sn demişti). CDATA açan desen de aynı
 * yapıdaydı; `<content>(CDATA)+</content>` deseni kapanış yokken ÜSTELDİ
 * (her ek CDATA bloğu süreyi ikiye katlıyordu). Aşağıdaki yardımcılar
 * indexOf ile TEK GEÇİŞTE çalışır: bir arama başarısız olursa sonraki
 * aramaların da başarısız olacağı bilindiği için orada durur, kalanı olduğu
 * gibi bırakır (regex'in "eşleşme yok" davranışı).
 */

/** `<![CDATA[x]]>` → `x`. Kapanmayan başlangıç ve sonrası olduğu gibi kalır. */
function cdataAc(s: string): string {
  const BAS = '<![CDATA[';
  let cikti = '';
  let i = 0;
  for (;;) {
    const a = s.indexOf(BAS, i);
    if (a < 0) break;
    const b = s.indexOf(']]>', a + BAS.length);
    if (b < 0) break;
    cikti += s.slice(i, a) + s.slice(a + BAS.length, b);
    i = b + 3;
  }
  return cikti + s.slice(i);
}

/**
 * `<…>` aralıklarını `yerine` ile değiştirir (eski `/<[^>]+>/g` ile aynı
 * sonuç: "<>" etiket sayılmaz, kapanmayan '<' ve sonrası metindir).
 */
function etiketleriDegistir(s: string, yerine: string): string {
  let cikti = '';
  let i = 0;
  for (;;) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    const gt = s.indexOf('>', lt + 1);
    if (gt < 0) break;
    if (gt === lt + 1) {
      cikti += s.slice(i, lt + 1);
      i = lt + 1;
      continue;
    }
    cikti += s.slice(i, lt) + yerine;
    i = gt + 1;
  }
  return cikti + s.slice(i);
}

/**
 * XML/HTML etiketlerini temizler, paragraf sonlarını korur.
 *
 * CDATA ÖNCE AÇILIR. `<[^>]+>` deseni `<![CDATA[...]]>` bloğunun tamamını tek
 * bir etiket gibi eşleştirip siliyordu; içerideki metin de onunla gidiyordu.
 */
export function stripXml(xml: string): string {
  // CDATA içindeki metin BELGENİN KENDİSİDİR; etiket temizliğinden önce açılır.
  const acik = cdataAc(String(xml ?? ''))
    // paragraf/satır sonlarını koru
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/paragraph>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return etiketleriDegistir(acik, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * UDF METNİ — content.xml'den belgenin GERÇEK metni (04.10.2026).
 *
 * NEDEN stripXml DEĞİL. UDF'de metnin tamamı tek bir <content> CDATA'sında
 * durur; biçim bilgisi ayrı <elements> bölümündedir. stripXml CDATA'yı açıp
 * SONRA etiket temizliyordu: belgenin kendi metnindeki "<" ile ">" arası
 * (ör. "<ek-1>", "a < b ve c > d") etiket sanılıp siliniyordu.
 *
 * İKİ YER TUTUCU ATILIR: U+FFFC resmin, U+200B boş paragrafın yeridir
 * (UYAP biçimi; bkz. src/lib/udf.ts). Metinde görünmez ya da "￼" kutusu
 * olarak çıkar, avukatın okuyacağı metne ait değildir.
 *
 * BÖLÜNMÜŞ CDATA. "]]>" geçen metin birden çok CDATA parçasına bölünerek
 * yazılır (bizim üreticimiz de böyle yazar); parçalar birleştirilir.
 *
 * <content> CDATA'sı bulunamazsa stripXml'e düşer: tanımadığımız bir sürüm
 * hiç okunmamaktansa kaba okunsun.
 */
export function udfMetni(xml: string): string {
  const s = String(xml ?? '');
  const metin = udfGovdesi(s);
  if (metin === null) return stripXml(s);
  return metin
    .replace(/\r\n?/g, '\n')
    .replace(/[​￼]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * `<content>` içindeki CDATA parçalarını birleştirir; yapı beklenen gibi
 * değilse null. Eski desen `<content>\s*((?:<!\[CDATA\[[\s\S]*?\]\]>\s*)+)<\/content>`
 * kapanış yokken her CDATA'nın gövdesini sonraki `]]>`'lara doğru uzatıp
 * ÜSTEL geri izleme yapıyordu (bkz. stripXml üstündeki not). Başarısız bir
 * deneme taradığı yeri bir daha taramaz: süre girdiyle doğrusal.
 */
function udfGovdesi(s: string): string | null {
  const ACIL = '<content>';
  const CD = '<![CDATA[';
  const KAPA = '</content>';
  const bosluk = /\s*/y;
  const bosluguAtla = (i: number): number => {
    bosluk.lastIndex = i;
    bosluk.exec(s);
    return bosluk.lastIndex;
  };
  let konum = 0;
  for (;;) {
    const c = s.indexOf(ACIL, konum);
    if (c < 0) return null;
    let i = bosluguAtla(c + ACIL.length);
    const parcalar: string[] = [];
    while (s.startsWith(CD, i)) {
      const b = s.indexOf(']]>', i + CD.length);
      // Kapanan `]]>` yoksa sonraki hiçbir CDATA da kapanamaz.
      if (b < 0) return null;
      parcalar.push(s.slice(i + CD.length, b));
      i = bosluguAtla(b + 3);
    }
    if (parcalar.length > 0 && s.startsWith(KAPA, i)) return parcalar.join('');
    konum = Math.max(i, c + 1);
  }
}

/** Sayısal karakter kaçışı → karakter; geçersiz kod noktası atılır (fromCodePoint fırlatır). */
function kodNoktasi(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

/** XML kaçışlarını çözer (onaltılık sayısal kaçış dahil). */
function xmlKacisCoz(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => kodNoktasi(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => kodNoktasi(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * DOCX METNİ — word/document.xml'den belgenin GÜNCEL metni (09.10.2026).
 *
 * BULUNAN İKİ KUSUR (08.10 denetimi; tests/belgeEkiOkuma.test.ts gerçek bir
 * .docx ile sınıyor). DOCX eskiden stripXml'den geçiyordu; o her etiketi
 * boşluğa çevirip ne kalırsa metin sayıyordu:
 *
 *   • İZLENEN DEĞİŞİKLİKLER. Word'de "değişiklikleri izle" açıkken silinen
 *     metin dosyada durur (<w:del><w:delText>…). Etiket temizliği onu da
 *     metne katıyordu: "Kira bedeli aylık 10.000 TL 20.000 TL" — model iki
 *     tutarı da belgede yazıyor sanıyordu. Taşınan metnin ESKİ yeri
 *     (<w:moveFrom>) de aynı şekilde iki kez okunuyordu.
 *   • RUN SINIRI. Word bir kelimeyi biçim, yazım denetimi ya da düzenleme
 *     oturumu değişince ayrı "run"lara böler. Her etiket boşluk olunca
 *     kelimenin ORTASINA boşluk giriyordu: "Mahke mesi", "12.03. 2024".
 *     Denetçi bunu "boşluk kaybı" diye yazmıştı; ölçülen tersiydi — fazla
 *     boşluk. Bölünen tarih ve tutar, uydurma tarih/tutar denetiminde
 *     kaynakta bulunamaz.
 *
 * DOĞRUSU: etiket silmek değil, METNİ TAŞIYAN öğeleri okumak. Yalnız <w:t>
 * (ve Office Math <m:t>) metindir; <w:delText>, alan kodu <w:instrText> ve
 * öznitelikler metin değildir. <w:tab/> sekme, <w:br/>/<w:cr/> satır sonu,
 * </w:p> paragraf sonudur. Paragraf işaretinin kendisi silinmişse (pPr
 * içindeki <w:del/>) paragraf sonrakiyle birleşir — Word'ün son hâli böyle.
 *
 * Sekme DURAĞI (<w:tabs><w:tab w:val… w:pos…/>) öznitelikli olduğu için
 * yalnız özniteliksiz <w:tab/> sekme sayılır.
 */
export function docxMetni(xml: string): string {
  // DOĞRUSAL SÜRE (10.10.2026): eski sürüm bunu birbirini izleyen beş regex
  // ile yapıyordu (`<w:del …>[\s\S]*?</w:del>`, `<w:t>[\s\S]*?</w:t>`,
  // `<w:pPr>…</w:pPr>`). Kapanmayan açılış etiketi her seferinde dosyanın
  // sonuna kadar tarıyordu (kuadratik; ölçüldü: 50 bin karakterlik
  // `<w:del ` yığını 0,8 sn, 200 bin karakter ~13 sn). Şimdi etiketler
  // soldan sağa TEK GEÇİŞTE gezilir; kapanış etiketi aramaları önbelleğe
  // alınır ve "yok" bir kez bulununca bir daha aranmaz.
  const s = String(xml ?? '');
  const parcalar: string[] = [];
  let birlestir = false; // paragraf işareti silinmiş: sonraki </w:p> satır sonu koymaz
  let pPrIcinde = false;
  let pPrSilinmis = false;

  // kapanış etiketi → s içinde ondan sonraki ilk konum (-1: kalmadı).
  const onbellek = new Map<string, number>();
  const sonraki = (kapanis: string, konum: number): number => {
    const onceki = onbellek.get(kapanis);
    // Önbellekteki konum, daha küçük bir başlangıçtan bulunan İLK oluşumdur;
    // konum'dan büyük/eşitse konum'dan sonraki ilk oluşum da odur.
    if (onceki !== undefined && (onceki === -1 || onceki >= konum)) return onceki;
    const yeni = s.indexOf(kapanis, konum);
    onbellek.set(kapanis, yeni);
    return yeni;
  };

  let i = 0;
  for (;;) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    const gt = s.indexOf('>', lt + 1);
    if (gt < 0) break;
    i = gt + 1;
    const ic = s.slice(lt + 1, gt); // '<' ile '>' arası
    const kapanisEtiketi = ic.charCodeAt(0) === 47; // '/'
    const kendiKapanan = ic.charCodeAt(ic.length - 1) === 47;
    const b = kapanisEtiketi ? 1 : 0;
    let e = b;
    while (e < ic.length && ic.charCodeAt(e) > 32 && ic.charCodeAt(e) !== 47) e += 1;
    const ad = ic.slice(b, e);

    if (ad === 'w:pPr') {
      if (kapanisEtiketi) {
        // Paragraf işareti silinmiş/taşınmış paragraf: sonuna satır sonu konmaz.
        if (pPrIcinde && pPrSilinmis) birlestir = true;
        pPrIcinde = false;
      } else if (!kendiKapanan) {
        pPrIcinde = true;
        pPrSilinmis = false;
      }
    } else if (ad === 'w:del' || ad === 'w:moveFrom') {
      if (kapanisEtiketi) continue;
      if (kendiKapanan) {
        // Kendinden kapanan işaret (paragraf/satır işareti): metin silmez;
        // açılış sanılırsa sonraki kapanışa kadar her şeyi yutardı.
        if (pPrIcinde) pPrSilinmis = true;
      } else {
        // Silinen / taşınan eski metin: kapanışa kadar atla. Kapanış yoksa
        // hiçbir şey silinmez (eski regex'in davranışı).
        const kapanis = `</${ad}>`;
        const k = sonraki(kapanis, i);
        if (k >= 0) i = k + kapanis.length;
      }
    } else if (ad === 'w:t' || ad === 'm:t') {
      if (kapanisEtiketi || kendiKapanan) continue;
      const kapanis = `</${ad}>`;
      const k = sonraki(kapanis, i);
      if (k >= 0) {
        parcalar.push(xmlKacisCoz(s.slice(i, k)));
        i = k + kapanis.length;
      }
    } else if (kapanisEtiketi) {
      if (ic === '/w:p') {
        if (!birlestir) parcalar.push('\n');
        birlestir = false;
      }
    } else if (kendiKapanan) {
      if (ad === 'w:tab' && /^w:tab\s*\/$/.test(ic)) parcalar.push('\t');
      else if (ad === 'w:noBreakHyphen' && /^w:noBreakHyphen\s*\/$/.test(ic)) parcalar.push('-');
      else if (ad === 'w:br' || ad === 'w:cr') parcalar.push('\n');
    }
  }
  return parcalar
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * RTF içinde METİN OLMAYAN gruplar (yazı tipi/renk/stil tabloları, belge
 * bilgisi, resim, nesne, üst/alt bilgi, dipnot, alan kodu). `{\*\…}` biçimli
 * hedefler zaten atlanır; bunlar yıldızsız yazılabilen hedeflerdir.
 */
const RTF_ATLA = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'objdata', 'themedata',
  'colorschememapping', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'revtbl',
  'rsidtbl', 'generator', 'xmlnstbl', 'mmathPr', 'header', 'headerl', 'headerr', 'headerf',
  'footer', 'footerl', 'footerr', 'footerf', 'footnote', 'annotation', 'fldinst', 'pn', 'xe', 'tc',
  'bkmkstart', 'bkmkend', 'filetbl', 'pgdsctbl', 'nonshppict',
]);

/** Metin üreten RTF denetim sözcükleri. */
const RTF_KARAKTER: Record<string, string> = {
  par: '\n', line: '\n', sect: '\n', page: '\n', row: '\n', tab: '\t', cell: '\t',
  emdash: '—', endash: '–', emspace: ' ', enspace: ' ', qmspace: ' ', bullet: '•',
  lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”',
};

/**
 * RTF METNİ (09.10.2026).
 *
 * BULUNAN KUSUR. doc-extract RTF'yi "denetim sözcüklerini sil" diye
 * okuyordu (/\\[a-z]+\d*\/g). Sonuç ölçüldü: yazı tipi tablosu ("Calibri;"),
 * süslü parantezler, "{\*" kalıntıları metne giriyor; Türkçe harfler \'dd,
 * \'fd biçiminde KAÇIŞLI kalıyor ("ASL\'ddYE HUKUK MAHKEMES\'dd");
 * paragraflar tek satıra yığılıyordu. Seçici .rtf'yi kabul ettiği hâlde RTF
 * desteği fiilen yoktu.
 *
 * Basit bir RTF okuyucu: grup yığını, atlanacak hedefler, \uN (+ \ucN yedek
 * karakter atlama), \'hh (belgenin kod sayfasıyla), kaçışlı \\ \{ \},
 * \bin. Kod sayfası \ansicpgN'den; belgede Türkçe yazı tipi (\fcharset162)
 * varsa \'hh Windows-1254 sayılır (İngilizce Word'de yazılmış Türkçe metin).
 */
export function rtfMetni(rtf: string): string {
  const s = String(rtf ?? '');
  if (!s) return '';
  const kodSayfasi = Number(s.match(/\\ansicpg(\d+)/)?.[1] ?? 1252);
  const etiket = /\\fcharset162\b/.test(s) && (kodSayfasi === 1252 || kodSayfasi === 0)
    ? 'windows-1254'
    : kodSayfasi >= 1250 && kodSayfasi <= 1258 ? `windows-${kodSayfasi}` : 'windows-1252';
  const cozucu = new TextDecoder(etiket);

  const yigin: Array<{ atla: boolean; uc: number }> = [];
  let atla = false;
  let uc = 1;
  let yedekAtla = 0;
  const cikti: string[] = [];
  const desen = /\\([a-z]{1,32})(-?\d{1,10})? ?|\\'([0-9a-f]{2})|\\([^a-z])|([{}])|[\r\n]+|([^\\{}\r\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = desen.exec(s)) !== null) {
    const [, sozcuk, sayi, onaltilik, sembol, parantez, duz] = m;
    if (parantez === '{') {
      yedekAtla = 0;
      yigin.push({ atla, uc });
    } else if (parantez === '}') {
      yedekAtla = 0;
      const ust = yigin.pop();
      if (ust) ({ atla, uc } = ust);
    } else if (sozcuk !== undefined) {
      const sozcukKucuk = sozcuk.toLowerCase();
      if (sozcukKucuk === 'u' && sayi !== undefined) {
        const kod = Number(sayi);
        if (!atla) cikti.push(String.fromCharCode(kod < 0 ? kod + 65536 : kod));
        yedekAtla = uc;
        continue;
      }
      yedekAtla = 0;
      if (sozcukKucuk === 'uc' && sayi !== undefined) uc = Number(sayi);
      else if (sozcukKucuk === 'bin' && sayi !== undefined) desen.lastIndex += Math.max(0, Number(sayi));
      else if (RTF_ATLA.has(sozcuk)) atla = true;
      else if (!atla && RTF_KARAKTER[sozcuk] !== undefined) cikti.push(RTF_KARAKTER[sozcuk]);
    } else if (onaltilik !== undefined) {
      if (yedekAtla > 0) yedekAtla -= 1;
      else if (!atla) cikti.push(cozucu.decode(Uint8Array.of(parseInt(onaltilik, 16))));
    } else if (sembol !== undefined) {
      yedekAtla = 0;
      if (sembol === '*') atla = true;
      else if (atla) continue;
      else if (sembol === '\\' || sembol === '{' || sembol === '}') cikti.push(sembol);
      else if (sembol === '~') cikti.push(' ');
      else if (sembol === '_') cikti.push('-');
      else if (sembol === '\n' || sembol === '\r') cikti.push('\n');
    } else if (duz !== undefined) {
      let metin = duz;
      if (yedekAtla > 0) {
        const n = Math.min(yedekAtla, metin.length);
        metin = metin.slice(n);
        yedekAtla -= n;
      }
      if (!atla) cikti.push(metin);
    }
  }
  return cikti
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * DÜZ METİN BAYTLARINI ÇÖZ — ikiliyse null (09.10.2026).
 *
 * BULUNAN KUSUR. doc-extract tanımadığı her dosyayı UTF-8 metin sayıyordu:
 * Windows-1254 ile kaydedilmiş .txt (Türkçe Not Defteri/Excel) "Davac�:
 * �irket" oluyor, fotoğraf ya da Excel dosyası "�PNG…IHDR" gibi bir çöp
 * metin olarak yapay zekâya gidiyordu — avukat belgesinin okunduğunu sanıyordu.
 *
 * Kural (istemcideki src/utils/metinKodlama.ts > metinDosyasiCoz ile aynı;
 * test ikisini aynı örneklerle sınıyor):
 *   • UTF-16 BOM'u varsa UTF-16 (Not Defteri'nin "Unicode" kaydı),
 *   • ilk 8.000 baytta NUL varsa İKİLİ dosya → null (git'in ikili dosya
 *     sezgisi; JPEG/PNG/ZIP başlıkları ilk baytlarda NUL taşır),
 *   • geçerli UTF-8 ise UTF-8 (BOM atılır), değilse Windows-1254.
 */
export function metinCoz(bayt: Uint8Array): string | null {
  if (bayt[0] === 0xff && bayt[1] === 0xfe) return new TextDecoder('utf-16le').decode(bayt);
  if (bayt[0] === 0xfe && bayt[1] === 0xff) return new TextDecoder('utf-16be').decode(bayt);
  if (bayt.subarray(0, 8000).includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bayt);
  } catch {
    return new TextDecoder('windows-1254').decode(bayt);
  }
}

/**
 * doc-extract'in PDF/UDF/DOCX/DOC DIŞINDAKİ dosyalar için yolu: düz metin ya
 * da RTF. İkili dosya metin diye okunmaz, 'unsupported' döner.
 */
export function duzMetinOku(ad: string, bayt: Uint8Array): { metin: string } | { hata: 'unsupported' } {
  const metin = metinCoz(bayt);
  if (metin === null) return { hata: 'unsupported' };
  const rtfMi = /\.rtf$/i.test(ad) || /^\s*\{\\rtf/.test(metin);
  return { metin: rtfMi ? rtfMetni(metin) : metin.replace(/\r\n?/g, '\n') };
}
