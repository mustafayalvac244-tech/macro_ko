// EKİBİN EXCEL'İNİ DOLDUR (27.10.2026).
//
// Ürün sahibi: "excel formati atsam çıktı otomatik doldurur dimi". Denetçi
// ekibin NAS dosyasını (makrolu .xlsm) telefonda seçer; denetimler
// AUDIT_CARS_LIST ve PROBLEMS_LIST sayfalarının SONUNA, ekibin makrosunun
// yazdığı biçimde eklenir. Dosyanın geri kalanı — makro (vbaProject.bin),
// öbür sayfalar, stiller — AÇILMADAN, bayt bayt aynen geri yazılır.
//
// Makronun kendisinden okunanlar (ekibin dosyası; içerik depoya yazılmadı):
//  - Yeni satır = son satırın altı; NO = satır − 2 (başlık 2. satırda).
//  - Tarih METİN "g.a.yyyy" (TextBox6.Text); sayfadaki tarihlerin ~%98'i böyle.
//  - BODY hücresi sayı (Excel "015253"ü 15253 yapıyor); UNICODECAR ve UNICODE
//    ise metin birleştirme: KAYNAK & MODEL & BODY(metin) [& PARÇA & TİP].
//  - Aynı araç ikinci kez listeye girmez: UNICODECAR H sütununda varsa
//    (makro "Bu araç daha önce audit yapilmis!" der). Problemi yine eklenir.
//  - AUDITOR büyük harf (UCase).
// Burada ayrıca: aynı UNICODE + tarihli problem zaten varsa tekrar eklenmez —
// aynı denetim iki kez gönderilirse ikinci sefer bir şey eklemez.
//
// Farklar bilerek (nas.ts'teki ayrı Excel'le aynı): PROBLEM QTY gerçek problem
// sayısı; PHOTO LINK fotoğrafların tam yedekteki adları.
//
// GÖNDERİM İZİ (28.10.2026, kalite müdürü değerlendirmesi): tekrar koruması
// yalnız dosyaya bakınca, eşleme gönderimden sonra değişirse aynı problem
// ikinci kez ekleniyordu; demerit sonradan düzeltilirse "zaten var" sayılıp
// Excel'de eski değer sessizce kalıyordu. Artık her gönderilen hatanın izi
// (Excel'deki anahtarı ve o anki değerleri) telefonda tutulur: iz dosyada
// varsa satır eklenmez; değer değişmişse "elle düzeltin" listesine girer.
// Excel'e sütun eklenmez, eski satır uygulamadan değiştirilmez.

import { aramaMetni } from './arama';
import { ciftAnahtari, EkipEtiketi, etiketAnahtari, etiketEslemesi, etiketleriTopla } from './ekipEslemesi';
import { KullaniciHatasi } from './hataMetni';
import {
  bolgelerAracIcin, hataTipiAdi, PARCA_INDEKS, parcaAdMetni, parcaAramaMetni, parcaCiftiAdi, parcaKendiMetni,
  parcaTamAdi, tumHataTipleri,
} from './katalog';
import {
  demeritDegeri, govdeNo, ilerlemeKodu, kaynakKodu, modelKodu, sinifDegeri, sistemDegeri, yedektekiFotograf,
} from './nas';
import { Denetim, Hata, ParcaKayit } from './tipler';
import { xmlKacis } from './xlsx';
import {
  hucreDegeri, paylasilanMetinler, satirHucreleri, satirHucresi, SatirParcasi, sayfaYollari, sayfayiBol, sutunNo,
} from './xlsxOku';
import { girdiyiAc, HamZipGirdisi, zipHamOku, zipOlustur, ZipGirdisi } from './zip';

/** Kullanıcının düzelttiği eşlemeler. Değer boş metinse uygulamanın kendi adı yazılır. */
export interface ElleEsleme {
  parca?: Readonly<Record<string, string>>;
  tip?: Readonly<Record<string, string>>;
}

/** Gönderildiği andaki değerler — sonradan neyin değiştiğini göstermek için. */
export interface GonderimDegeri {
  /** Parça kimliği (iki parça arasıysa `ciftAnahtari`) ve Excel'e yazılan adı. */
  parca: string; parcaEtiketi: string;
  tip: string; tipEtiketi: string;
  demerit: number; sinif: string; sistem: string;
  /** Takip durumu (acik/atandi/giderildi/kapali) ve önlem metni. */
  takip: string; onlem: string;
}

