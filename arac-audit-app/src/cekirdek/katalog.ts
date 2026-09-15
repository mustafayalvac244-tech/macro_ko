// ARAÇ AUDIT — HATA KATALOĞU
// ---------------------------------------------------------------------------
// Bu dosya ürünün kalbidir: denetçinin elle yazmak yerine SEÇTİĞİ her şey
// burada tanımlıdır. Üç katmanlı yapı kullanılır:
//
//     BÖLGE  ->  PARÇA  ->  HATA TİPİ
//     "Sol yan"  "Arka kapı"  "Gıcırtı"        = Rear door squeak noise
//     "İç tavan" "A direği garnişi" "Göçük"    = A pillar garnish dent
//
// Her parça, KENDİSİNE UYGUN hata gruplarını bildirir; böylece "multimedya
// ekranı" için "boya akıntısı" gibi anlamsız bir seçenek hiç listelenmez.
//
// DÜRÜSTLÜK NOTU (AGENTS.md kuralı): aşağıdaki ceza puanı (demerit) ağırlıkları
// ve kritiklik sınıfları ÖRNEK BAŞLANGIÇ DEĞERLERİDİR. Hiçbir üreticinin
// resmî audit standardından ölçülmemiştir. Kendi standardınızın ağırlıklarını
// girene kadar "puan" sütununu yalnızca kendi içinde kıyas için kullanın.
// ---------------------------------------------------------------------------

import { AracTipi, Bolge, HataGrubu, HataGrubuId, HataTipi, Parca, ParcaKayit, Siddet, Taraf } from './tipler';
/** Kritiklik sınıfları. puan = ceza puanı (demerit) ağırlığı. */
export const SIDDETLER: Siddet[] = [
  { id: 'A', ad: 'Kritik',  en: 'Critical', puan: 10, renk: '#d92d20', aciklama: 'Güvenlik, yasal uygunluk veya fonksiyon kaybı. Araç sevk edilemez.' },
  { id: 'B', ad: 'Majör',   en: 'Major',    puan: 5,  renk: '#f79009', aciklama: 'Müşterinin teslimde kesinlikle fark edeceği hata.' },
  { id: 'C', ad: 'Minör',   en: 'Minor',    puan: 1,  renk: '#eaaa08', aciklama: 'Dikkatli incelemede fark edilen, kozmetik hata.' },
];

/** Hata grupları — parçalar bu grupları referans alır. */
export const HATA_GRUPLARI: Record<HataGrubuId, HataGrubu> = {
  yuzey:        { ad: 'Yüzey / Boya',      en: 'Surface / Paint' },
  montaj:       { ad: 'Montaj / Uyum',     en: 'Fit & Finish' },
  ses:          { ad: 'Ses (NVH)',         en: 'Noise (NVH)' },
  fonksiyon:    { ad: 'Fonksiyon',         en: 'Function' },
  doseme:       { ad: 'Döşeme / Kumaş',    en: 'Trim / Fabric' },
  cam:          { ad: 'Cam',               en: 'Glass' },
  sizdirmazlik: { ad: 'Sızdırmazlık',      en: 'Sealing / Leak' },
  temizlik:     { ad: 'Temizlik',          en: 'Cleanliness' },
};

/**
 * Hata tipleri. `siddet` alanı ÖNERİLEN başlangıç sınıfıdır; denetçi
 * kayıt sırasında değiştirebilir (gerçek sınıf hatanın yerine/boyutuna bağlıdır).
 */
