// RAPOR ÜRETİMİ — Excel (.xlsx), CSV ve yazdırılabilir HTML.
//
// DÜZEN EKİBİN KENDİ TABLOSUNDAN (26.09.2026 ekran görüntüsü, "Part Related
// Issues" sayfası). Görülen sütunlar: A No · B Area · E Phase · F (sarı, "A")
// · G Issue · H Part/Complex · I Photo · J Source ("HMC Audit") · K Team ("QE
// Team 2") · L Responsible ("HMTR PD (HWASEUNG)").
//
// BİLİNMEYEN — UYDURULMADI: C ve D sütunlarının ne olduğu (sayılar), F'deki
// "A"nın anlamı (ekibin derecesi 1/2/3 ve parantez; F'ye derece kondu ama bu
// bir varsayım), B'deki bölge adlarının listesi (şimdilik kendi bölgelerimiz).
//
// Sütun düzeninin TEK kaynağı aşağıdaki SUTUNLAR dizisidir. `fotograf: true`
// işaretli sütun, fotoğrafların Excel'in İÇİNE gömüleceği sütundur.

import { Gorsel, Hucre, Sayfa } from './xlsx';
import { Denetim, Dil, FotografBaytlari, Hata, Ozet, RaporAyarlari } from './tipler';

/**
 * Sütun değerlerinin gördüğü bağlam. `denetim` ZORUNLU: faz, ekip ve kaynak
 * denetim düzeyindedir. İsteğe bağlı olsaydı unutulan bir çağrı bu üç sütunu
 * sessizce boş basardı.
 */
export interface SutunBaglami {
  dil: Dil;
  denetim: Pick<Denetim, 'faz' | 'ekip' | 'denetimTipi'>;
}

/** Excel'in bir sütunu. Şablon uyarlaması BU tipin örneklerini değiştirmektir. */
export interface Sutun {
  anahtar: string;
  baslik: string;
  baslikEn: string;
  genislik: number;
  stil?: number | null;
  /** Fotoğrafların gömüleceği sütun. Tam olarak bir sütunda true olmalı. */
  fotograf?: boolean;
  deger: (h: Hata, i: number, c: SutunBaglami) => string | number;
  stilSecici?: (h: Hata) => number;
}

import { xlsxOlustur, STIL, gosterimOlcusu, pikselPunto, sutunAdi } from './xlsx';
import { bastanKucult, DERECELER, HATA_TIPI_INDEKS, PARCA_INDEKS, parcaTamAdi } from './katalog';
import { denetimOzeti, dereceGosterimi, hataKodu, topluOzet } from './puan';
import { ARAC_INDEKS } from './model3d';
import { kmGoster } from './aracBilgisi';

/**
 * Ekibin tablosundaki "Issue" sütunu: bölge sütunu olmadan da tek başına
 * okunan bir satır. Ekibin kendi yazımı örnek alındı — "FR door trim wrinkle
 * - quadrant inner & near B PLR" — yani `{parça} {hata} - {ayrıntı}`.
 *
 * Parça adı TARAF İÇERİR (`parcaTamAdi`): "LH front fender scratch". Taraf
 * olmadan "Front fender scratch" hangi çamurluk olduğunu söylemiyordu.
 */
export function sorunMetni(
  h: Pick<Hata, 'parcaId' | 'hataTipiId' | 'konum' | 'aciklama' | 'adet'>,
  dil: Dil,
): string {
  const parca = parcaTamAdi(h.parcaId, dil);
  const t = HATA_TIPI_INDEKS[h.hataTipiId];
  // Ekibin eklediği tipin İngilizcesi boş bırakılabiliyor. Boşsa Türkçe adı
  // yaz: "LH front fender " diye yarım bir cümle çıkmasın.
  const tipAd = t ? (dil === 'en' ? (t.en || t.ad) : t.ad) : h.hataTipiId;
  const ayrinti = [h.konum, h.aciklama].map((x) => (x ?? '').trim()).filter(Boolean).join(', ');
  const adet = (h.adet ?? 1) > 1 ? (dil === 'en' ? ` (x${h.adet})` : ` (${h.adet} adet)`) : '';
  if (dil === 'en') {
    return `${parca} ${bastanKucult(tipAd, 'en')}${ayrinti ? ` - ${ayrinti}` : ''}${adet}`;
  }
  return `${parca} — ${tipAd}${ayrinti ? ` — ${ayrinti}` : ''}${adet}`;
}

