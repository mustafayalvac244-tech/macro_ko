// RAPOR ÜRETİMİ — Excel (.xlsx), CSV ve yazdırılabilir HTML.
//
// ŞABLONA UYARLAMA: Excel'in sütun düzeni TEK BİR YERDEN, aşağıdaki SUTUNLAR
// dizisinden gelir. Kendi şablonunuzu gönderdiğinizde değiştirilecek yer
// yalnızca burasıdır — sıra, başlık, genişlik ve hücre değeri. `fotograf: true`
// işaretli sütun, fotoğrafların Excel'in İÇİNE gömüleceği sütundur.

import { xlsxOlustur, STIL, gosterimOlcusu, pikselPunto, sutunAdi } from './xlsx.js';
import { PARCA_INDEKS, HATA_TIPI_INDEKS, HATA_GRUPLARI, SIDDETLER } from './katalog.js';
import { denetimOzeti, hataKodu, SIDDET_INDEKS, topluOzet } from './puan.js';
import { ARAC_INDEKS } from './model3d.js';

/** Fotoğrafın Excel'de kaplayacağı en büyük ölçü (piksel). */
export const FOTO_EN = 150;
export const FOTO_BOY = 112;

const bicimTarih = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const iki = (n) => String(n).padStart(2, '0');
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};
const bicimSaat = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// SÜTUN DÜZENİ — şablonunuza uyarlanacak tek nokta
// ---------------------------------------------------------------------------
export const SUTUNLAR = [
  { anahtar: 'sira',    baslik: '#',                  baslikEn: '#',                genislik: 5,  stil: STIL.SAYI,       deger: (h, i) => i + 1 },
  { anahtar: 'kod',     baslik: 'Hata Kodu',          baslikEn: 'Defect Code',      genislik: 24, stil: STIL.GOVDE,      deger: (h) => hataKodu(h) },
  { anahtar: 'bolge',   baslik: 'Bölge',              baslikEn: 'Zone',             genislik: 20, stil: STIL.GOVDE,      deger: (h, i, c) => (c.dil === 'en' ? PARCA_INDEKS[h.parcaId]?.bolgeEn : PARCA_INDEKS[h.parcaId]?.bolgeAd) ?? '' },
  { anahtar: 'parca',   baslik: 'Parça',              baslikEn: 'Part',             genislik: 26, stil: STIL.GOVDE,      deger: (h, i, c) => (c.dil === 'en' ? PARCA_INDEKS[h.parcaId]?.en : PARCA_INDEKS[h.parcaId]?.ad) ?? h.parcaId },
  { anahtar: 'hata',    baslik: 'Hata Tipi',          baslikEn: 'Defect',           genislik: 24, stil: STIL.GOVDE,      deger: (h, i, c) => (c.dil === 'en' ? HATA_TIPI_INDEKS[h.hataTipiId]?.en : HATA_TIPI_INDEKS[h.hataTipiId]?.ad) ?? h.hataTipiId },
  { anahtar: 'grup',    baslik: 'Hata Grubu',         baslikEn: 'Defect Group',     genislik: 18, stil: STIL.GOVDE,      deger: (h, i, c) => { const g = HATA_GRUPLARI[HATA_TIPI_INDEKS[h.hataTipiId]?.grup]; return (c.dil === 'en' ? g?.en : g?.ad) ?? ''; } },
  { anahtar: 'siddet',  baslik: 'Şiddet',             baslikEn: 'Severity',         genislik: 9,  stil: null,            deger: (h) => h.siddet, stilSecici: (h) => ({ A: STIL.SIDDET_A, B: STIL.SIDDET_B, C: STIL.SIDDET_C }[h.siddet] ?? STIL.GOVDE_ORTA) },
  { anahtar: 'adet',    baslik: 'Adet',               baslikEn: 'Qty',              genislik: 7,  stil: STIL.SAYI,       deger: (h) => h.adet ?? 1 },
  { anahtar: 'puan',    baslik: 'Ceza Puanı',         baslikEn: 'Demerit',          genislik: 11, stil: STIL.SAYI,       deger: (h) => (SIDDET_INDEKS[h.siddet]?.puan ?? 0) * (h.adet ?? 1) },
  { anahtar: 'konum',   baslik: 'Konum / Açıklama',   baslikEn: 'Location / Note',  genislik: 34, stil: STIL.GOVDE,      deger: (h) => [h.konum, h.aciklama].filter(Boolean).join(' — ') },
  { anahtar: 'foto',    baslik: 'Fotoğraf',           baslikEn: 'Photo',            genislik: 24, stil: STIL.GOVDE,      fotograf: true, deger: () => '' },
  { anahtar: 'saat',    baslik: 'Tespit Saati',       baslikEn: 'Time',             genislik: 12, stil: STIL.GOVDE_ORTA, deger: (h) => bicimSaat(h.zaman) },
  { anahtar: 'durum',   baslik: 'Durum',              baslikEn: 'Status',           genislik: 12, stil: STIL.GOVDE_ORTA, deger: (h) => (h.durum === 'kapali' ? 'Kapatıldı' : 'Açık') },
];