/** Ekibe gönderilmiş bir hatanın izi. Telefonda saklanır, Excel'e yazılmaz. */
export interface GonderimIzi {
  /** Excel'deki satırın anahtarı (UNICODE + gün, karşılaştırma biçiminde). */
  anahtar: string;
  deger: GonderimDegeri;
  /** İlk gönderildiği an (ISO). */
  tarih: string;
}

/** Hata kimliği → iz. */
export type GonderimKaydi = Readonly<Record<string, GonderimIzi>>;

export interface DegisenAlan { alan: 'parca' | 'tip' | 'demerit' | 'sinif' | 'sistem' | 'takip' | 'onlem'; eski: string; yeni: string }

/** Gönderildikten sonra uygulamada değişen hata — Excel'deki satırı eski. */
export interface DegisenHata {
  hataId: string;
  ad: { tr: string; en: string };
  govde: string;
  gun: string;
  alanlar: DegisenAlan[];
}

export interface EkipExceliSecenekleri {
  fotografAdi?: (fotoId: string) => string;
  elleEsleme?: ElleEsleme;
  /** Önceki gönderimlerin izi (yedek.ts → gonderimKaydiOku). */
  gonderilen?: GonderimKaydi;
  simdi?: Date;
}

export interface EslemeSatiri {
  tur: 'parca' | 'tip';
  /** Parça kimliği, çift anahtarı (`ciftAnahtari`) ya da tip kimliği. */
  anahtar: string;
  ad: { tr: string; en: string };
  /** Excel'e yazılan değer (aynen). */
  yazilan: string;
  /** ekip: listeden otomatik seçildi · elle: kullanıcı seçti · uygulama: karşılık yok, uygulamanın İngilizcesi. */
  kaynak: 'ekip' | 'elle' | 'uygulama';
  /** Bu doldurmada kaç satıra yazıldı. */
  adet: number;
}

export interface DoldurmaSonucu {
  bayt: Uint8Array;
  aracEklendi: number;
  /** Listede zaten olan araç (aynı KAYNAK+MODEL+BODY) — araç satırı eklenmedi. */
  aracZatenVar: number;
  problemEklendi: number;
  /** Aynı UNICODE ve tarihle zaten olan problem — eklenmedi. */
  problemZatenVar: number;
  /** Önceden başka adla (eşleme sonradan değişti) gönderilmiş — eklenmedi, Excel'deki adı eski. */
  baskaAdla: number;
  /** Gönderildikten sonra uygulamada değişen — eklenmedi; Excel'de elle düzeltilmeli. */
  degisenler: DegisenHata[];
  /** Bu doldurma paylaşılırsa kayda eklenecek izler (eklenen ve dosyada bulunan hatalar). */
  gonderim: Record<string, GonderimIzi>;
  /** Body no 6 hane değil (makro bunu reddediyor; burada yine de yazıldı). */
  altiHaneOlmayan: number;
  esleme: EslemeSatiri[];
  /** Düzeltme için seçilebilecek etiketler, sık kullanılan önce. */
  parcaEtiketleri: EkipEtiketi[];
  tipEtiketleri: EkipEtiketi[];
}

const ARAC_SAYFASI = 'AUDIT_CARS_LIST';
const PROBLEM_SAYFASI = 'PROBLEMS_LIST';

/** Excel'in metin tarihi, makronun yazdığı gibi: 27.10.2026 → "27.10.2026", 1.8.2025 → "1.8.2025". */
export function ekipTarihi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/** Karşılaştırma için gün anahtarı (yyyy-aa-gg): metin "g.a.yyyy", Excel seri sayısı ya da ISO. */
export function tarihAnahtari(v: string | number | null): string {
  if (v === null) return '';
  const iki = (n: number) => String(n).padStart(2, '0');
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}-${iki(d.getUTCDate())}`;
  }
  const t = v.trim();
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(t);
  if (m) return `${m[3]}-${iki(Number(m[2]))}-${iki(Number(m[1]))}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return etiketAnahtari(t);
}

const yerelGun = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : tarihAnahtari(ekipTarihi(iso));
};

/** BODY hücresi: yalnız rakamsa sayı (Excel'in makro girişini yaptığı gibi), değilse metin. */
const govdeHucresi = (g: string): string | number => (/^\d{1,15}$/.test(g) ? Number(g) : g);