/** Fotoğrafın Excel'de kaplayacağı en büyük ölçü (piksel). */
export const FOTO_EN = 150;
export const FOTO_BOY = 112;

const bicimTarih = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};
const bicimSaat = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// SÜTUN DÜZENİ — şablonunuza uyarlanacak tek nokta
// ---------------------------------------------------------------------------
export const SUTUNLAR: Sutun[] = [
  // Ekibin tablosu:          A              B               E               F?              G               H               I               J               K               L
  { anahtar: 'no',      baslik: 'No',        baslikEn: 'No',          genislik: 5,  stil: STIL.SAYI,       deger: (h, i) => i + 1 },
  { anahtar: 'alan',    baslik: 'Bölge',     baslikEn: 'Area',        genislik: 22, stil: STIL.GOVDE,      deger: (h, i, c) => (c.dil === 'en' ? PARCA_INDEKS[h.parcaId]?.bolgeEn : PARCA_INDEKS[h.parcaId]?.bolgeAd) ?? '' },
  { anahtar: 'faz',     baslik: 'Faz',       baslikEn: 'Phase',       genislik: 8,  stil: STIL.GOVDE_ORTA, deger: (h, i, c) => c.denetim.faz },
  { anahtar: 'derece',  baslik: 'Derece',    baslikEn: 'Grade',       genislik: 8,  stil: null,            deger: (h) => dereceGosterimi(h), stilSecici: (h) => (h.kabulEdilebilir ? STIL.GOVDE_ORTA : ({ '3': STIL.DERECE_3, '2': STIL.DERECE_2, '1': STIL.DERECE_1 }[h.derece] ?? STIL.GOVDE_ORTA)) },
  { anahtar: 'sorun',   baslik: 'Sorun',     baslikEn: 'Issue',       genislik: 52, stil: STIL.GOVDE,      deger: (h, i, c) => sorunMetni(h, c.dil) },
  { anahtar: 'tip',     baslik: 'Tür',       baslikEn: 'Type',        genislik: 10, stil: STIL.GOVDE_ORTA, deger: (h) => h.sorunTipi ?? 'Part' },
  { anahtar: 'foto',    baslik: 'Fotoğraf',  baslikEn: 'Photo',       genislik: 24, stil: STIL.GOVDE,      fotograf: true, deger: () => '' },
  { anahtar: 'kaynak',  baslik: 'Kaynak',    baslikEn: 'Source',      genislik: 14, stil: STIL.GOVDE_ORTA, deger: (h, i, c) => c.denetim.denetimTipi },
  { anahtar: 'ekip',    baslik: 'Ekip',      baslikEn: 'Team',        genislik: 14, stil: STIL.GOVDE_ORTA, deger: (h, i, c) => c.denetim.ekip },
  { anahtar: 'sorumlu', baslik: 'Sorumlu',   baslikEn: 'Responsible', genislik: 24, stil: STIL.GOVDE,      deger: (h) => h.sorumlu ?? '' },
];

const baslikMetni = (s: Sutun, dil: Dil): string => (dil === 'en' ? s.baslikEn : s.baslik);

/** Üst bilgi bloğundaki etiket/değer çiftleri. */
function ustBilgiCiftleri(denetim: Denetim, ozet: Ozet, dil: Dil): (string | number)[][] {
  const arac = ARAC_INDEKS[denetim.aracId];
  const E = (tr: string, en: string): string => (dil === 'en' ? en : tr);
  // Hat ve vardiya formdan kaldırıldı (28.09.2026). Yeni denetimde boş
  // "Line / Shift" satırı basılmaz; eski bir denetimde doluysa kaybolmasın.
  const hatVardiya = [denetim.hat, denetim.vardiya].filter(Boolean).join(' / ');
  return [
    [E('Araç', 'Vehicle'), arac?.tam ?? denetim.aracId ?? '', E('Şasi No (VIN)', 'VIN'), denetim.vin || '', E('Tarih', 'Date'), bicimTarih(denetim.baslangic)],
    [E('Faz', 'Phase'), denetim.faz || '', E('Ekip', 'Team'), denetim.ekip || '', E('Kaynak', 'Source'), denetim.denetimTipi || ''],
    // Spec ve km 28.09.2026'da eklendi; eski denetimde boş kalırlar.
    [E('Denetçi', 'Auditor'), denetim.denetci || '', 'Spec', denetim.spec || '', E('Kilometre', 'Mileage'), kmGoster(denetim.km, dil)],
    hatVardiya
      ? [E('Rapor No', 'Report No'), denetim.raporNo || '', E('Hat / Vardiya', 'Line / Shift'), hatVardiya]
      : [E('Rapor No', 'Report No'), denetim.raporNo || ''],
    [E('Toplam bulgu', 'Total findings'), ozet.toplamAdet, E('Kabul edilebilir (n)', 'Acceptable (n)'), ozet.kabulEdilebilirAdet, E('Fotoğraflı', 'With photo'), ozet.fotografliHata],
  ];
}

