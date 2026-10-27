// XLSX OKUMA — yalnız ekibin dosyasına satır eklemek için gereken kadarı
// (27.10.2026). Tam bir XML ayrıştırıcı DEĞİL: Excel'in yazdığı düzenli
// biçime (satır <row>, hücre <c>, değer <v> ya da <is><t>) güvenir. Okunan
// sayfanın geri kalanına dokunulmaz; değiştirilen yalnız eklenen satırlardır.

/**
 * Global düzenli ifadenin bütün eşleşmeleri. `matchAll` yerine: Hermes'teki
 * desteğinden emin olmadığımız için (denenmedi) düz `exec` döngüsü.
 */
export function eslesmeler(re: RegExp, s: string): RegExpExecArray[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  const sonuc: RegExpExecArray[] = [];
  for (let m = g.exec(s); m; m = g.exec(s)) {
    sonuc.push(m);
    if (m[0] === '') g.lastIndex += 1;
  }
  return sonuc;
}

const VARLIK: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XML varlıklarını çözer: &amp; &lt; &#233; &#x1F; … */
export function xmlCoz(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (tam, v: string) => {
    if (v[0] === '#') {
      const n = v[1] === 'x' || v[1] === 'X' ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : tam;
    }
    return VARLIK[v] ?? tam;
  });
}

/** Bir <si> ya da <is> içindeki metin: bütün <t>'ler birleşir, fonetik (<rPh>) atlanır. */
function metinParcalari(ic: string): string {
  const temiz = ic.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let s = '';
  for (const m of eslesmeler(/<t\b[^>]*\/>|<t\b[^>]*>([\s\S]*?)<\/t>/g, temiz)) s += xmlCoz(m[1] ?? '');
  return s;
}

/** sharedStrings.xml → sıra numarasıyla metinler. */
export function paylasilanMetinler(xml: string): string[] {
  const sonuc: string[] = [];
  for (const m of eslesmeler(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, xml)) sonuc.push(metinParcalari(m[1] ?? ''));
  return sonuc;
}

/** workbook.xml + ilişkiler → sayfa adı → arşivdeki yol ("xl/worksheets/sheet2.xml"). */
export function sayfaYollari(kitapXml: string, iliskiXml: string): Map<string, string> {
  const hedef = new Map<string, string>();
  for (const m of eslesmeler(/<Relationship\b([^>]*)\/?>/g, iliskiXml)) {
    const id = /\bId="([^"]*)"/.exec(m[1]!)?.[1];
    const t = /\bTarget="([^"]*)"/.exec(m[1]!)?.[1];
    if (id && t) hedef.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t}`);
  }
  const yollar = new Map<string, string>();
  for (const m of eslesmeler(/<sheet\b([^>]*)\/?>/g, kitapXml)) {
    const ad = /\bname="([^"]*)"/.exec(m[1]!)?.[1];
    const rid = /\br:id="([^"]*)"/.exec(m[1]!)?.[1];
    const yol = rid ? hedef.get(rid) : undefined;
    if (ad !== undefined && yol) yollar.set(xmlCoz(ad), yol);
  }
  return yollar;
}

export interface SatirParcasi {
  no: number;
  xml: string;
}

/** Sayfa XML'ini üç parçaya ayırır: satırlardan önce, satırlar, sonra. */
export function sayfayiBol(xml: string): { once: string; satirlar: SatirParcasi[]; sonra: string } {
  const bos = /<sheetData\s*\/>/.exec(xml);
  if (bos) {
    return { once: `${xml.slice(0, bos.index)}<sheetData>`, satirlar: [], sonra: `</sheetData>${xml.slice(bos.index + bos[0].length)}` };
  }
  const bas = xml.indexOf('<sheetData');
  const son = xml.lastIndexOf('</sheetData>');
  if (bas < 0 || son < 0) throw new Error('Sayfa okunamadı: sheetData yok');
  const icBas = xml.indexOf('>', bas) + 1;
  const ic = xml.slice(icBas, son);
  const satirlar: SatirParcasi[] = [];
  let sonNo = 0;
  for (const m of eslesmeler(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, ic)) {
    const r = /^<row\b[^>]*?\br="(\d+)"/.exec(m[0]);
    // r'siz satır bir öncekinin devamıdır (şartname böyle der).
    sonNo = r ? Number(r[1]) : sonNo + 1;
    satirlar.push({ no: sonNo, xml: m[0] });
  }
  return { once: xml.slice(0, icBas), satirlar, sonra: xml.slice(son) };
}

export interface HamHucre {
  sutun: string;
  /** Hücre türü: s (paylaşılan metin), inlineStr, str, b, e, n (yok = sayı). */
  tur: string;
  stil: string | null;
  /** <v> ya da satır içi metin; değer yoksa null. */
  deger: string | null;
}

export function satirHucreleri(satirXml: string): HamHucre[] {
  const sonuc: HamHucre[] = [];
  for (const m of eslesmeler(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, satirXml)) {
    const oz = m[1]!;
    const ref = /\br="([A-Z]+)\d*"/.exec(oz)?.[1];
    if (!ref) continue;
    const tur = /\bt="([^"]*)"/.exec(oz)?.[1] ?? 'n';
    const stil = /\bs="(\d+)"/.exec(oz)?.[1] ?? null;
    const ic = m[2] ?? '';
    let deger: string | null = null;
    if (tur === 'inlineStr') {
      const is = /<is>([\s\S]*?)<\/is>/.exec(ic);
      deger = is ? metinParcalari(is[1]!) : null;
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(ic);
      deger = v ? xmlCoz(v[1]!) : null;
    }
    sonuc.push({ sutun: ref, tur, stil, deger });
  }
  return sonuc;
}

/**
 * Satırın tek bir sütunundaki hücre — bütün satırı ayrıştırmadan (binlerce
 * satırlık sayfada fark ediyor). Excel hücreye hep `r="H12"` yazar.
 */
export function satirHucresi(satir: SatirParcasi, sutun: string): HamHucre | null {
  const x = satir.xml;
  const i = x.indexOf(` r="${sutun}${satir.no}"`);
  if (i < 0) return null;
  const bas = x.lastIndexOf('<c', i);
  const kapanis = x.indexOf('>', i);
  if (bas < 0 || kapanis < 0) return null;
  const son = x[kapanis - 1] === '/' ? kapanis + 1 : x.indexOf('</c>', kapanis) + 4;
  return son > bas ? satirHucreleri(x.slice(bas, son))[0] ?? null : null;
}

/** Hücrenin görünen değeri (metin ya da sayı); boşsa null. */
export function hucreDegeri(h: HamHucre, metinler: readonly string[]): string | number | null {
  if (h.deger === null) return null;
  if (h.tur === 's') return metinler[Number(h.deger)] ?? null;
  if (h.tur === 'inlineStr' || h.tur === 'str' || h.tur === 'e') return h.deger;
  if (h.tur === 'b') return h.deger === '1' ? 'TRUE' : 'FALSE';
  const n = Number(h.deger);
  return Number.isFinite(n) ? n : h.deger;
}

/** "AB" → 28 (1 tabanlı). */
export function sutunNo(harf: string): number {
  let n = 0;
  for (const c of harf) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}