export const HATA_TIPLERI: HataTipi[] = [
  // --- Yüzey / Boya ---
  { id: 'cizik',        grup: 'yuzey', ad: 'Çizik',                 en: 'Scratch',           siddet: 'C' },
  { id: 'gocuk',        grup: 'yuzey', ad: 'Göçük',                 en: 'Dent',              siddet: 'B' },
  { id: 'ezik',         grup: 'yuzey', ad: 'Ezik / Darbe izi',      en: 'Impact mark',       siddet: 'B' },
  { id: 'toz_kir',      grup: 'yuzey', ad: 'Boya altı toz/kir',     en: 'Dirt inclusion',    siddet: 'C' },
  { id: 'akinti',       grup: 'yuzey', ad: 'Boya akıntısı',         en: 'Paint run / sag',   siddet: 'B' },
  { id: 'portakal',     grup: 'yuzey', ad: 'Portakal kabuğu',       en: 'Orange peel',       siddet: 'C' },
  { id: 'krater',       grup: 'yuzey', ad: 'Kraterlenme',           en: 'Crater / fisheye',  siddet: 'B' },
  { id: 'renk_farki',   grup: 'yuzey', ad: 'Renk / ton farkı',      en: 'Color mismatch',    siddet: 'B' },
  { id: 'boyasiz',      grup: 'yuzey', ad: 'Boyasız / eksik boya',  en: 'Unpainted area',    siddet: 'A' },
  { id: 'pas',          grup: 'yuzey', ad: 'Pas / korozyon',        en: 'Rust / corrosion',  siddet: 'A' },
  { id: 'capak',        grup: 'yuzey', ad: 'Çapak / keskin kenar',  en: 'Burr / sharp edge', siddet: 'A' },
  { id: 'sivi_izi',     grup: 'yuzey', ad: 'Sıvı / silikon izi',    en: 'Liquid residue',    siddet: 'C' },

  // --- Montaj / Uyum ---
  { id: 'bosluk',       grup: 'montaj', ad: 'Boşluk farkı (gap)',   en: 'Gap variation',     siddet: 'B' },
  { id: 'kademe',       grup: 'montaj', ad: 'Kademe farkı (flush)', en: 'Flush variation',   siddet: 'B' },
  { id: 'hizasiz',      grup: 'montaj', ad: 'Hizasız montaj',       en: 'Misaligned',        siddet: 'B' },
  { id: 'gevsek',       grup: 'montaj', ad: 'Gevşek / oynuyor',     en: 'Loose',             siddet: 'B' },
  { id: 'oturmamis',    grup: 'montaj', ad: 'Yerine oturmamış',     en: 'Not seated',        siddet: 'B' },
  { id: 'eksik_parca',  grup: 'montaj', ad: 'Eksik parça',          en: 'Missing part',      siddet: 'A' },
  { id: 'eksik_klips',  grup: 'montaj', ad: 'Eksik klips / vida',   en: 'Missing clip/screw',siddet: 'B' },
  { id: 'kirik_klips',  grup: 'montaj', ad: 'Kırık klips',          en: 'Broken clip',       siddet: 'B' },
  { id: 'yanlis_parca', grup: 'montaj', ad: 'Yanlış parça',         en: 'Wrong part',        siddet: 'A' },
  { id: 'deforme',      grup: 'montaj', ad: 'Deforme / eğrilik',    en: 'Deformed',          siddet: 'B' },
  { id: 'sikma_torku',  grup: 'montaj', ad: 'Tork / sıkma hatası',  en: 'Torque fault',      siddet: 'A' },

  // --- Ses (NVH) ---
  { id: 'gicirti',      grup: 'ses', ad: 'Gıcırtı',                 en: 'Squeak',            siddet: 'B' },
  { id: 'tikirti',      grup: 'ses', ad: 'Tıkırtı / zangırtı',      en: 'Rattle',            siddet: 'B' },
  { id: 'ruzgar_sesi',  grup: 'ses', ad: 'Rüzgâr sesi',             en: 'Wind noise',        siddet: 'B' },
  { id: 'vurma',        grup: 'ses', ad: 'Vurma / darbe sesi',      en: 'Knock / thump',     siddet: 'B' },
  { id: 'titresim',     grup: 'ses', ad: 'Titreşim',                en: 'Vibration',         siddet: 'B' },
  { id: 'yol_sesi',     grup: 'ses', ad: 'Yol / lastik sesi',       en: 'Road noise',        siddet: 'C' },

  // --- Fonksiyon ---
  { id: 'calismiyor',   grup: 'fonksiyon', ad: 'Çalışmıyor',        en: 'Inoperative',       siddet: 'A' },
  { id: 'aralikli',     grup: 'fonksiyon', ad: 'Aralıklı çalışıyor',en: 'Intermittent',      siddet: 'A' },
  { id: 'zor_calisiyor',grup: 'fonksiyon', ad: 'Zor / ağır çalışıyor', en: 'Hard operation', siddet: 'B' },
  { id: 'hata_kodu',    grup: 'fonksiyon', ad: 'Hata kodu (DTC)',   en: 'DTC present',       siddet: 'A' },
  { id: 'uyari_lambasi',grup: 'fonksiyon', ad: 'Uyarı lambası yanıyor', en: 'Warning lamp',  siddet: 'A' },
  { id: 'yanlis_yon',   grup: 'fonksiyon', ad: 'Ters / yanlış yön', en: 'Reversed operation',siddet: 'B' },
  { id: 'ayar_bozuk',   grup: 'fonksiyon', ad: 'Ayar bozuk',        en: 'Out of adjustment', siddet: 'B' },

  // --- Döşeme / Kumaş ---
  { id: 'leke',         grup: 'doseme', ad: 'Leke',                 en: 'Stain',             siddet: 'B' },
  { id: 'yirtik',       grup: 'doseme', ad: 'Yırtık / delik',       en: 'Tear / hole',       siddet: 'A' },
  { id: 'burusuk',      grup: 'doseme', ad: 'Buruşuk / gergin değil',en: 'Wrinkle',          siddet: 'C' },
  { id: 'dikis',        grup: 'doseme', ad: 'Dikiş hatası',         en: 'Stitching fault',   siddet: 'B' },
  { id: 'iplik',        grup: 'doseme', ad: 'Sarkan iplik',         en: 'Loose thread',      siddet: 'C' },

  // --- Cam ---
  { id: 'cam_cizik',    grup: 'cam', ad: 'Cam çiziği',              en: 'Glass scratch',     siddet: 'B' },
  { id: 'cam_catlak',   grup: 'cam', ad: 'Cam çatlağı',             en: 'Glass crack',       siddet: 'A' },
  { id: 'cam_kalinti',  grup: 'cam', ad: 'Cam üzeri kalıntı',       en: 'Glass residue',     siddet: 'C' },
  { id: 'bugu',         grup: 'cam', ad: 'İç buğulanma',            en: 'Internal fogging',  siddet: 'A' },

  // --- Sızdırmazlık ---
  { id: 'su_sizinti',   grup: 'sizdirmazlik', ad: 'Su sızıntısı',   en: 'Water leak',        siddet: 'A' },
  { id: 'hava_sizinti', grup: 'sizdirmazlik', ad: 'Hava sızıntısı', en: 'Air leak',          siddet: 'B' },
  { id: 'yag_sizinti',  grup: 'sizdirmazlik', ad: 'Yağ / sıvı sızıntısı', en: 'Fluid leak',  siddet: 'A' },
  { id: 'fitil',        grup: 'sizdirmazlik', ad: 'Fitil oturmamış / kalkık', en: 'Weatherstrip not seated', siddet: 'B' },
  { id: 'mastik',       grup: 'sizdirmazlik', ad: 'Mastik / sızdırmazlık hatası', en: 'Sealer fault', siddet: 'B' },

  // --- Temizlik ---
  { id: 'kirli',        grup: 'temizlik', ad: 'Kirli / tozlu',      en: 'Soiled / dusty',    siddet: 'C' },
  { id: 'yapiskan',     grup: 'temizlik', ad: 'Yapışkan / etiket kalıntısı', en: 'Adhesive residue', siddet: 'C' },
  { id: 'koku',         grup: 'temizlik', ad: 'Koku',               en: 'Odour',             siddet: 'B' },
];