/**
 * Denetimin Excel çalışma kitabını üretir.
 * @param {object} denetim
 * @param {Map<string,{bayt:Uint8Array}>} fotograflar fotoId -> bayt
 * @param {{dil?:'tr'|'en', esikler?:object}} [ayarlar]
 * @returns {Uint8Array}
 */
export function excelUret(
  denetim: Denetim,
  fotograflar: Map<string, FotografBaytlari> = new Map(),
  ayarlar: RaporAyarlari = {},
): Uint8Array {
  const dil = ayarlar.dil ?? 'tr';
  const baglam: SutunBaglami = { dil, denetim };
  const ozet = denetimOzeti(denetim);
  const hatalar = denetim.hatalar ?? [];
  const sutunSayisi = SUTUNLAR.length;
  const fotoSutunu = SUTUNLAR.findIndex((s) => s.fotograf);

  const satirlar: Hucre[][] = [];
  const birlesikler: string[] = [];

  // Başlık — ekibin tablosundaki biçim: "{araç} {faz} — Part-Related Issues ({ekip}, {tarih})"
  satirlar.push([{ v: raporBasligi(denetim, dil), stil: STIL.BASLIK_BUYUK }]);
  birlesikler.push(`A1:${sutunAdi(sutunSayisi - 1)}1`);
  satirlar.push([]);

  // Üst bilgi bloğu — her satırda üç etiket/değer çifti
  const bolum = Math.floor(sutunSayisi / 3);
  for (const cift of ustBilgiCiftleri(denetim, ozet, dil)) {
    const satir: Hucre[] = new Array(sutunSayisi).fill('');
    // Bir satırda üçten az çift olabilir (hat/vardiya boşken denetçi satırı
    // iki çifttir); eksik çift için biçimli boş etiket hücresi basılmaz.
    for (let g = 0; g < 3 && g * 2 < cift.length; g++) {
      const etiketSutun = g * bolum;
      satir[etiketSutun] = { v: cift[g * 2], stil: STIL.ETIKET };
      satir[etiketSutun + 1] = { v: cift[g * 2 + 1], stil: STIL.GOVDE };
      const son = g === 2 ? sutunSayisi - 1 : (g + 1) * bolum - 1;
      if (son > etiketSutun + 1) {
        birlesikler.push(`${sutunAdi(etiketSutun + 1)}${satirlar.length + 1}:${sutunAdi(son)}${satirlar.length + 1}`);
      }
    }
    satirlar.push(satir);
  }

  satirlar.push([]);
  const tabloBaslikSatiri = satirlar.length;
  satirlar.push(SUTUNLAR.map((s) => ({ v: baslikMetni(s, dil), stil: STIL.BASLIK })));

  // Hata satırları
  const gorseller: Gorsel[] = [];
  const satirYukseklikleri: Record<number, number> = {};
  let enFazlaFoto = 1;

  hatalar.forEach((h, i) => {
    const satirNo = satirlar.length;
    satirlar.push(SUTUNLAR.map((s) => ({
      v: s.deger(h, i, baglam),
      stil: s.stilSecici ? s.stilSecici(h) : (s.stil ?? STIL.GOVDE),
    })));

    const fotolar = (h.fotograflar ?? []).map((fid) => fotograflar.get(fid)).filter((f): f is FotografBaytlari => !!f?.bayt?.length);
    if (fotolar.length === 0) return;

    enFazlaFoto = Math.max(enFazlaFoto, fotolar.length);
    let kayma = 0;
    let enYuksek = 0;
    fotolar.forEach((f, fi) => {
      const olcu = gosterimOlcusu(f.bayt, FOTO_EN, FOTO_BOY);
      gorseller.push({
        satir: satirNo, sutun: fotoSutunu, veri: f.bayt,
        gosterEn: olcu.en, gosterBoy: olcu.boy, xKayma: kayma,
        ad: `${hataKodu(h)} foto ${fi + 1}`,
        // Fotoğrafın açıklaması tablodaki satırla AYNI metin: taraflı ve raporun dilinde.
        aciklama: sorunMetni(h, dil),
      });
      kayma += olcu.en + 6;
      enYuksek = Math.max(enYuksek, olcu.boy);
    });
    satirYukseklikleri[satirNo] = pikselPunto(enYuksek + 12);
  });

  if (hatalar.length === 0) {
    satirlar.push([{ v: dil === 'en' ? 'No defects recorded.' : 'Hata kaydedilmedi.', stil: STIL.GOVDE }]);
  }

  // Fotoğraf sütunu, yan yana gelen fotoğrafları alacak kadar genişletilir
  const sutunGenislikleri = SUTUNLAR.map((s) => s.genislik);
  if (gorseller.length) {
    const gerekliPiksel = enFazlaFoto * (FOTO_EN + 6) + 10;
    sutunGenislikleri[fotoSutunu] = Math.max(s_piksel(sutunGenislikleri[fotoSutunu]), gerekliPiksel) / 7;
  }

  const sonSatir = satirlar.length;
  const raporSayfasi: Sayfa = {
    ad: dil === 'en' ? 'Part Related Issues' : 'Parçaya Bağlı Sorunlar',
    satirlar,
    sutunGenislikleri,
    satirYukseklikleri,
    birlesikler,
    dondur: { satir: tabloBaslikSatiri + 1, sutun: 0 },
    filtre: `A${tabloBaslikSatiri + 1}:${sutunAdi(sutunSayisi - 1)}${Math.max(sonSatir, tabloBaslikSatiri + 2)}`,
    gorseller,
  };

  return xlsxOlustur([raporSayfasi, ozetSayfasi(denetim, ozet, dil)], {
    baslik: `${denetim.vin || 'Denetim'} — ${dil === 'en' ? 'Vehicle Audit' : 'Araç Denetimi'}`,
    yazar: denetim.denetci || 'Arac Audit',
  });
}