const baslikMetni = (s, dil) => (dil === 'en' ? s.baslikEn : s.baslik);

/** Üst bilgi bloğundaki etiket/değer çiftleri. */
function ustBilgiCiftleri(denetim, ozet, dil) {
  const arac = ARAC_INDEKS[denetim.aracId];
  const E = (tr, en) => (dil === 'en' ? en : tr);
  return [
    [E('Rapor No', 'Report No'), denetim.raporNo || '', E('Araç', 'Vehicle'), arac?.tam ?? denetim.aracId ?? '', E('Denetim Tarihi', 'Audit Date'), bicimTarih(denetim.baslangic)],
    [E('Şasi No (VIN)', 'VIN'), denetim.vin || '', E('Plaka', 'Plate'), denetim.plaka || '—', E('Denetçi', 'Auditor'), denetim.denetci || ''],
    [E('Üretim Hattı', 'Line'), denetim.hat || '', E('Vardiya', 'Shift'), denetim.vardiya || '', E('Denetim Tipi', 'Audit Type'), denetim.denetimTipi || ''],
    [E('Toplam Hata', 'Total Defects'), ozet.toplamAdet, E('Toplam Ceza Puanı', 'Total Demerit'), ozet.toplamPuan, E('SONUÇ', 'RESULT'), dil === 'en' ? ozet.sonuc.en : ozet.sonuc.ad],
  ];
}

/**
 * Denetimin Excel çalışma kitabını üretir.
 * @param {object} denetim
 * @param {Map<string,{bayt:Uint8Array}>} fotograflar fotoId -> bayt
 * @param {{dil?:'tr'|'en', esikler?:object}} [ayarlar]
 * @returns {Uint8Array}
 */