interface Sayfa {
  yol: string;
  xml: string;
  parca: ReturnType<typeof sayfayiBol>;
  basSatir: number;
  /** Başlık (etiketAnahtari) → sütun harfi. */
  sutun: Map<string, string>;
  sonDolu: SatirParcasi;
}

function sayfaOku(ad: string, yol: string | undefined, metin: (yol: string) => string, metinler: readonly string[], gerekli: readonly string[]): Sayfa {
  if (!yol) throw new KullaniciHatasi(`Bu dosyada "${ad}" sayfası yok — ekibin NAS dosyası mı?`, `This file has no "${ad}" sheet — is it the team's NAS file?`);
  const xml = metin(yol);
  const parca = sayfayiBol(xml);
  // Başlık satırı: ilk 5 satır içinde gerekli başlıkların hepsini taşıyan.
  let basSatir = -1;
  const sutun = new Map<string, string>();
  for (const s of parca.satirlar.slice(0, 5)) {
    const m = new Map<string, string>();
    for (const h of satirHucreleri(s.xml)) {
      const v = hucreDegeri(h, metinler);
      if (typeof v === 'string' && v.trim() && !m.has(etiketAnahtari(v))) m.set(etiketAnahtari(v), h.sutun);
    }
    if (gerekli.every((g) => m.has(g))) { basSatir = s.no; for (const [k, v] of m) sutun.set(k, v); break; }
  }
  if (basSatir < 0) {
    throw new KullaniciHatasi(
      `"${ad}" sayfasında başlık satırı bulunamadı (aranan: ${gerekli.join(', ')}) — ekibin NAS dosyası mı?`,
      `No header row found on the "${ad}" sheet (looking for: ${gerekli.join(', ')}) — is it the team's NAS file?`,
    );
  }
  let sonDolu: SatirParcasi | undefined;
  for (let i = parca.satirlar.length - 1; i >= 0 && !sonDolu; i--) {
    const s = parca.satirlar[i]!;
    if (s.no <= basSatir) break;
    if (satirHucreleri(s.xml).some((h) => h.deger !== null && h.deger !== '')) sonDolu = s;
  }
  return { yol, xml, parca, basSatir, sutun, sonDolu: sonDolu ?? parca.satirlar.find((s) => s.no === basSatir)! };
}

/** Sayfanın veri satırları: başlık sütunu → değer. */
function kayitlar(s: Sayfa, metinler: readonly string[], basliklar: readonly string[]): Map<string, string | number | null>[] {
  const harf = basliklar.map((b) => [b, s.sutun.get(b)] as const);
  const sonuc: Map<string, string | number | null>[] = [];
  for (const satir of s.parca.satirlar) {
    if (satir.no <= s.basSatir) continue;
    sonuc.push(new Map(harf.map(([b, c]) => {
      const x = c ? satirHucresi(satir, c) : null;
      return [b, x ? hucreDegeri(x, metinler) : null] as const;
    })));
  }
  return sonuc;
}

/** Liste sayfasının (Part / Problems) değerleri: ilk 3 satırda başlığı aranan sütunun altı. */
function listeDegerleri(s: { parca: ReturnType<typeof sayfayiBol> } | null, metinler: readonly string[], basliklar: readonly string[]): string[] {
  if (!s) return [];
  let sutun: string | undefined;
  let bas = 0;
  for (const satir of s.parca.satirlar.slice(0, 3)) {
    for (const h of satirHucreleri(satir.xml)) {
      const v = hucreDegeri(h, metinler);
      if (typeof v === 'string' && basliklar.includes(etiketAnahtari(v))) { sutun = h.sutun; bas = satir.no; break; }
    }
    if (sutun) break;
  }
  if (!sutun) return [];
  const sonuc: string[] = [];
  for (const satir of s.parca.satirlar) {
    if (satir.no <= bas) continue;
    const h = satirHucreleri(satir.xml).find((x) => x.sutun === sutun);
    const v = h ? hucreDegeri(h, metinler) : null;
    if (typeof v === 'string' && v.trim()) sonuc.push(v);
  }
  return sonuc;
}

interface SatirSablonu { ozellik: string; stil: Map<string, string | null> }