/** Hızlı erişim haritası. */
export const HATA_TIPI_INDEKS: Record<string, HataTipi> =
  Object.fromEntries(HATA_TIPLERI.map((h) => [h.id, h]));

// ---------------------------------------------------------------------------
// ÖZEL HATA TİPLERİ — ekibin uygulama içinden eklediği katman
//
// Neden var: sahada sürekli yeni ve çok spesifik hata çıkıyor. Her yeni hata
// için kod değişikliği beklemek denetimi durdurur; denetçi hatayı ya "Diğer"e
// yazar ya da hiç kaydetmez. İkisi de veriyi bozar.
//
// Yerleşik liste (yukarısı) DEĞİŞTİRİLMEZ — özel tipler onun ÜSTÜNE eklenir.
// Böylece bir sonraki sürümde yerleşik listeyi güncellemek, ekibin kendi
// eklediklerini silmez.
// ---------------------------------------------------------------------------

const OZEL_TIPLER: HataTipi[] = [];

/**
 * Depodan okunan özel tipleri kataloğa bağlar. Açılışta bir kez, sonra her
 * ekleme/kaldırmada çağrılır.
 *
 * İNDEKS YERİNDE GÜNCELLENİR, yeniden atanmaz: `rapor.ts` ve `puan.ts`
 * HATA_TIPI_INDEKS'i içe aktarma anında yakalıyor. Yeni bir nesne atasaydık
 * o iki modül eski referansla çalışmaya devam eder ve özel tipli hatalar
 * Excel'de ham kimlik ("ht_m4x9...") olarak görünürdü.
 */
export function ozelHataTipleriniAyarla(liste: HataTipi[]): void {
  for (const t of OZEL_TIPLER) delete HATA_TIPI_INDEKS[t.id];
  OZEL_TIPLER.length = 0;
  for (const t of liste) {
    // Yerleşik bir kimliği ezmeye izin verme: rapor ve puanlama sessizce
    // başka bir hatayı anlatmaya başlar.
    if (HATA_TIPLERI.some((y) => y.id === t.id)) continue;
    OZEL_TIPLER.push(t);
    // Kaldırılmış olsa bile indekse girer — eski raporlar adı çözebilsin.
    HATA_TIPI_INDEKS[t.id] = t;
  }
}

/** Yerleşik + özel, kaldırılmışlar hariç. Seçim listeleri bunu kullanır. */
export function tumHataTipleri(): HataTipi[] {
  return [...HATA_TIPLERI, ...OZEL_TIPLER.filter((t) => !t.silindi)];
}

// ---------------------------------------------------------------------------
// BÖLGELER VE PARÇALAR
// `gruplar`: bu parçada hangi hata grupları anlamlıdır (filtre için).
// `mesh`   : 3B modeldeki tıklanabilir yüzeyin kimliği (varsa).
// `cift`   : true ise parça sol/sağ olarak ikiye açılır.
// ---------------------------------------------------------------------------

const YUZEY_MONTAJ: HataGrubuId[] = ['yuzey', 'montaj'];
const DIS_PANEL: HataGrubuId[] = ['yuzey', 'montaj', 'ses', 'sizdirmazlik', 'temizlik'];
const IC_PANEL: HataGrubuId[] = ['montaj', 'ses', 'yuzey', 'doseme', 'temizlik'];
const CAM_TAKIMI: HataGrubuId[] = ['cam', 'montaj', 'sizdirmazlik', 'ses', 'temizlik'];
const ELEKTRIK: HataGrubuId[] = ['fonksiyon', 'montaj', 'ses'];

/**
 * "Ön çamurluk" -> "ön çamurluk". Ama "A direği garnişi" ve "USB / kablosuz şarj"
 * gibi tek harfli ya da tümü büyük kısaltmayla başlayan adlar OLDUĞU GİBİ kalır;
 * yoksa "Sol a direği garnişi" gibi yanlış bir ad üretilir.
 */
function bastanKucult(ad: string): string {
  const ilkKelime = ad.split(/[\s/]/, 1)[0];
  if (ilkKelime.length <= 1 || ilkKelime === ilkKelime.toLocaleUpperCase('tr')) return ad;
  return ad.charAt(0).toLocaleLowerCase('tr') + ad.slice(1);
}

/** Sol/sağ çift parçaları açan yardımcı. */
function ciftle(parcalar: Parca[]): Parca[] {
  const cikti: Parca[] = [];
  for (const p of parcalar) {
    if (!p.cift) { cikti.push(p); continue; }
    const yanlar: [Taraf, string, string][] = [['sol', 'Sol', 'LH'], ['sag', 'Sağ', 'RH']];
    for (const [tk, tad, ten] of yanlar) {
      cikti.push({
        ...p,
        cift: false,
        taraf: tk,
        id: `${tk}_${p.id}`,
        ad: `${tad} ${bastanKucult(p.ad)}`,
        en: `${ten} ${bastanKucult(p.en)}`,
        mesh: p.mesh ? `${tk}_${p.mesh}` : undefined,
      });
    }
  }
  return cikti;
}

