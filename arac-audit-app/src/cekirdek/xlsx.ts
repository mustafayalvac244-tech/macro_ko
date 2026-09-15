// XLSX (Excel) yazıcı — dış bağımlılık YOK.
// Excel'in .xlsx dosyası, içinde XML bulunan bir ZIP'tir. Burada yalnız
// ihtiyacımız olan parçaları üretiyoruz: biçimler, sayfalar ve GÖMÜLÜ GÖRSEL.
// Fotoğrafın hatanın yanındaki hücreye oturması bu dosyanın çizim (drawing)
// bölümüyle olur; Excel açıldığında fotoğraf gerçekten dosyanın içindedir,
// bağlantı değildir — dosyayı e-postayla göndermek yeter.

import { ZipGirdisi } from './zip';

/** Bir hücre: yalın değer ya da değer + biçim numarası. */
export type Hucre = string | number | boolean | null | undefined | { v: string | number | boolean | null | undefined; stil?: number };

/** Sayfaya gömülecek görsel ve hangi hücreye oturacağı. */
export interface Gorsel {
  satir: number;
  sutun: number;
  veri: Uint8Array;
  gosterEn: number;
  gosterBoy: number;
  /** Aynı hücrede yan yana duran fotoğraflar için yatay kayma (piksel). */
  xKayma?: number;
  ad?: string;
  aciklama?: string;
}

export interface Sayfa {
  ad: string;
  satirlar: Hucre[][];
  sutunGenislikleri?: number[];
  satirYukseklikleri?: Record<number, number>;
  birlesikler?: string[];
  dondur?: { satir?: number; sutun?: number };
  filtre?: string;
  gorseller?: Gorsel[];
}

export interface KitapUstVerisi { baslik?: string; yazar?: string; tarih?: Date }

import { zipOlustur } from './zip';
import { goruntuBoyutu } from './goruntu';

const EMU_PIKSEL = 9525;      // 1 piksel = 9525 EMU
const PUAN_PIKSEL = 96 / 72;  // 1 punto = 1.333 piksel

// XML 1.0'da yasak olan denetim karakterleri. Bunlar dosyaya sızarsa Excel
// dosyayı "bozuk" sayıp açmayı reddeder — barkod okuyucular ara sıra üretir.
const YASAK_DENETIM = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g');

export function xmlKacis(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(YASAK_DENETIM, '');
}