/** Rapor başlığı; ekibin tablosunun ilk satırı örnek alındı. */
export function raporBasligi(denetim: Denetim, dil: Dil): string {
  const arac = ARAC_INDEKS[denetim.aracId]?.tam ?? denetim.aracId ?? '';
  const sol = [arac, denetim.faz].filter(Boolean).join(' ');
  const parantez = [denetim.ekip, bicimTarih(denetim.baslangic).slice(0, 10)].filter(Boolean).join(', ');
  const ad = dil === 'en' ? 'Part-Related Issues' : 'Parçaya Bağlı Sorunlar';
  return `${sol} — ${ad}${parantez ? ` (${parantez})` : ''}`;
}

/** Excel sütun genişliği (karakter) -> piksel. */
function s_piksel(genislik?: number): number { return (genislik ?? 8) * 7 + 5; }

/** Özet sayfası: bölge, şiddet ve hata grubu dağılımı. */
function ozetSayfasi(denetim: Denetim, ozet: Ozet, dil: Dil): Sayfa {
  const E = (tr: string, en: string): string => (dil === 'en' ? en : tr);
  const satirlar: Hucre[][] = [
    [{ v: E('ÖZET', 'SUMMARY'), stil: STIL.BASLIK_BUYUK }],
    [],
    [{ v: E('Kayıt sayısı', 'Records'), stil: STIL.ETIKET }, { v: ozet.toplamHata, stil: STIL.SAYI }],
    [{ v: E('Toplam bulgu', 'Total findings'), stil: STIL.ETIKET }, { v: ozet.toplamAdet, stil: STIL.SAYI }],
    [{ v: E('Kabul edilebilir (n)', 'Acceptable (n)'), stil: STIL.ETIKET }, { v: ozet.kabulEdilebilirAdet, stil: STIL.SAYI }],
    [{ v: E('Fotoğraflı hata', 'With photo'), stil: STIL.ETIKET }, { v: ozet.fotografliHata, stil: STIL.SAYI }],
    [{ v: E('Fotoğrafsız hata', 'Without photo'), stil: STIL.ETIKET }, { v: ozet.fotografsizHata, stil: STIL.SAYI }],
    [],
    [{ v: E('DERECEYE GÖRE', 'BY GRADE'), stil: STIL.ETIKET }],
    [{ v: E('Derece', 'Grade'), stil: STIL.BASLIK }, { v: E('Hata', 'Defects'), stil: STIL.BASLIK },
     { v: E('Kabul edilebilir', 'Acceptable'), stil: STIL.BASLIK }],
  ];
  for (const s of DERECELER) {
    const d = ozet.dereceDagilimi[s.id] ?? { adet: 0, kabul: 0 };
    satirlar.push([
      { v: s.id, stil: { '3': STIL.DERECE_3, '2': STIL.DERECE_2, '1': STIL.DERECE_1 }[s.id] },
      { v: d.adet, stil: STIL.SAYI }, { v: d.kabul, stil: STIL.SAYI },
    ]);
  }

  satirlar.push([], [{ v: E('BÖLGEYE GÖRE', 'BY ZONE'), stil: STIL.ETIKET }],
    [{ v: E('Bölge', 'Zone'), stil: STIL.BASLIK }, { v: E('Adet', 'Qty'), stil: STIL.BASLIK }]);
  for (const b of ozet.bolgeDagilimi) {
    satirlar.push([{ v: b.ad, stil: STIL.GOVDE }, { v: b.adet, stil: STIL.SAYI }]);
  }

  satirlar.push([], [{ v: E('EN ÇOK HATA ALAN PARÇALAR', 'TOP PARTS'), stil: STIL.ETIKET }],
    [{ v: E('Parça', 'Part'), stil: STIL.BASLIK }, { v: E('Bölge', 'Zone'), stil: STIL.BASLIK }, { v: E('Adet', 'Qty'), stil: STIL.BASLIK }]);
  for (const p of ozet.parcaDagilimi.slice(0, 20)) {
    satirlar.push([{ v: p.ad, stil: STIL.GOVDE }, { v: p.bolgeAd, stil: STIL.GOVDE }, { v: p.adet, stil: STIL.SAYI }]);
  }

  return { ad: E('Özet', 'Summary'), satirlar, sutunGenislikleri: [34, 12, 14, 52] };
}