const HAM_BOLGELER: Bolge[] = [
  {
    id: 'dis_on', ad: 'Dış · Ön', en: 'Exterior · Front', grup: 'dis', simge: '▣',
    parcalar: [
      { id: 'on_tampon',    ad: 'Ön tampon',          en: 'Front bumper',        gruplar: DIS_PANEL, mesh: 'on_tampon' },
      { id: 'on_izgara',    ad: 'Ön ızgara',          en: 'Front grille',        gruplar: DIS_PANEL, mesh: 'on_izgara' },
      { id: 'alt_panjur',   ad: 'Alt hava panjuru',   en: 'Lower air shutter',   gruplar: DIS_PANEL },
      { id: 'kaput',        ad: 'Kaput',              en: 'Hood',                gruplar: DIS_PANEL, mesh: 'kaput' },
      { id: 'far',          ad: 'Far',                en: 'headlamp',            gruplar: ['fonksiyon', 'montaj', 'yuzey', 'cam'], mesh: 'far', cift: true },
      { id: 'sis_far',      ad: 'Sis farı',           en: 'fog lamp',            gruplar: ['fonksiyon', 'montaj', 'yuzey'], cift: true },
      { id: 'on_cam',       ad: 'Ön cam',             en: 'Windshield',          gruplar: CAM_TAKIMI, mesh: 'on_cam' },
      { id: 'on_silecek',   ad: 'Ön silecek',         en: 'Front wiper',         gruplar: ['fonksiyon', 'montaj', 'ses'] },
      { id: 'on_panel',     ad: 'Ön panel / su kanalı', en: 'Cowl panel',        gruplar: DIS_PANEL },
      { id: 'on_plaka',     ad: 'Ön plaka yuvası',    en: 'Front plate holder',  gruplar: YUZEY_MONTAJ },
      { id: 'on_amblem',    ad: 'Ön amblem',          en: 'Front emblem',        gruplar: YUZEY_MONTAJ },
      { id: 'cekme_kapak',  ad: 'Çekme kancası kapağı', en: 'Tow hook cover',    gruplar: YUZEY_MONTAJ },
    ],
  },
  {
    id: 'dis_arka', ad: 'Dış · Arka', en: 'Exterior · Rear', grup: 'dis', simge: '▤',
    parcalar: [
      { id: 'arka_tampon',  ad: 'Arka tampon',        en: 'Rear bumper',         gruplar: DIS_PANEL, mesh: 'arka_tampon' },
      { id: 'bagaj_kapagi', ad: 'Bagaj kapağı',       en: 'Tailgate',            gruplar: DIS_PANEL, mesh: 'bagaj_kapagi' },
      { id: 'arka_cam',     ad: 'Arka cam',           en: 'Rear windshield',     gruplar: CAM_TAKIMI, mesh: 'arka_cam' },
      { id: 'arka_silecek', ad: 'Arka silecek',       en: 'Rear wiper',          gruplar: ['fonksiyon', 'montaj', 'ses'] },
      { id: 'stop',         ad: 'Stop lambası',       en: 'tail lamp',           gruplar: ['fonksiyon', 'montaj', 'yuzey', 'cam'], mesh: 'stop', cift: true },
      { id: 'ucuncu_stop',  ad: 'Üçüncü stop lambası',en: 'High mount stop lamp',gruplar: ['fonksiyon', 'montaj'] },
      { id: 'arka_plaka',   ad: 'Arka plaka yuvası',  en: 'Rear plate holder',   gruplar: YUZEY_MONTAJ },
      { id: 'arka_amblem',  ad: 'Arka amblem / yazı', en: 'Rear emblem / badge', gruplar: YUZEY_MONTAJ },
      { id: 'spoyler',      ad: 'Arka spoyler',       en: 'Rear spoiler',        gruplar: DIS_PANEL },
      { id: 'difuzor',      ad: 'Arka difüzör',       en: 'Rear diffuser',       gruplar: DIS_PANEL },
      { id: 'arka_panel',   ad: 'Arka panel',         en: 'Rear body panel',     gruplar: DIS_PANEL },
    ],
  },
  {
    id: 'dis_ust', ad: 'Dış · Üst', en: 'Exterior · Upper', grup: 'dis', simge: '▭',
    parcalar: [
      { id: 'tavan',        ad: 'Tavan sacı',         en: 'Roof panel',          gruplar: DIS_PANEL, mesh: 'tavan' },
      { id: 'cam_tavan',    ad: 'Panoramik cam tavan',en: 'Panoramic roof',      gruplar: [...CAM_TAKIMI, 'fonksiyon'] },
      { id: 'tavan_cita',   ad: 'Tavan çıtası',       en: 'roof moulding',       gruplar: DIS_PANEL, cift: true },
      { id: 'tavan_bari',   ad: 'Tavan barı',         en: 'roof rail',           gruplar: DIS_PANEL, cift: true },
      { id: 'anten',        ad: 'Anten',              en: 'Antenna',             gruplar: ['montaj', 'yuzey', 'fonksiyon'] },
    ],
  },
  {
    id: 'dis_alt', ad: 'Dış · Alt', en: 'Exterior · Underbody', grup: 'dis', simge: '▬',
    parcalar: [
      { id: 'alt_muhafaza', ad: 'Alt muhafaza / davlumbaz', en: 'Under cover',   gruplar: ['montaj', 'yuzey', 'ses'] },
      { id: 'sase_alti',    ad: 'Şase altı / taban sacı',   en: 'Floor pan',     gruplar: ['yuzey', 'sizdirmazlik', 'montaj'] },
      { id: 'batarya_muh',  ad: 'HV batarya muhafazası (EV)', en: 'HV battery casing', gruplar: ['montaj', 'yuzey', 'sizdirmazlik'], sadeceEv: true },
      { id: 'yakit_deposu', ad: 'Yakıt deposu bölgesi',      en: 'Fuel tank area',gruplar: ['montaj', 'sizdirmazlik'], sadeceIce: true },
      { id: 'egzoz_hatti',  ad: 'Egzoz hattı',               en: 'Exhaust line',  gruplar: ['montaj', 'ses', 'yuzey'], sadeceIce: true },
    ],
  },
  {
    id: 'ic_on', ad: 'İç · Ön konsol', en: 'Interior · Cockpit', grup: 'ic', simge: '▥',
    parcalar: [
      { id: 'ip_ust',       ad: 'Gösterge paneli üstü (IP)', en: 'Upper IP',     gruplar: IC_PANEL, mesh: 'ic_ip' },
      { id: 'ip_alt',       ad: 'Gösterge paneli altı',      en: 'Lower IP',     gruplar: IC_PANEL },
      { id: 'gosterge',     ad: 'Gösterge ekranı (cluster)', en: 'Instrument cluster', gruplar: ['fonksiyon', 'yuzey', 'montaj'], mesh: 'ic_gosterge' },
      { id: 'multimedya',   ad: 'Multimedya ekranı',         en: 'Infotainment display', gruplar: ['fonksiyon', 'yuzey', 'montaj', 'cam'], mesh: 'ic_ekran' },
      { id: 'orta_konsol',  ad: 'Orta konsol',               en: 'Center console', gruplar: IC_PANEL, mesh: 'ic_konsol' },
      { id: 'vites',        ad: 'Vites / vites kolu',        en: 'Shifter',       gruplar: ['fonksiyon', 'montaj', 'ses', 'yuzey'] },
      { id: 'direksiyon',   ad: 'Direksiyon simidi',         en: 'Steering wheel',gruplar: ['yuzey', 'montaj', 'doseme', 'fonksiyon'], mesh: 'ic_direksiyon' },
      { id: 'direksiyon_dugme', ad: 'Direksiyon düğmeleri',  en: 'Steering wheel switches', gruplar: ELEKTRIK },
      { id: 'klima_paneli', ad: 'Klima kontrol paneli',      en: 'HVAC control panel', gruplar: ELEKTRIK },
      { id: 'hava_kanali',  ad: 'Hava üfleme kanalı',        en: 'Air vent',      gruplar: ['montaj', 'fonksiyon', 'ses', 'yuzey'] },
      { id: 'torpido',      ad: 'Torpido gözü',              en: 'Glove box',     gruplar: [...IC_PANEL, 'fonksiyon'] },
      { id: 'kol_dayama',   ad: 'Orta kol dayama',           en: 'Center armrest',gruplar: [...IC_PANEL, 'fonksiyon'] },
      { id: 'sarj_usb',     ad: 'USB / kablosuz şarj',       en: 'USB / wireless charger', gruplar: ELEKTRIK },
      { id: 'pedal',        ad: 'Pedal takımı',              en: 'Pedal assembly',gruplar: ['fonksiyon', 'montaj', 'ses'] },
      { id: 'ayak_bolge',   ad: 'Ayak bölgesi / halı',       en: 'Footwell carpet', gruplar: ['doseme', 'montaj', 'temizlik', 'sizdirmazlik'], mesh: 'ayak_bolge' },
      { id: 'tavan_konsol', ad: 'Ön tavan konsolu',          en: 'Overhead console', gruplar: [...IC_PANEL, 'fonksiyon'] },
    ],
  },
  {
    id: 'ic_kapi', ad: 'İç · Kapı döşemeleri', en: 'Interior · Door trim', grup: 'ic', simge: '▯',
    parcalar: [
      { id: 'on_kapi_doseme',   ad: 'Ön kapı döşemesi',    en: 'front door trim',   gruplar: IC_PANEL, mesh: 'on_kapi_doseme', cift: true },
      { id: 'arka_kapi_doseme', ad: 'Arka kapı döşemesi',  en: 'rear door trim',    gruplar: IC_PANEL, mesh: 'arka_kapi_doseme', cift: true },
      { id: 'ic_kapi_kolu',     ad: 'İç kapı açma kolu',   en: 'inner door handle', gruplar: ['fonksiyon', 'montaj', 'yuzey', 'ses'], cift: true },
      { id: 'cam_dugme',        ad: 'Cam düğme paneli',    en: 'window switch panel', gruplar: ELEKTRIK, cift: true },
      { id: 'hoparlor_izgara',  ad: 'Hoparlör ızgarası',   en: 'speaker grille',    gruplar: ['montaj', 'yuzey', 'fonksiyon'], cift: true },
      { id: 'kapi_cebi',        ad: 'Kapı cebi',           en: 'door pocket',       gruplar: IC_PANEL, cift: true },
      { id: 'kapi_esigi',       ad: 'Kapı eşiği çıtası',   en: 'door sill plate',   gruplar: ['montaj', 'yuzey', 'temizlik'], cift: true },
    ],
  },
  {
    id: 'ic_koltuk', ad: 'İç · Koltuklar', en: 'Interior · Seats', grup: 'ic', simge: '▮',
    parcalar: [
      { id: 'surucu_koltuk',    ad: 'Sürücü koltuğu',      en: 'Driver seat',       gruplar: [...IC_PANEL, 'fonksiyon'], mesh: 'koltuk_sol_on' },
      { id: 'yolcu_koltuk',     ad: 'Ön yolcu koltuğu',    en: 'Passenger seat',    gruplar: [...IC_PANEL, 'fonksiyon'], mesh: 'koltuk_sag_on' },
      { id: 'arka_koltuk_sirt', ad: 'Arka koltuk sırtlığı',en: 'Rear seat back',    gruplar: [...IC_PANEL, 'fonksiyon'], mesh: 'koltuk_arka' },
      { id: 'arka_koltuk_otur', ad: 'Arka koltuk oturma',  en: 'Rear seat cushion', gruplar: IC_PANEL },
      { id: 'baslik',           ad: 'Koltuk başlığı',      en: 'Headrest',          gruplar: [...IC_PANEL, 'fonksiyon'] },
      { id: 'kemer',            ad: 'Emniyet kemeri',      en: 'Seat belt',         gruplar: ['fonksiyon', 'doseme', 'montaj'] },
      { id: 'koltuk_ayar',      ad: 'Koltuk ayar mekanizması', en: 'Seat adjuster', gruplar: ['fonksiyon', 'ses', 'montaj'] },
      { id: 'isofix',           ad: 'ISOFIX kapakları',    en: 'ISOFIX covers',     gruplar: ['montaj', 'yuzey'] },
    ],
  },
  {
    id: 'ic_tavan', ad: 'İç · Tavan ve garnişler', en: 'Interior · Headliner & garnish', grup: 'ic', simge: '▰',
    parcalar: [
      { id: 'tavan_doseme',  ad: 'Tavan döşemesi',     en: 'Headliner',            gruplar: IC_PANEL, mesh: 'ic_tavan_doseme' },
      { id: 'a_garnis',      ad: 'A direği garnişi',   en: 'A pillar garnish',     gruplar: IC_PANEL, mesh: 'a_garnis', cift: true },
      { id: 'b_garnis',      ad: 'B direği garnişi',   en: 'B pillar garnish',     gruplar: IC_PANEL, mesh: 'b_garnis', cift: true },
      { id: 'c_garnis',      ad: 'C direği garnişi',   en: 'C pillar garnish',     gruplar: IC_PANEL, mesh: 'c_garnis', cift: true },
      { id: 'gunuslik',      ad: 'Güneşlik',           en: 'sun visor',            gruplar: [...IC_PANEL, 'fonksiyon'], cift: true },
      { id: 'tutamak',       ad: 'Tavan tutamağı',     en: 'assist grip',          gruplar: ['montaj', 'ses', 'fonksiyon'], cift: true },
      { id: 'tavan_lamba',   ad: 'İç tavan lambası',   en: 'Interior dome lamp',   gruplar: ELEKTRIK },
      { id: 'dikiz_ayna',    ad: 'İç dikiz aynası',    en: 'Interior mirror',      gruplar: ['montaj', 'fonksiyon', 'yuzey', 'ses'] },
    ],
  },
  {
    id: 'ic_bagaj', ad: 'İç · Bagaj', en: 'Interior · Luggage', grup: 'ic', simge: '▱',
    parcalar: [
      { id: 'bagaj_doseme',  ad: 'Bagaj taban döşemesi', en: 'Luggage floor trim', gruplar: IC_PANEL, mesh: 'ic_bagaj' },
      { id: 'bagaj_hali',    ad: 'Bagaj halısı',         en: 'Luggage carpet',     gruplar: ['doseme', 'montaj', 'temizlik'] },
      { id: 'bagaj_yan',     ad: 'Bagaj yan garnişi',    en: 'luggage side trim',  gruplar: IC_PANEL, cift: true },
      { id: 'bagaj_ic_kapak',ad: 'Bagaj kapağı iç kaplaması', en: 'Tailgate inner trim', gruplar: IC_PANEL },
      { id: 'stepne_bolme',  ad: 'Stepne / alet bölmesi',en: 'Spare wheel compartment', gruplar: ['montaj', 'temizlik', 'sizdirmazlik'] },
      { id: 'bagaj_raf',     ad: 'Bagaj rafı / perdesi', en: 'Parcel shelf',       gruplar: [...IC_PANEL, 'fonksiyon'] },
      { id: 'bagaj_lamba',   ad: 'Bagaj aydınlatması',   en: 'Luggage lamp',       gruplar: ELEKTRIK },
    ],
  },
  {
    id: 'motor', ad: 'Motor bölmesi', en: 'Engine / Power compartment', grup: 'motor', simge: '⚙',
    parcalar: [
      { id: 'kaput_alti',    ad: 'Kaput altı genel görünüm', en: 'Under hood general', gruplar: ['montaj', 'yuzey', 'temizlik'] },
      { id: 'kablo_demeti',  ad: 'Kablo demeti / bağlantılar', en: 'Wiring harness', gruplar: ['montaj', 'fonksiyon'] },
      { id: 'aku',           ad: 'Akü ve bağlantıları',  en: 'Battery & terminals',gruplar: ['montaj', 'fonksiyon'] },
      { id: 'sivi_seviye',   ad: 'Sıvı seviyeleri',      en: 'Fluid levels',       gruplar: ['fonksiyon', 'sizdirmazlik'] },
      { id: 'izolasyon',     ad: 'Kaput izolasyon keçesi',en: 'Hood insulation',   gruplar: ['montaj', 'ses'] },
      { id: 'sogutma',       ad: 'Radyatör / soğutma',   en: 'Radiator / cooling', gruplar: ['montaj', 'sizdirmazlik', 'ses'] },
      { id: 'hv_kablo',      ad: 'HV turuncu kablolar (EV)', en: 'HV cables',      gruplar: ['montaj', 'fonksiyon'], sadeceEv: true },
      { id: 'sarj_soketi',   ad: 'Şarj soketi (AC/DC)',  en: 'Charge port',        gruplar: ['fonksiyon', 'montaj', 'yuzey'], sadeceEv: true },
      { id: 'motor_ice',     ad: 'Motor / aktarma organları', en: 'Engine & drivetrain', gruplar: ['montaj', 'ses', 'sizdirmazlik'], sadeceIce: true },
    ],
  },
  {
    id: 'fonksiyon_testi', ad: 'Fonksiyon testi', en: 'Function test', grup: 'fonksiyon', simge: '⏻',
    parcalar: [
      { id: 'f_klima',       ad: 'Klima / ısıtma',       en: 'HVAC',               gruplar: ['fonksiyon', 'ses', 'temizlik'] },
      { id: 'f_multimedya',  ad: 'Multimedya / bağlantı',en: 'Infotainment / connectivity', gruplar: ['fonksiyon'] },
      { id: 'f_kamera',      ad: 'Kamera sistemi',       en: 'Camera system',      gruplar: ['fonksiyon', 'montaj'] },
      { id: 'f_park_sensor', ad: 'Park sensörü',         en: 'Parking sensors',    gruplar: ['fonksiyon', 'montaj'] },
      { id: 'f_adas',        ad: 'ADAS / sürücü destek', en: 'ADAS',               gruplar: ['fonksiyon'] },
      { id: 'f_ic_aydinlatma', ad: 'İç aydınlatma',      en: 'Interior lighting',  gruplar: ['fonksiyon'] },
      { id: 'f_dis_aydinlatma',ad: 'Dış aydınlatma',     en: 'Exterior lighting',  gruplar: ['fonksiyon'] },
      { id: 'f_merkezi_kilit', ad: 'Merkezi kilit / anahtar', en: 'Central lock / key', gruplar: ['fonksiyon'] },
      { id: 'f_cam_kaldirma',  ad: 'Cam kaldırma',       en: 'Power windows',      gruplar: ['fonksiyon', 'ses'] },
      { id: 'f_ayna_katlama',  ad: 'Ayna katlama / ayar',en: 'Mirror fold / adjust', gruplar: ['fonksiyon', 'ses'] },
      { id: 'f_koltuk_isitma', ad: 'Koltuk / direksiyon ısıtma', en: 'Seat & wheel heating', gruplar: ['fonksiyon'] },
      { id: 'f_korna',         ad: 'Korna',              en: 'Horn',               gruplar: ['fonksiyon'] },
      { id: 'f_silecek',       ad: 'Silecek / cam yıkama',en: 'Wiper & washer',    gruplar: ['fonksiyon', 'ses'] },
      { id: 'f_sarj',          ad: 'Şarj işlemi (EV)',   en: 'Charging (EV)',      gruplar: ['fonksiyon'], sadeceEv: true },
    ],
  },
  {
    id: 'surus', ad: 'Yol testi', en: 'Road test', grup: 'surus', simge: '⇄',
    parcalar: [
      { id: 's_guc',         ad: 'Güç aktarma / kalkış', en: 'Powertrain / launch',gruplar: ['fonksiyon', 'ses'] },
      { id: 's_sanziman',    ad: 'Şanzıman / redüktör',  en: 'Transmission / reducer', gruplar: ['fonksiyon', 'ses'] },
      { id: 's_fren',        ad: 'Fren',                 en: 'Brakes',             gruplar: ['fonksiyon', 'ses'] },
      { id: 's_direksiyon',  ad: 'Direksiyon davranışı', en: 'Steering behaviour', gruplar: ['fonksiyon', 'ses'] },
      { id: 's_suspansiyon', ad: 'Süspansiyon / yol tutuş', en: 'Suspension / ride', gruplar: ['fonksiyon', 'ses'] },
      { id: 's_rejen',       ad: 'Rejeneratif fren (EV)',en: 'Regenerative braking', gruplar: ['fonksiyon', 'ses'], sadeceEv: true },
      { id: 's_lastik',      ad: 'Lastik / balans',      en: 'Tyre / balance',     gruplar: ['fonksiyon', 'ses'] },
      { id: 's_sr',          ad: 'S&R — yolda gıcırtı/tıkırtı', en: 'S&R on road', gruplar: ['ses'] },
      { id: 's_ruzgar',      ad: 'Yolda rüzgâr sesi',    en: 'Wind noise on road', gruplar: ['ses'] },
      { id: 's_adas_yol',    ad: 'ADAS yol davranışı',   en: 'ADAS on road',       gruplar: ['fonksiyon'] },
    ],
  },
];