export function excelUret(denetim, fotograflar = new Map(), ayarlar = {}) {
  const dil = ayarlar.dil ?? 'tr';
  const baglam = { dil };
  const ozet = denetimOzeti(denetim, ayarlar.esikler);
  const hatalar = denetim.hatalar ?? [];
  const sutunSayisi = SUTUNLAR.length;
  const fotoSutunu = SUTUNLAR.findIndex((s) => s.fotograf);

  const satirlar = [];
  const birlesikler = [];

  // Başlık
  satirlar.push([{ v: dil === 'en' ? 'VEHICLE AUDIT REPORT' : 'ARAÇ DENETİM RAPORU', stil: STIL.BASLIK_BUYUK }]);
  birlesikler.push(`A1:${sutunAdi(sutunSayisi - 1)}1`);
  satirlar.push([]);

  // Üst bilgi bloğu — her satırda üç etiket/değer çifti
  const bolum = Math.floor(sutunSayisi / 3);
  for (const cift of ustBilgiCiftleri(denetim, ozet, dil)) {
    const satir = new Array(sutunSayisi).fill('');
    for (let g = 0; g < 3; g++) {
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
  const gorseller = [];
  const satirYukseklikleri = {};
  let enFazlaFoto = 1;

  hatalar.forEach((h, i) => {
    const satirNo = satirlar.length;
    satirlar.push(SUTUNLAR.map((s) => ({
      v: s.deger(h, i, baglam),
      stil: s.stilSecici ? s.stilSecici(h) : (s.stil ?? STIL.GOVDE),
    })));

    const fotolar = (h.fotograflar ?? []).map((fid) => fotograflar.get(fid)).filter((f) => f?.bayt?.length);
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
        aciklama: `${PARCA_INDEKS[h.parcaId]?.ad ?? h.parcaId} — ${HATA_TIPI_INDEKS[h.hataTipiId]?.ad ?? h.hataTipiId}`,
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
  const raporSayfasi = {
    ad: dil === 'en' ? 'Audit Report' : 'Denetim Raporu',
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

/** Excel sütun genişliği (karakter) -> piksel. */
function s_piksel(genislik) { return (genislik ?? 8) * 7 + 5; }

/** Özet sayfası: bölge, şiddet ve hata grubu dağılımı. */
function ozetSayfasi(denetim, ozet, dil) {
  const E = (tr, en) => (dil === 'en' ? en : tr);
  const satirlar = [
    [{ v: E('ÖZET', 'SUMMARY'), stil: STIL.BASLIK_BUYUK }],
    [],
    [{ v: E('Toplam hata kaydı', 'Defect records'), stil: STIL.ETIKET }, { v: ozet.toplamHata, stil: STIL.SAYI }],
    [{ v: E('Toplam hata adedi', 'Total quantity'), stil: STIL.ETIKET }, { v: ozet.toplamAdet, stil: STIL.SAYI }],
    [{ v: E('Toplam ceza puanı', 'Total demerit'), stil: STIL.ETIKET }, { v: ozet.toplamPuan, stil: STIL.SAYI }],
    [{ v: E('Fotoğraflı hata', 'With photo'), stil: STIL.ETIKET }, { v: ozet.fotografliHata, stil: STIL.SAYI }],
    [{ v: E('Fotoğrafsız hata', 'Without photo'), stil: STIL.ETIKET }, { v: ozet.fotografsizHata, stil: STIL.SAYI }],
    [{ v: E('Sonuç', 'Result'), stil: STIL.ETIKET }, { v: dil === 'en' ? ozet.sonuc.en : ozet.sonuc.ad, stil: STIL.GOVDE }, { v: ozet.sonuc.gerekce, stil: STIL.GOVDE }],
    [],
    [{ v: E('ŞİDDETE GÖRE', 'BY SEVERITY'), stil: STIL.ETIKET }],
    [{ v: E('Sınıf', 'Class'), stil: STIL.BASLIK }, { v: E('Adet', 'Qty'), stil: STIL.BASLIK }, { v: E('Ceza Puanı', 'Demerit'), stil: STIL.BASLIK }, { v: E('Tanım', 'Definition'), stil: STIL.BASLIK }],
  ];
  for (const s of SIDDETLER) {
    const d = ozet.siddetDagilimi[s.id] ?? { adet: 0, puan: 0 };
    satirlar.push([
      { v: `${s.id} — ${dil === 'en' ? s.en : s.ad}`, stil: { A: STIL.SIDDET_A, B: STIL.SIDDET_B, C: STIL.SIDDET_C }[s.id] },
      { v: d.adet, stil: STIL.SAYI }, { v: d.puan, stil: STIL.SAYI }, { v: s.aciklama, stil: STIL.GOVDE },
    ]);
  }

  satirlar.push([], [{ v: E('BÖLGEYE GÖRE', 'BY ZONE'), stil: STIL.ETIKET }],
    [{ v: E('Bölge', 'Zone'), stil: STIL.BASLIK }, { v: E('Adet', 'Qty'), stil: STIL.BASLIK }, { v: E('Ceza Puanı', 'Demerit'), stil: STIL.BASLIK }]);
  for (const b of ozet.bolgeDagilimi) {
    satirlar.push([{ v: b.ad, stil: STIL.GOVDE }, { v: b.adet, stil: STIL.SAYI }, { v: b.puan, stil: STIL.SAYI }]);
  }

  satirlar.push([], [{ v: E('EN ÇOK HATA ALAN PARÇALAR', 'TOP PARTS'), stil: STIL.ETIKET }],
    [{ v: E('Parça', 'Part'), stil: STIL.BASLIK }, { v: E('Bölge', 'Zone'), stil: STIL.BASLIK }, { v: E('Adet', 'Qty'), stil: STIL.BASLIK }, { v: E('Ceza Puanı', 'Demerit'), stil: STIL.BASLIK }]);
  for (const p of ozet.parcaDagilimi.slice(0, 20)) {
    satirlar.push([{ v: p.ad, stil: STIL.GOVDE }, { v: p.bolgeAd, stil: STIL.GOVDE }, { v: p.adet, stil: STIL.SAYI }, { v: p.puan, stil: STIL.SAYI }]);
  }

  satirlar.push([], [{
    v: E('Not: ceza puanı ağırlıkları ve karar eşikleri ayarlanabilir başlangıç değerleridir; resmî bir audit standardından alınmamıştır.',
         'Note: demerit weights and decision thresholds are configurable starting values, not taken from an official audit standard.'),
    stil: STIL.SOLUK,
  }]);

  return { ad: E('Özet', 'Summary'), satirlar, sutunGenislikleri: [34, 12, 14, 52] };
}

/**
 * Birden çok denetimi tek kitapta toplar (vardiya/hat raporu).
 * Fotoğraflar yalnızca ilk sayfada değil, her aracın kendi sayfasında yer alır.
 */
export function topluExcelUret(denetimler, fotograflar = new Map(), ayarlar = {}) {
  const dil = ayarlar.dil ?? 'tr';
  const E = (tr, en) => (dil === 'en' ? en : tr);
  const toplu = topluOzet(denetimler, ayarlar.esikler);

  const satirlar = [
    [{ v: E('TOPLU DENETİM RAPORU', 'BATCH AUDIT REPORT'), stil: STIL.BASLIK_BUYUK }],
    [],
    [{ v: E('Denetlenen araç', 'Vehicles audited'), stil: STIL.ETIKET }, { v: toplu.aracSayisi, stil: STIL.SAYI }],
    [{ v: E('Toplam hata adedi', 'Total defects'), stil: STIL.ETIKET }, { v: toplu.toplamAdet, stil: STIL.SAYI }],
    [{ v: 'DPU (Defects Per Unit)', stil: STIL.ETIKET }, { v: toplu.dpu, stil: STIL.SAYI }],
    [{ v: E('Araç başı ceza puanı', 'Demerit per unit'), stil: STIL.ETIKET }, { v: toplu.aracBasiPuan, stil: STIL.SAYI }],
    [],
    [{ v: E('ARAÇLAR', 'VEHICLES'), stil: STIL.ETIKET }],
    [E('Şasi No', 'VIN'), E('Plaka', 'Plate'), E('Araç', 'Vehicle'), E('Tarih', 'Date'), E('Denetçi', 'Auditor'),
     E('Hata', 'Defects'), E('Puan', 'Demerit'), E('Sonuç', 'Result')].map((v) => ({ v, stil: STIL.BASLIK })),
  ];

  for (const { denetim, ozet } of toplu.ozetler) {
    satirlar.push([
      { v: denetim.vin ?? '', stil: STIL.GOVDE },
      { v: denetim.plaka || '—', stil: STIL.GOVDE },
      { v: ARAC_INDEKS[denetim.aracId]?.ad ?? denetim.aracId ?? '', stil: STIL.GOVDE },
      { v: bicimTarih(denetim.baslangic), stil: STIL.GOVDE_ORTA },
      { v: denetim.denetci ?? '', stil: STIL.GOVDE },
      { v: ozet.toplamAdet, stil: STIL.SAYI },
      { v: ozet.toplamPuan, stil: STIL.SAYI },
      { v: dil === 'en' ? ozet.sonuc.en : ozet.sonuc.ad, stil: { RED: STIL.SIDDET_A, SARTLI: STIL.SIDDET_B, KABUL: STIL.GOVDE_ORTA }[ozet.sonuc.kod] },
    ]);
  }

  satirlar.push([], [{ v: E('EN SIK TEKRARLAYAN PARÇALAR', 'MOST FREQUENT PARTS'), stil: STIL.ETIKET }],
    [E('Parça', 'Part'), E('Bölge', 'Zone'), E('Toplam adet', 'Total qty'), E('Kaç araçta', 'Vehicles affected')]
      .map((v) => ({ v, stil: STIL.BASLIK })));
  for (const p of toplu.enSikParcalar) {
    satirlar.push([{ v: p.ad, stil: STIL.GOVDE }, { v: p.bolgeAd, stil: STIL.GOVDE },
      { v: p.adet, stil: STIL.SAYI }, { v: p.aracSayisi, stil: STIL.SAYI }]);
  }

  const sayfalar = [{
    ad: E('Toplu Özet', 'Batch Summary'), satirlar,
    sutunGenislikleri: [22, 14, 16, 18, 18, 10, 10, 16],
    dondur: { satir: 9, sutun: 0 },
  }];

  // Her araç kendi sayfasına — fotoğraflar dahil
  for (const d of denetimler) {
    const tekKitap = tekSayfaVerisi(d, fotograflar, dil, ayarlar.esikler);
    sayfalar.push(tekKitap);
  }

  return xlsxOlustur(sayfalar, { baslik: E('Toplu Denetim Raporu', 'Batch Audit Report'), yazar: ayarlar.yazar });
}

/** topluExcelUret için: tek aracın sayfa tanımını (fotoğraflarıyla) üretir. */
function tekSayfaVerisi(denetim, fotograflar, dil, esikler) {
  const baglam = { dil };
  const hatalar = denetim.hatalar ?? [];
  const fotoSutunu = SUTUNLAR.findIndex((s) => s.fotograf);
  const satirlar = [SUTUNLAR.map((s) => ({ v: baslikMetni(s, dil), stil: STIL.BASLIK }))];
  const gorseller = [];
  const satirYukseklikleri = {};

  hatalar.forEach((h, i) => {
    const satirNo = satirlar.length;
    satirlar.push(SUTUNLAR.map((s) => ({
      v: s.deger(h, i, baglam),
      stil: s.stilSecici ? s.stilSecici(h) : (s.stil ?? STIL.GOVDE),
    })));
    const fotolar = (h.fotograflar ?? []).map((fid) => fotograflar.get(fid)).filter((f) => f?.bayt?.length);
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
export function csvUret(denetim, ayarlar = {}) {
  const dil = ayarlar.dil ?? 'tr';
  const baglam = { dil };
  const kacis = (v) => {
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
export function htmlRapor(denetim, fotoUrlleri = new Map(), ayarlar = {}) {
  const dil = ayarlar.dil ?? 'tr';
  const baglam = { dil };
  const ozet = denetimOzeti(denetim, ayarlar.esikler);
  const arac = ARAC_INDEKS[denetim.aracId];
  const g = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const E = (tr, en) => (dil === 'en' ? en : tr);

  const ustBilgi = ustBilgiCiftleri(denetim, ozet, dil)
    .flatMap((satir) => [[satir[0], satir[1]], [satir[2], satir[3]], [satir[4], satir[5]]])
    .map(([e, d]) => `<div class="r-alan"><span>${g(e)}</span><strong>${g(d)}</strong></div>`).join('');

  const gorunurSutunlar = SUTUNLAR.filter((s) => s.anahtar !== 'grup' && s.anahtar !== 'kod');
  const basliklar = gorunurSutunlar.map((s) => `<th>${g(baslikMetni(s, dil))}</th>`).join('');

  const govde = (denetim.hatalar ?? []).map((h, i) => {
    const hucreler = gorunurSutunlar.map((s) => {
      if (s.fotograf) {
        const foto = (h.fotograflar ?? []).map((fid) => fotoUrlleri.get(fid)).filter(Boolean);
        return `<td class="r-foto">${foto.map((f) => `<img src="${g(f.url)}" alt="">`).join('')}</td>`;
      }
      const sinif = s.anahtar === 'siddet' ? ` class="r-s r-s${g(h.siddet)}"` : '';
      return `<td${sinif}>${g(s.deger(h, i, baglam))}</td>`;
    }).join('');
    return `<tr>${hucreler}</tr>`;
  }).join('');

  return `<section class="rapor">
<header><h1>${E('Araç Denetim Raporu', 'Vehicle Audit Report')}</h1>
<p class="r-arac">${g(arac?.tam ?? denetim.aracId ?? '')} · ${g(denetim.vin ?? '')}</p></header>
<div class="r-izgara">${ustBilgi}</div>
<div class="r-sonuc r-sonuc-${g(ozet.sonuc.kod)}"><strong>${g(dil === 'en' ? ozet.sonuc.en : ozet.sonuc.ad)}</strong><span>${g(ozet.sonuc.gerekce)}</span></div>
<div class="r-kaydir"><table class="r-tablo"><thead><tr>${basliklar}</tr></thead><tbody>${govde || `<tr><td colspan="${gorunurSutunlar.length}">${E('Hata kaydedilmedi.', 'No defects recorded.')}</td></tr>`}</tbody></table></div>
<p class="r-not">${E('Ceza puanı ağırlıkları ve karar eşikleri ayarlanabilir başlangıç değerleridir; resmî bir audit standardından alınmamıştır.',
  'Demerit weights and decision thresholds are configurable starting values, not from an official audit standard.')}</p>
</section>`;
}

export { bicimTarih, bicimSaat };