/** Son dolu satırın görünüşü: satır özellikleri (yükseklik vb.) ve sütun başına stil. */
function satirSablonu(satir: SatirParcasi): SatirSablonu {
  const bas = /^<row\b([^>]*?)\/?>/.exec(satir.xml)?.[1] ?? '';
  const ozellik = bas.replace(/\s(?:r|hidden|collapsed|spans)="[^"]*"/g, '');
  return { ozellik, stil: new Map(satirHucreleri(satir.xml).map((h) => [h.sutun, h.stil] as const)) };
}

type Deger = string | number | null | undefined;

function satirXml(no: number, sablon: SatirSablonu, sutun: Map<string, string>, degerler: Record<string, Deger>): string {
  const yaz = new Map<string, Deger>();
  for (const [b, v] of Object.entries(degerler)) { const c = sutun.get(b); if (c) yaz.set(c, v); }
  const harfler = [...new Set([...sablon.stil.keys(), ...yaz.keys()])].sort((a, b) => sutunNo(a) - sutunNo(b));
  const hucreler = harfler.map((c) => {
    const s = sablon.stil.get(c);
    const oz = `r="${c}${no}"${s ? ` s="${s}"` : ''}`;
    const v = yaz.get(c);
    if (v === null || v === undefined || v === '') return `<c ${oz}/>`;
    if (typeof v === 'number') return `<c ${oz}><v>${v}</v></c>`;
    const koru = /^\s|\s$/.test(v) ? ' xml:space="preserve"' : '';
    return `<c ${oz} t="inlineStr"><is><t${koru}>${xmlKacis(v)}</t></is></c>`;
  });
  const sp = harfler.length ? ` spans="${sutunNo(harfler[0]!)}:${sutunNo(harfler[harfler.length - 1]!)}"` : '';
  return `<row r="${no}"${sp}${sablon.ozellik}>${hucreler.join('')}</row>`;
}

/** Yeni satırları son dolu satırın altına koyar; aradaki boş (biçimli) satırların yerini alır. */
function sayfayaEkle(s: Sayfa, yeni: string[]): string {
  if (!yeni.length) return s.xml;
  const ilk = s.sonDolu.no + 1;
  const son = s.sonDolu.no + yeni.length;
  const onceki = s.parca.satirlar.filter((x) => x.no < ilk).map((x) => x.xml);
  const sonraki = s.parca.satirlar.filter((x) => x.no > son).map((x) => x.xml);
  let once = s.parca.once;
  const boyut = /<dimension ref="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"\s*\/>/.exec(once);
  if (boyut) {
    const sonSatir = Math.max(Number(boyut[4] ?? boyut[2]), son, ...s.parca.satirlar.map((x) => x.no));
    const sonSutun = boyut[3] ?? boyut[1];
    once = once.replace(boyut[0], `<dimension ref="${boyut[1]}${boyut[2]}:${sonSutun}${sonSatir}"/>`);
  }
  return once + onceki.join('') + yeni.join('') + sonraki.join('') + s.parca.sonra;
}

/** Bütün parçalar (EV + içten yanmalı), kimliğe göre tekil. */
function tumParcalar(): ParcaKayit[] {
  const m = new Map<string, ParcaKayit>();
  for (const b of [...bolgelerAracIcin({ tip: 'ev' }), ...bolgelerAracIcin({ tip: 'ice' })]) {
    for (const p of b.parcalar) if (!m.has(p.id)) m.set(p.id, PARCA_INDEKS[p.id] ?? (p as ParcaKayit));
  }
  return [...m.values()];
}

const ayna = (id: string) =>
  id.startsWith('sol_') ? `sag_${id.slice(4)}` : id.startsWith('sag_') ? `sol_${id.slice(4)}` : undefined;

/** Gönderim anındaki değerle bugünkü arasındaki fark (Excel adındaki fark sayılmaz: o eşlemedir). */
export function degerFarki(eski: GonderimDegeri, yeni: GonderimDegeri): DegisenAlan[] {
  const f: DegisenAlan[] = [];
  const ekle = (alan: DegisenAlan['alan'], a: string | number, b: string | number) => {
    if (String(a) !== String(b)) f.push({ alan, eski: String(a), yeni: String(b) });
  };
  ekle('parca', eski.parca, yeni.parca);
  ekle('tip', eski.tip, yeni.tip);
  ekle('demerit', eski.demerit, yeni.demerit);
  ekle('sinif', eski.sinif, yeni.sinif);
  ekle('sistem', eski.sistem, yeni.sistem);
  ekle('takip', eski.takip, yeni.takip);
  ekle('onlem', eski.onlem.trim(), yeni.onlem.trim());
  return f;
}