/** Yan panelleri (sol/sağ) üreten şablon — iki bölge olarak açılır. */
const YAN_PARCALAR: Parca[] = [
  { id: 'on_camurluk',   ad: 'Ön çamurluk',        en: 'Front fender',        gruplar: DIS_PANEL, mesh: 'on_camurluk' },
  { id: 'a_diregi',      ad: 'A direği (dış)',     en: 'A pillar (ext.)',     gruplar: DIS_PANEL, mesh: 'a_diregi' },
  { id: 'on_kapi',       ad: 'Ön kapı',            en: 'Front door',          gruplar: DIS_PANEL, mesh: 'on_kapi' },
  { id: 'on_kapi_cam',   ad: 'Ön kapı camı',       en: 'Front door glass',    gruplar: CAM_TAKIMI, mesh: 'on_kapi_cam' },
  { id: 'b_diregi',      ad: 'B direği (dış)',     en: 'B pillar (ext.)',     gruplar: DIS_PANEL, mesh: 'b_diregi' },
  { id: 'arka_kapi',     ad: 'Arka kapı',          en: 'Rear door',           gruplar: DIS_PANEL, mesh: 'arka_kapi' },
  { id: 'arka_kapi_cam', ad: 'Arka kapı camı',     en: 'Rear door glass',     gruplar: CAM_TAKIMI, mesh: 'arka_kapi_cam' },
  { id: 'c_diregi',      ad: 'C direği (dış)',     en: 'C pillar (ext.)',     gruplar: DIS_PANEL, mesh: 'c_diregi' },
  { id: 'arka_camurluk', ad: 'Arka çamurluk',      en: 'Rear fender / quarter', gruplar: DIS_PANEL, mesh: 'arka_camurluk' },
  { id: 'marspiyel',     ad: 'Marşpiyel / eşik',   en: 'Rocker / side sill',  gruplar: DIS_PANEL, mesh: 'marspiyel' },
  { id: 'ayna',          ad: 'Dış dikiz aynası',   en: 'Exterior mirror',     gruplar: [...DIS_PANEL, 'fonksiyon'], mesh: 'ayna' },
  { id: 'kapi_kolu',     ad: 'Dış kapı kolu',      en: 'Exterior door handle',gruplar: [...DIS_PANEL, 'fonksiyon'] },
  { id: 'cam_fitili',    ad: 'Cam / kapı fitili',  en: 'Door weatherstrip',   gruplar: ['sizdirmazlik', 'montaj', 'ses'] },
  { id: 'kapi_cita',     ad: 'Kapı çıtası',        en: 'Door moulding',       gruplar: DIS_PANEL },
  { id: 'on_jant',       ad: 'Ön jant / lastik',   en: 'Front wheel / tyre',  gruplar: ['yuzey', 'montaj', 'fonksiyon'], mesh: 'jant_on' },
  { id: 'arka_jant',     ad: 'Arka jant / lastik', en: 'Rear wheel / tyre',   gruplar: ['yuzey', 'montaj', 'fonksiyon'], mesh: 'jant_arka' },
  { id: 'davlumbaz',     ad: 'Çamurluk davlumbazı',en: 'Wheel arch liner',    gruplar: ['montaj', 'ses'] },
  { id: 'dolum_kapagi',  ad: 'Yakıt / şarj kapağı',en: 'Fuel / charge lid',   gruplar: [...DIS_PANEL, 'fonksiyon'] },
];