/**
 * Birden çok denetimi tek kitapta toplar (vardiya/hat raporu).
 * Fotoğraflar yalnızca ilk sayfada değil, her aracın kendi sayfasında yer alır.
 */
export function topluExcelUret(
  denetimler: Denetim[],
  fotograflar: Map<string, FotografBaytlari> = new Map(),
  ayarlar: RaporAyarlari = {},
): Uint8Array {
  const dil = ayarlar.dil ?? 'tr';
  const E = (tr: string, en: string): string => (dil === 'en' ? en : tr);
  const toplu = topluOzet(denetimler);

  const satirlar: Hucre[][] = [
    [{ v: E('TOPLU DENETİM RAPORU', 'BATCH AUDIT REPORT'), stil: STIL.BASLIK_BUYUK }],
    [],
    [{ v: E('Denetlenen araç', 'Vehicles audited'), stil: STIL.ETIKET }, { v: toplu.aracSayisi, stil: STIL.SAYI }],
    [{ v: E('Toplam bulgu', 'Total findings'), stil: STIL.ETIKET }, { v: toplu.toplamAdet, stil: STIL.SAYI }],
    [{ v: E('Kabul edilebilir (n)', 'Acceptable (n)'), stil: STIL.ETIKET }, { v: toplu.kabulAdet, stil: STIL.SAYI }],
    [{ v: 'DPU (Defects Per Unit)', stil: STIL.ETIKET }, { v: toplu.dpu, stil: STIL.SAYI }],
    [],
    [{ v: E('ARAÇLAR', 'VEHICLES'), stil: STIL.ETIKET }],
    [E('Şasi No', 'VIN'), E('Plaka', 'Plate'), E('Araç', 'Vehicle'), E('Faz', 'Phase'), E('Tarih', 'Date'),
     E('Denetçi', 'Auditor'), E('Bulgu', 'Findings')].map((v) => ({ v, stil: STIL.BASLIK })),
  ];

  for (const { denetim, ozet } of toplu.ozetler) {
    satirlar.push([
      { v: denetim.vin ?? '', stil: STIL.GOVDE },
      { v: denetim.plaka || '—', stil: STIL.GOVDE },
      { v: ARAC_INDEKS[denetim.aracId]?.ad ?? denetim.aracId ?? '', stil: STIL.GOVDE },
      { v: denetim.faz ?? '', stil: STIL.GOVDE_ORTA },
      { v: bicimTarih(denetim.baslangic), stil: STIL.GOVDE_ORTA },
      { v: denetim.denetci ?? '', stil: STIL.GOVDE },
      { v: ozet.toplamAdet, stil: STIL.SAYI },
    ]);
  }

  satirlar.push([], [{ v: E('EN SIK TEKRARLAYAN PARÇALAR', 'MOST FREQUENT PARTS'), stil: STIL.ETIKET }],
    [E('Parça', 'Part'), E('Bölge', 'Zone'), E('Toplam adet', 'Total qty'), E('Kaç araçta', 'Vehicles affected')]
      .map((v) => ({ v, stil: STIL.BASLIK })));
  for (const p of toplu.enSikParcalar) {
    satirlar.push([{ v: p.ad, stil: STIL.GOVDE }, { v: p.bolgeAd, stil: STIL.GOVDE },
      { v: p.adet, stil: STIL.SAYI }, { v: p.aracSayisi, stil: STIL.SAYI }]);
  }

  const sayfalar: Sayfa[] = [{
    ad: E('Toplu Özet', 'Batch Summary'), satirlar,
    sutunGenislikleri: [22, 14, 16, 8, 18, 18, 10],
    dondur: { satir: 9, sutun: 0 },
  }];

  // Her araç kendi sayfasına — fotoğraflar dahil
  for (const d of denetimler) {
    const tekKitap = tekSayfaVerisi(d, fotograflar, dil);
    sayfalar.push(tekKitap);
  }

  return xlsxOlustur(sayfalar, { baslik: E('Toplu Denetim Raporu', 'Batch Audit Report'), yazar: ayarlar.yazar });
}