export function ekipExceliniDoldur(
  sablon: Uint8Array, denetimler: readonly Denetim[], secenek: EkipExceliSecenekleri = {},
): DoldurmaSonucu {
  const girdiler = zipHamOku(sablon);
  const indeks = new Map(girdiler.map((g) => [g.ad, g] as const));
  const cozucu = new TextDecoder();
  const metin = (yol: string) => {
    const g = indeks.get(yol);
    if (!g) throw new KullaniciHatasi(`Dosyada ${yol} yok — Excel dosyası mı?`, `${yol} is missing from the file — is it an Excel file?`);
    return cozucu.decode(girdiyiAc(g));
  };
  if (!indeks.has('xl/workbook.xml')) throw new KullaniciHatasi('Bu bir Excel (xlsx/xlsm) dosyası değil.', 'This is not an Excel (xlsx/xlsm) file.');
  const yollar = sayfaYollari(metin('xl/workbook.xml'), metin('xl/_rels/workbook.xml.rels'));
  const metinler = indeks.has('xl/sharedStrings.xml') ? paylasilanMetinler(metin('xl/sharedStrings.xml')) : [];

  const araclar = sayfaOku(ARAC_SAYFASI, yollar.get(ARAC_SAYFASI), metin, metinler, ['NO', 'DATE', 'MODEL', 'BODY', 'UNICODECAR']);
  const problemler = sayfaOku(PROBLEM_SAYFASI, yollar.get(PROBLEM_SAYFASI), metin, metinler, ['NO', 'DATE', 'MODEL', 'BODY', 'PROBLEM PART', 'PROBLEM TYPE', 'UNICODE']);
  const listeSayfasi = (ad: string) => { const y = yollar.get(ad); return y ? { parca: sayfayiBol(metin(y)) } : null; };

  // Ekipte var olanlar: araçlar (UNICODECAR), problemler (UNICODE + gün).
  const varAraclar = new Set(kayitlar(araclar, metinler, ['UNICODECAR']).map((k) => etiketAnahtari(String(k.get('UNICODECAR') ?? ''))).filter(Boolean));
  const gecmis = kayitlar(problemler, metinler, ['UNICODE', 'DATE', 'PROBLEM PART', 'PROBLEM TYPE']);
  const varProblemler = new Map<string, number>();
  for (const k of gecmis) {
    const u = etiketAnahtari(String(k.get('UNICODE') ?? ''));
    if (!u) continue;
    const a = `${u}|${tarihAnahtari(k.get('DATE') ?? null)}`;
    varProblemler.set(a, (varProblemler.get(a) ?? 0) + 1);
  }

  // Etiket eşlemesi: ekibin listesi + kayıtlarda kullanılanlar.
  const metinMi = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
  const parcaEtiketleri = etiketleriTopla(
    listeDegerleri(listeSayfasi('Part'), metinler, ['PARÇA', 'PARCA', 'PART', 'PROBLEM PART']),
    gecmis.map((k) => k.get('PROBLEM PART')).filter(metinMi),
  );
  const tipEtiketleri = etiketleriTopla(
    listeDegerleri(listeSayfasi('Problems'), metinler, ['PROBLEM TYPE', 'PROBLEM']),
    gecmis.map((k) => k.get('PROBLEM TYPE')).filter(metinMi),
  );
  const hatalar = denetimler.flatMap((d) => d.hatalar ?? []);
  const gerekliParca = new Set(hatalar.flatMap((h) => (h.ikinciParcaId ? [h.parcaId, h.ikinciParcaId] : [h.parcaId])));
  const parcaEslemesi = etiketEslemesi(parcaEtiketleri, tumParcalar(), {
    kimlik: (p) => p.id, metin: (p) => parcaAramaMetni(p.id), adMetni: (p) => parcaAdMetni(p.id),
    kendiMetni: (p) => parcaKendiMetni(p.id), tamAdlar: (p) => [parcaTamAdi(p.id, 'en')], taraf: (p) => p.taraf,
    ayna, ciftler: true, gerekli: gerekliParca,
  });
  const tipEslemesi = etiketEslemesi(tipEtiketleri, tumHataTipleri(), {
    kimlik: (t) => t.id, metin: (t) => aramaMetni(t.ad, t.en), adMetni: (t) => aramaMetni(t.ad, t.en), tamAdlar: (t) => [t.en, t.ad],
    gerekli: new Set(hatalar.map((h) => h.hataTipiId)),
  });

  const esleme = new Map<string, EslemeSatiri>();
  const etiketSec = (tur: 'parca' | 'tip', anahtar: string, otomatik: EkipEtiketi | undefined, ad: { tr: string; en: string }) => {
    const elle = (tur === 'parca' ? secenek.elleEsleme?.parca : secenek.elleEsleme?.tip)?.[anahtar];
    const [yazilan, kaynak]: [string, EslemeSatiri['kaynak']] = elle !== undefined
      ? [elle || ad.en, elle ? 'elle' : 'uygulama']
      : otomatik ? [otomatik.ad, 'ekip'] : [ad.en, 'uygulama'];
    const k = `${tur}:${anahtar}`;
    const o = esleme.get(k);
    if (o) o.adet += 1; else esleme.set(k, { tur, anahtar, ad, yazilan, kaynak, adet: 1 });
    return yazilan;
  };
  const parcaEtiketi = (h: Hata) => {
    const anahtar = h.ikinciParcaId ? ciftAnahtari(h.parcaId, h.ikinciParcaId) : h.parcaId;
    return etiketSec('parca', anahtar, parcaEslemesi.get(anahtar), { tr: parcaCiftiAdi(h, 'tr'), en: parcaCiftiAdi(h, 'en') });
  };
  const tipEtiketi = (h: Hata) =>
    etiketSec('tip', h.hataTipiId, tipEslemesi.get(h.hataTipiId), { tr: hataTipiAdi(h.hataTipiId, 'tr'), en: hataTipiAdi(h.hataTipiId, 'en') });

  const fotografAdi = secenek.fotografAdi ?? yedektekiFotograf;
  const aracSablonu = satirSablonu(araclar.sonDolu);
  const problemSablonu = satirSablonu(problemler.sonDolu);
  const yeniArac: string[] = [];
  const yeniProblem: string[] = [];
  let aracZatenVar = 0, problemZatenVar = 0, altiHaneOlmayan = 0, baskaAdla = 0;
  const degisenler: DegisenHata[] = [];
  const gonderim: Record<string, GonderimIzi> = {};
  const simdiIso = (secenek.simdi ?? new Date()).toISOString();

  for (const d of [...denetimler].sort((a, b) => a.baslangic.localeCompare(b.baslangic))) {
    const kaynak = kaynakKodu(d.denetimTipi);
    const model = modelKodu(d.aracId);
    const govde = govdeNo(d);
    if (!/^\d{6}$/.test(govde)) altiHaneOlmayan += 1;
    const denetci = (d.denetci ?? '').toUpperCase();
    const aracAnahtari = `${kaynak}${model}${govde}`;
    if (varAraclar.has(etiketAnahtari(aracAnahtari))) {
      aracZatenVar += 1;
    } else {
      varAraclar.add(etiketAnahtari(aracAnahtari));
      const no = araclar.sonDolu.no + yeniArac.length + 1;
      yeniArac.push(satirXml(no, aracSablonu, araclar.sutun, {
        NO: no - araclar.basSatir, DATE: ekipTarihi(d.baslangic), 'PROBLEM SOURCE': kaynak, MODEL: model,
        BODY: govdeHucresi(govde), 'PROBLEM QTY': (d.hatalar ?? []).reduce((t, h) => t + (h.adet ?? 1), 0),
        AUDITOR: denetci, UNICODECAR: aracAnahtari,
      }));
    }
    for (const h of [...(d.hatalar ?? [])].sort((a, b) => a.zaman.localeCompare(b.zaman))) {
      const parcaAnahtari = h.ikinciParcaId ? ciftAnahtari(h.parcaId, h.ikinciParcaId) : h.parcaId;
      const parca = parcaEtiketi(h);
      const tip = tipEtiketi(h);
      const unicode = `${kaynak}${model}${govde}${parca}${tip}`;
      const anahtar = `${etiketAnahtari(unicode)}|${yerelGun(h.zaman)}`;
      const deger: GonderimDegeri = {
        parca: parcaAnahtari, parcaEtiketi: parca, tip: h.hataTipiId, tipEtiketi: tip,
        demerit: demeritDegeri(h), sinif: sinifDegeri(h), sistem: sistemDegeri(h),
        takip: h.durum ?? 'acik', onlem: h.onlem ?? '',
      };
      const zatenVar = () => {
        problemZatenVar += 1;
        const e = esleme.get(`parca:${parcaAnahtari}`);
        if (e) e.adet -= 1;
        const t = esleme.get(`tip:${h.hataTipiId}`);
        if (t) t.adet -= 1;
      };
      // Önce iz: bu hata daha önce gönderildiyse, o günkü anahtarıyla dosyada mı?
      const iz = secenek.gonderilen?.[h.id];
      if (iz && (varProblemler.get(iz.anahtar) ?? 0) > 0) {
        varProblemler.set(iz.anahtar, varProblemler.get(iz.anahtar)! - 1);
        zatenVar();
        const alanlar = degerFarki(iz.deger, deger);
        if (alanlar.length) {
          degisenler.push({ hataId: h.id, ad: { tr: `${parcaCiftiAdi(h, 'tr')} — ${hataTipiAdi(h.hataTipiId, 'tr')}`, en: `${parcaCiftiAdi(h, 'en')} — ${hataTipiAdi(h.hataTipiId, 'en')}` }, govde, gun: ekipTarihi(h.zaman), alanlar });
        } else if (iz.anahtar !== anahtar) {
          baskaAdla += 1;
        }
        continue;
      }
      const varOlan = varProblemler.get(anahtar) ?? 0;
      if (varOlan > 0) {
        varProblemler.set(anahtar, varOlan - 1);
        zatenVar();
        gonderim[h.id] = { anahtar, deger, tarih: iz?.tarih ?? simdiIso };
        continue;
      }
      gonderim[h.id] = { anahtar, deger, tarih: simdiIso };
      const no = problemler.sonDolu.no + yeniProblem.length + 1;
      const kapandi = h.durum === 'giderildi' || h.durum === 'kapali';
      yeniProblem.push(satirXml(no, problemSablonu, problemler.sutun, {
        NO: no - problemler.basSatir, DATE: ekipTarihi(h.zaman), 'PROBLEM SOURCE': kaynak, MODEL: model,
        BODY: govdeHucresi(govde), CLASS: sinifDegeri(h), DEMERIT: demeritDegeri(h), SYSTEM: sistemDegeri(h),
        'PROBLEM PART': parca, 'PROBLEM TYPE': tip,
        'EXTRA DETAIL': [h.konum, h.aciklama].filter(Boolean).join(', '),
        'PHOTO LINK': (h.fotograflar ?? []).map(fotografAdi).join(', '),
        RESPONSIBLE: h.sorumlu ?? '', AUDITOR: denetci, PROGRESS: ilerlemeKodu(h), COUNTERMEASURE: h.onlem ?? '',
        'CM APPLICATION DATE': kapandi && h.giderilmeZamani ? ekipTarihi(h.giderilmeZamani) : '',
        'VERIFICATION BODY NO': h.durum === 'kapali' ? h.dogrulamaBody ?? '' : '',
        UNICODE: unicode,
      }));
    }
  }

  const degisen = new Map<string, string>([
    [araclar.yol, sayfayaEkle(araclar, yeniArac)],
    [problemler.yol, sayfayaEkle(problemler, yeniProblem)],
  ]);
  const cikti: (ZipGirdisi | HamZipGirdisi)[] = girdiler.map((g) => {
    const yeni = degisen.get(g.ad);
    return yeni !== undefined && (g.ad === araclar.yol ? yeniArac.length : yeniProblem.length) ? { ad: g.ad, veri: yeni } : g;
  });

  const sik = (a: EkipEtiketi, b: EkipEtiketi) => b.sayi - a.sayi || Number(b.listede) - Number(a.listede) || a.ad.localeCompare(b.ad);
  return {
    bayt: zipOlustur(cikti),
    aracEklendi: yeniArac.length,
    aracZatenVar,
    problemEklendi: yeniProblem.length,
    problemZatenVar,
    baskaAdla,
    degisenler,
    gonderim,
    altiHaneOlmayan,
    esleme: [...esleme.values()].filter((e) => e.adet > 0),
    parcaEtiketleri: [...parcaEtiketleri].sort(sik),
    tipEtiketleri: [...tipEtiketleri].sort(sik),
  };
}