/** Sol ve sağ yan bölgeleri, ortak şablondan türetilir. */
function yanBolge(taraf: Taraf, ad: string, en: string, simge: string): Bolge {
  return {
    id: `dis_${taraf}`, ad, en, grup: 'dis', simge, taraf,
    parcalar: YAN_PARCALAR.map((p) => ({
      ...p, taraf,
      id: `${taraf}_${p.id}`,
      mesh: p.mesh ? `${taraf}_${p.mesh}` : undefined,
    })),
  };
}

/** Tam bölge listesi — sol/sağ açılmış, sıralanmış hâli. */
export const BOLGELER: Bolge[] = (() => {
  const liste = HAM_BOLGELER.map((b) => ({ ...b, parcalar: ciftle(b.parcalar) }));
  const onIndeks = liste.findIndex((b) => b.id === 'dis_arka');
  liste.splice(onIndeks, 0,
    yanBolge('sol', 'Dış · Sol yan', 'Exterior · LH side', '◧'),
    yanBolge('sag', 'Dış · Sağ yan', 'Exterior · RH side', '◨'));
  return liste;
})();

/** parcaId -> { ...parca, bolge } hızlı arama tablosu. */
export const PARCA_INDEKS: Record<string, ParcaKayit> = (() => {
  const m: Record<string, ParcaKayit> = {};
  for (const b of BOLGELER) for (const p of b.parcalar) m[p.id] = { ...p, bolgeId: b.id, bolgeAd: b.ad, bolgeEn: b.en };
  return m;
})();