/** 0 tabanlı sütun numarasını Excel harfine çevirir: 0 -> A, 26 -> AA */
export function sutunAdi(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

export function hucreAdi(satir: number, sutun: number): string { return `${sutunAdi(sutun)}${satir + 1}`; }

// --- BİÇİMLER -------------------------------------------------------------
// Dizideki sıra, hücrelerin `stil` numarasıdır. Değiştirirseniz aşağıdaki
// cellXfs listesini de aynı sırada güncelleyin.
export const STIL = {
  NORMAL: 0, BASLIK: 1, GOVDE: 2, BASLIK_BUYUK: 3, ETIKET: 4,
  SIDDET_A: 5, SIDDET_B: 6, SIDDET_C: 7, SAYI: 8, TARIH: 9, SOLUK: 10, GOVDE_ORTA: 11,
};

const STILLER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy\\ hh:mm"/></numFmts>
<fonts count="6">
<font><sz val="10"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF101828"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FF101828"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FF667085"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FF7A271A"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE4E2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEF0C7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEFBE8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right>
<top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/>
</border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

// --- SAYFA ÜRETİMİ --------------------------------------------------------

function hucreXml(satirNo: number, sutunNo: number, hucre: Hucre): string {
  if (hucre === null || hucre === undefined || hucre === '') return '';
  const nesne = typeof hucre === 'object';
  const v = nesne ? hucre.v : hucre;
  const stil = nesne ? (hucre.stil ?? 0) : 0;
  const ref = hucreAdi(satirNo, sutunNo);
  const s = stil ? ` s="${stil}"` : '';

  if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  // Baştaki/sondaki boşluğun korunması için xml:space="preserve" şart
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlKacis(v)}</t></is></c>`;
}

/**
 * Tek sayfanın XML'ini üretir.
 * @param {object} sayfa
 * @param {boolean} cizimVar sayfada gömülü görsel var mı
 */
function sayfaXml(sayfa: Sayfa & { ilkSayfa?: boolean }, cizimVar: boolean): string {
  const satirlar = sayfa.satirlar ?? [];
  const yukseklikler = sayfa.satirYukseklikleri ?? {};

  let govde = '';
  for (let r = 0; r < satirlar.length; r++) {
    const hucreler = satirlar[r] ?? [];
    let ic = '';
    for (let c = 0; c < hucreler.length; c++) ic += hucreXml(r, c, hucreler[c]);
    const h = yukseklikler[r];
    const hAttr = h ? ` ht="${h}" customHeight="1"` : '';
    if (!ic && !hAttr) continue;
    govde += `<row r="${r + 1}"${hAttr}>${ic}</row>`;
  }

  const sutunlar = (sayfa.sutunGenislikleri ?? []).map((g, i) =>
    g ? `<col min="${i + 1}" max="${i + 1}" width="${g}" customWidth="1"/>` : '').join('');

  const dondur = sayfa.dondur
    ? `<pane xSplit="${sayfa.dondur.sutun ?? 0}" ySplit="${sayfa.dondur.satir ?? 0}" topLeftCell="${hucreAdi(sayfa.dondur.satir ?? 0, sayfa.dondur.sutun ?? 0)}" activePane="bottomRight" state="frozen"/>`
    : '';

  const birlesenler = sayfa.birlesikler ?? [];
  const birlesik = birlesenler.length
    ? `<mergeCells count="${birlesenler.length}">${birlesenler.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';

  const filtre = sayfa.filtre ? `<autoFilter ref="${sayfa.filtre}"/>` : '';
  const sonSutun = Math.max(0, (sayfa.sutunGenislikleri?.length ?? 1) - 1);
  const boyutlar = satirlar.length
    ? `<dimension ref="A1:${hucreAdi(satirlar.length - 1, sonSutun)}"/>`
    : '<dimension ref="A1"/>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${boyutlar}
<sheetViews><sheetView workbookViewId="0"${sayfa.ilkSayfa ? ' tabSelected="1"' : ''}>${dondur}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${sutunlar ? `<cols>${sutunlar}</cols>` : ''}
<sheetData>${govde}</sheetData>
${filtre}${birlesik}
<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
${cizimVar ? '<drawing r:id="rIdDrawing"/>' : ''}
</worksheet>`;
}

/** Gömülü görsellerin yerleşim XML'i (her görsel kendi hücresine oturur). */
function cizimXml(gorseller: Gorsel[]): string {
  const parcalar = gorseller.map((g, i) => {
    const cx = Math.round(g.gosterEn * EMU_PIKSEL);
    const cy = Math.round(g.gosterBoy * EMU_PIKSEL);
    const kayma = Math.round((g.xKayma ?? 0) * EMU_PIKSEL);
    return `<xdr:oneCellAnchor>
<xdr:from><xdr:col>${g.sutun}</xdr:col><xdr:colOff>${kayma + 19050}</xdr:colOff><xdr:row>${g.satir}</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from>
<xdr:ext cx="${cx}" cy="${cy}"/>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="${xmlKacis(g.ad ?? `Fotograf ${i + 1}`)}" descr="${xmlKacis(g.aciklama ?? '')}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:oneCellAnchor>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${parcalar}</xdr:wsDr>`;
}

/** Sayfa adındaki Excel'in kabul etmediği karakterleri temizler. */
export function sayfaAdiTemizle(ad: string): string {
  return String(ad).replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sayfa';
}

/**
 * Görselin hücre içinde kaplayacağı ölçüyü hesaplar (en/boy oranı korunur).
 * @returns {{en:number, boy:number}} piksel
 */
export function gosterimOlcusu(bayt: Uint8Array, enFazlaEn = 150, enFazlaBoy = 110): { en: number; boy: number } {
  const b = goruntuBoyutu(bayt);
  if (!b || !b.en || !b.boy) return { en: enFazlaEn, boy: enFazlaBoy };
  const oran = Math.min(enFazlaEn / b.en, enFazlaBoy / b.boy);
  return { en: Math.max(1, Math.round(b.en * oran)), boy: Math.max(1, Math.round(b.boy * oran)) };
}

/**
 * Çalışma kitabını üretir.
 * @param {object[]} sayfalar
 * @param {{baslik?:string, yazar?:string, tarih?:Date}} [ustVeri]
 * @returns {Uint8Array}
 */
export function xlsxOlustur(sayfalar: Sayfa[], ustVeri: KitapUstVerisi = {}): Uint8Array {
  const tarih = ustVeri.tarih ?? new Date();
  const dosyalar: ZipGirdisi[] = [];
  const icerikTurleri: string[] = [];
  const kitapSayfalari: string[] = [];
  const kitapIliski: string[] = [];

  let gorselSayaci = 0;

  sayfalar.forEach((sayfa, i) => {
    const no = i + 1;
    const gorseller = sayfa.gorseller ?? [];
    const cizimVar = gorseller.length > 0;

    dosyalar.push({ ad: `xl/worksheets/sheet${no}.xml`, veri: sayfaXml({ ...sayfa, ilkSayfa: i === 0 }, cizimVar) });
    icerikTurleri.push(`<Override PartName="/xl/worksheets/sheet${no}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    kitapSayfalari.push(`<sheet name="${xmlKacis(sayfaAdiTemizle(sayfa.ad))}" sheetId="${no}" r:id="rId${no}"/>`);
    kitapIliski.push(`<Relationship Id="rId${no}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${no}.xml"/>`);

    if (!cizimVar) return;

    const medyaIliskileri: string[] = [];
    gorseller.forEach((g, gi) => {
      gorselSayaci += 1;
      const png = goruntuBoyutu(g.veri)?.tur === 'png';
      const medyaAd = `image${gorselSayaci}.${png ? 'png' : 'jpg'}`;
      dosyalar.push({ ad: `xl/media/${medyaAd}`, veri: g.veri });
      medyaIliskileri.push(`<Relationship Id="rId${gi + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${medyaAd}"/>`);
    });

    dosyalar.push({ ad: `xl/drawings/drawing${no}.xml`, veri: cizimXml(gorseller) });
    dosyalar.push({
      ad: `xl/drawings/_rels/drawing${no}.xml.rels`,
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${medyaIliskileri.join('')}</Relationships>`,
    });
    dosyalar.push({
      ad: `xl/worksheets/_rels/sheet${no}.xml.rels`,
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${no}.xml"/></Relationships>`,
    });
    icerikTurleri.push(`<Override PartName="/xl/drawings/drawing${no}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  });

  dosyalar.unshift(
    {
      ad: '[Content_Types].xml',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${icerikTurleri.join('\n')}
</Types>`,
    },
    {
      ad: '_rels/.rels',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      ad: 'docProps/core.xml',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlKacis(ustVeri.baslik ?? 'Arac Denetim Raporu')}</dc:title>
<dc:creator>${xmlKacis(ustVeri.yazar ?? 'Arac Audit')}</dc:creator>
<cp:lastModifiedBy>${xmlKacis(ustVeri.yazar ?? 'Arac Audit')}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${tarih.toISOString()}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${tarih.toISOString()}</dcterms:modified>
</cp:coreProperties>`,
    },
    {
      ad: 'docProps/app.xml',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Arac Audit</Application></Properties>`,
    },
    { ad: 'xl/styles.xml', veri: STILLER_XML },
    {
      ad: 'xl/workbook.xml',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${kitapSayfalari.join('')}</sheets></workbook>`,
    },
    {
      ad: 'xl/_rels/workbook.xml.rels',
      veri: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${kitapIliski.join('')}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
  );

  return zipOlustur(dosyalar, tarih);
}

/** Piksel yüksekliğini Excel satır yüksekliğine (punto) çevirir. */
export function pikselPunto(piksel: number): number { return Math.round((piksel / PUAN_PIKSEL) * 10) / 10; }