/** topluExcelUret için: tek aracın sayfa tanımını (fotoğraflarıyla) üretir. */
function tekSayfaVerisi(denetim: Denetim, fotograflar: Map<string, FotografBaytlari>, dil: Dil): Sayfa {
  const baglam: SutunBaglami = { dil, denetim };
  const hatalar = denetim.hatalar ?? [];
  const fotoSutunu = SUTUNLAR.findIndex((s) => s.fotograf);
  const satirlar: Hucre[][] = [SUTUNLAR.map((s) => ({ v: baslikMetni(s, dil), stil: STIL.BASLIK }))];
  const gorseller: Gorsel[] = [];
  const satirYukseklikleri: Record<number, number> = {};

  hatalar.forEach((h, i) => {
    const satirNo = satirlar.length;
    satirlar.push(SUTUNLAR.map((s) => ({
      v: s.deger(h, i, baglam),
      stil: s.stilSecici ? s.stilSecici(h) : (s.stil ?? STIL.GOVDE),
    })));
    const fotolar = (h.fotograflar ?? []).map((fid) => fotograflar.get(fid)).filter((f): f is FotografBaytlari => !!f?.bayt?.length);
    let kayma = 0, enYuksek = 0;
    for (const [fi, f] of fotolar.entries()) {
      const olcu = gosterimOlcusu(f.bayt, FOTO_EN, FOTO_BOY);
      gorseller.push({ satir: satirNo, sutun: fotoSutunu, veri: f.bayt, gosterEn: olcu.en, gosterBoy: olcu.boy, xKayma: kayma, ad: `${hataKodu(h)} foto ${fi + 1}` });
      kayma += olcu.en + 6; enYuksek = Math.max(enYuksek, olcu.boy);
    }
    if (enYuksek) satirYukseklikleri[satirNo] = pikselPunto(enYuksek + 12);
  });

  const ad = (denetim.vin || denetim.plaka || denetim.id || 'Arac').slice(-12);
  return {
    ad, satirlar,
    sutunGenislikleri: SUTUNLAR.map((s) => s.genislik),
    satirYukseklikleri, gorseller, dondur: { satir: 1, sutun: 0 },
  };
}