/** Bir parçada seçilebilecek hata tipleri (grubuna göre süzülmüş). */
export function parcaHataTipleri(parcaId: string): HataTipi[] {
  const p = PARCA_INDEKS[parcaId];
  if (!p) return [];
  const izin = new Set(p.gruplar);
  return tumHataTipleri().filter((h) => izin.has(h.grup));
}

/** Araç tipine (ev/ice) uymayan parçaları eler. */
export function bolgelerAracIcin(arac: { tip?: AracTipi } | null | undefined): Bolge[] {
  const ev = arac?.tip === 'ev';
  return BOLGELER.map((b) => ({
    ...b,
    parcalar: b.parcalar.filter((p) => (p.sadeceEv ? ev : true) && (p.sadeceIce ? !ev : true)),
  })).filter((b) => b.parcalar.length > 0);
}

/**
 * Hızlı seçim kalıpları — denetçinin en sık gördüğü parça+hata ikilileri.
 * Tek dokunuşla kayıt açar. Uygulama, kullanım sayacına göre bu listeyi
 * kendi kendine yeniden sıralar (bkz. depo.js → sikKullanilanlar).
 */
export const HIZLI_KALIPLAR: [string, string][] = [
  ['sol_arka_kapi', 'gicirti'], ['sag_arka_kapi', 'gicirti'],
  ['sol_on_kapi', 'gicirti'],   ['sag_on_kapi', 'gicirti'],
  ['sol_a_garnis', 'gocuk'],    ['sag_a_garnis', 'gocuk'],
  ['sol_b_garnis', 'oturmamis'],['sag_b_garnis', 'oturmamis'],
  ['kaput', 'bosluk'],          ['bagaj_kapagi', 'bosluk'],
  ['on_tampon', 'kademe'],      ['arka_tampon', 'kademe'],
  ['sol_on_kapi', 'bosluk'],    ['sag_on_kapi', 'bosluk'],
  ['tavan', 'toz_kir'],         ['kaput', 'toz_kir'],
  ['sol_arka_camurluk', 'cizik'], ['sag_arka_camurluk', 'cizik'],
  ['ip_ust', 'tikirti'],        ['orta_konsol', 'tikirti'],
  ['sol_on_kapi_doseme', 'tikirti'], ['sag_on_kapi_doseme', 'tikirti'],
  ['tavan_doseme', 'leke'],     ['surucu_koltuk', 'leke'],
  ['on_cam', 'cam_cizik'],      ['s_sr', 'gicirti'],
  ['sol_cam_fitili', 'fitil'],  ['sag_cam_fitili', 'fitil'],
  ['f_multimedya', 'calismiyor'], ['sol_far', 'calismiyor'],
];