// --- CSV -------------------------------------------------------------------

/** Excel'in Türkçe yerelinde bozulmaması için ayraç ";" ve BOM eklenir. */
export function csvUret(denetim: Denetim, ayarlar: RaporAyarlari = {}): string {
  const dil = ayarlar.dil ?? 'tr';
  const baglam: SutunBaglami = { dil, denetim };
  const kacis = (v: unknown): string => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const basliklar = [...SUTUNLAR.filter((s) => !s.fotograf).map((s) => baslikMetni(s, dil)),
    dil === 'en' ? 'Photo count' : 'Fotoğraf adedi'];
  const satirlar = (denetim.hatalar ?? []).map((h, i) => [
    ...SUTUNLAR.filter((s) => !s.fotograf).map((s) => s.deger(h, i, baglam)),
    (h.fotograflar ?? []).length,
  ]);
  return '﻿' + [basliklar, ...satirlar].map((r) => r.map(kacis).join(';')).join('\r\n');
}

// --- YAZDIRILABİLİR HTML ---------------------------------------------------

/**
 * Ekranda gösterilen / yazdırılan rapor.
 * @param {object} denetim
 * @param {Map<string,{url:string}>} fotoUrlleri fotoId -> nesne URL'si
 */
export function htmlRapor(
  denetim: Denetim,
  fotoUrlleri: Map<string, { url: string }> = new Map(),
  ayarlar: RaporAyarlari = {},
): string {
  const dil = ayarlar.dil ?? 'tr';
  const baglam: SutunBaglami = { dil, denetim };
  const ozet = denetimOzeti(denetim);
  const arac = ARAC_INDEKS[denetim.aracId];
  const kacisHaritasi: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const g = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => kacisHaritasi[c] ?? c);
  const E = (tr: string, en: string): string => (dil === 'en' ? en : tr);

  const ustBilgi = ustBilgiCiftleri(denetim, ozet, dil)
    .flatMap((satir) => [[satir[0], satir[1]], [satir[2], satir[3]], [satir[4], satir[5]]]
      .filter(([e]) => e !== undefined))
    .map(([e, d]) => `<div class="r-alan"><span>${g(e)}</span><strong>${g(d)}</strong></div>`).join('');

  const gorunurSutunlar = SUTUNLAR;
  const basliklar = gorunurSutunlar.map((s) => `<th>${g(baslikMetni(s, dil))}</th>`).join('');

  const govde = (denetim.hatalar ?? []).map((h, i) => {
    const hucreler = gorunurSutunlar.map((s) => {
      if (s.fotograf) {
        const foto = (h.fotograflar ?? [])
          .map((fid) => fotoUrlleri.get(fid))
          .filter((f): f is { url: string } => !!f?.url);
        return `<td class="r-foto">${foto.map((f) => `<img src="${g(f.url)}" alt="">`).join('')}</td>`;
      }
      const sinif = s.anahtar === 'derece' ? ` class="r-s r-s${g(h.derece)}"` : '';
      return `<td${sinif}>${g(s.deger(h, i, baglam))}</td>`;
    }).join('');
    return `<tr>${hucreler}</tr>`;
  }).join('');

  return `<section class="rapor">
<header><h1>${E('Araç Denetim Raporu', 'Vehicle Audit Report')}</h1>
<p class="r-arac">${g(arac?.tam ?? denetim.aracId ?? '')} · ${g(denetim.vin ?? '')}</p></header>
<div class="r-izgara">${ustBilgi}</div>
<div class="r-kaydir"><table class="r-tablo"><thead><tr>${basliklar}</tr></thead><tbody>${govde || `<tr><td colspan="${gorunurSutunlar.length}">${E('Hata kaydedilmedi.', 'No defects recorded.')}</td></tr>`}</tbody></table></div>
</section>`;
}

export { bicimTarih, bicimSaat };
