import { describe, expect, it } from 'vitest';

import { aramaEslesir, aramaMetni, aramaSadelestir, aramaYakinEslesir, duzenlemeUzakligi, esnekSuz } from '../arac-audit-app/src/cekirdek/arama';
import {
  bolgelerAracIcin, parcaAdMetni, parcaAramaMetni, parcaHataTipleri, parcaTamAdi,
} from '../arac-audit-app/src/cekirdek/katalog';

// Kullanılabilirlik sınaması (üç ajan, web paketi, 28.09.2026): "sol ön kapı"
// araması dıştaki sol ön kapıyı bulmuyordu, yalnız iç döşemeyi getiriyordu;
// "on kapi", "bosluk" gibi Türkçe karaktersiz aramalar 0 sonuç veriyordu.
// Aşağıdaki sorguların hepsi ajanların GERÇEKTE yazıp başarısız olduğu sorgular.

const bulunanlar = (sorgu: string, tip: 'ev' | 'ice' = 'ice') =>
  bolgelerAracIcin({ tip }).flatMap((b) => b.parcalar)
    .filter((p) => aramaEslesir(parcaAramaMetni(p.id), sorgu))
    .map((p) => p.id);

describe('sadeleştirme', () => {
  it('Türkçe harfleri Latin karşılığına indirir, noktalamayı boşluk yapar', () => {
    expect(aramaSadelestir('Sağ Ön Kapı')).toBe('sag on kapi');
    expect(aramaSadelestir('İÇ · ÖN KONSOL')).toBe('ic on konsol');
    expect(aramaSadelestir('  Marşpiyel / eşik ')).toBe('marspiyel esik');
  });
});

describe('parça araması', () => {
  it('"sol ön kapı" dıştaki sol ön kapıyı bulur, sağdakini bulmaz', () => {
    const b = bulunanlar('sol ön kapı');
    expect(b).toContain('sol_on_kapi');
    expect(b).not.toContain('sag_on_kapi');
  });

  it('kelime sırası ve Türkçe karakter şart değil', () => {
    expect(bulunanlar('on kapi sol')).toContain('sol_on_kapi');
    expect(bulunanlar('sag on kapi')).toContain('sag_on_kapi');
    expect(bulunanlar('sol arka camurluk')).toContain('sol_arka_camurluk');
  });

  it('LH/RH ve İngilizce adla da bulur', () => {
    expect(bulunanlar('LH front door')).toContain('sol_on_kapi');
    expect(bulunanlar('rh fender')).toContain('sag_on_camurluk');
  });

  it('kelimenin başından eşleşir: "sol" konSOL’u getirmez', () => {
    const b = bulunanlar('sol');
    expect(b).not.toContain('orta_konsol');
    expect(b).toContain('sol_on_kapi');
  });

  it('elektrikli araçta benzinliye özgü parça aramada da çıkmaz', () => {
    expect(bulunanlar('yakıt kapağı', 'ev')).toEqual([]);
    expect(bulunanlar('şarj kapağı', 'ev').length).toBeGreaterThan(0);
  });

  it('tam ad tarafı taşır', () => {
    expect(parcaTamAdi('sol_on_kapi')).toBe('Sol ön kapı');
    expect(parcaTamAdi('sag_on_kapi', 'en')).toMatch(/^RH /);
  });
});

describe('hata tipi araması ve sırası', () => {
  it('"bosluk" Türkçe karaktersiz yazılınca da boşluk hatalarını bulur', () => {
    const b = parcaHataTipleri('kaput').filter((t) => aramaEslesir(aramaMetni(t.ad, t.en), 'bosluk'));
    expect(b.length).toBeGreaterThan(0);
    for (const t of b) expect(aramaSadelestir(`${t.ad} ${t.en}`)).toContain('bosluk');
  });

  it('camda önce "Cam" grubu gelir (parçanın kendi grup sırası)', () => {
    expect(parcaHataTipleri('on_cam')[0]?.grup).toBe('cam');
    // Dış panelde önce montaj (26.10.2026): ekibin Excel'inde dış sistem
    // kayıtlarında montaj tipi problemler (boşluk, kademe) yüzey tiplerinden
    // belirgin biçimde sık. Önceden önce yüzeydi.
    expect(parcaHataTipleri('kaput')[0]?.grup).toBe('montaj');
  });
});

// 26.10.2026 — dış değerlendirme: grubu uysa da parçada anlamsız tipler.
describe('parçada anlamsız hata tipi gösterilmez', () => {
  const idler = (pid: string) => parcaHataTipleri(pid).map((t) => t.id);

  it('kabloda boşluk/kademe yok, gevşek/oturmamış var', () => {
    for (const pid of ['hv_kablo', 'kablo_demeti']) {
      expect(idler(pid)).not.toContain('bosluk_fazla');
      expect(idler(pid)).not.toContain('kademe');
      expect(idler(pid)).toContain('gevsek');
    }
  });

  it('iç döşemede boyaya özgü tip yok; plastikte de olan kalır', () => {
    const d = idler('sol_on_kapi_doseme');
    for (const x of ['kaynak_izi', 'pas', 'portakal', 'akinti', 'krater', 'boyasiz', 'toz_kir']) expect(d).not.toContain(x);
    for (const x of ['cizik', 'kalip_izi', 'cokuntu', 'renk_farki']) expect(d).toContain(x);
  });

  it('dış panelde boya tipleri yerinde (yalnız iç bölge süzülür)', () => {
    for (const x of ['kaynak_izi', 'pas', 'portakal', 'akinti']) expect(idler('kaput')).toContain(x);
  });

  it('frende rüzgâr ve yol sesi yok, gıcırtı var', () => {
    expect(idler('s_fren')).not.toContain('ruzgar_sesi');
    expect(idler('s_fren')).not.toContain('yol_sesi');
    expect(idler('s_fren')).toContain('gicirti');
  });

  it('sahadaki başka adla aranır: "depo kapagi", "konnektor"', () => {
    expect(aramaEslesir(parcaAramaMetni('sol_dolum_kapagi'), 'depo kapagi')).toBe(true);
    expect(aramaEslesir(parcaAramaMetni('kablo_demeti'), 'konnektor')).toBe(true);
  });
});

// 26.10.2026 — ikinci dış değerlendirme (saha denetçisi): eş anlamlılar ve yazım
// hatası. Sorguları değerlendirici yazdı, beklentileri ben yazdım.
describe('ikinci tur: eş anlamlı ve yazım hatası', () => {
  const yakin = (sorgu: string) => bolgelerAracIcin({ tip: 'ice' }).flatMap((b) => b.parcalar)
    .filter((p) => aramaYakinEslesir(parcaAramaMetni(p.id), sorgu)).map((p) => p.id);

  it('menteşe, kapı kilidi, bagaj fitili, yan etek, sunroof bulunur', () => {
    expect(bulunanlar('mentese')).toEqual(expect.arrayContaining(['kaput', 'sol_on_kapi', 'sag_arka_kapi', 'bagaj_kapagi']));
    expect(bulunanlar('kapı kilidi')).toEqual(expect.arrayContaining(['sol_on_kapi', 'f_merkezi_kilit']));
    expect(bulunanlar('bagaj fitili')).toEqual(['bagaj_fitili']);
    expect(bulunanlar('sol yan etek')).toEqual(['sol_marspiyel']);
    expect(bulunanlar('sunroof')).toEqual(['cam_tavan']);
    // Ekibin Excel kısaltmaları
    expect(bulunanlar('t/gate w/strip')).toEqual(['bagaj_fitili']);
    expect(bulunanlar('striker')).toEqual(expect.arrayContaining(['sol_on_kapi', 'sag_arka_kapi']));
  });

  it('düzenleme uzaklığı: yer değiştirme tek adım', () => {
    expect(duzenlemeUzakligi('kaptu', 'kaput')).toBe(1);
    expect(duzenlemeUzakligi('camurlk', 'camurluk')).toBe(1);
    expect(duzenlemeUzakligi('abc', 'abc')).toBe(0);
    expect(duzenlemeUzakligi('', 'abc')).toBe(3);
  });

  it('yazım hatalı sorgu yakın aramada bulunur, tam aramada bulunmaz', () => {
    expect(bulunanlar('kaptu')).toEqual([]);
    expect(yakin('kaptu')).toContain('kaput');
    expect(yakin('sol on camurlk')).toContain('sol_on_camurluk');
    expect(yakin('tampn')).toEqual(expect.arrayContaining(['on_tampon', 'arka_tampon']));
  });

  it('kısa kelimede hata kabul edilmez; anlamsız sorgu yakın aramada da boş', () => {
    expect(yakin('xq')).toEqual([]);
    expect(yakin('zzzzzz')).toEqual([]);
    // 3 harf: yalnız tam baş eşleşmesi ("kpt" kaput'u getirmez)
    expect(yakin('kpt')).toEqual([]);
  });
});

// 27.10.2026 — ürün sahibi: "araç parçalarını iyi öğren". Ekibin Excel'i parça
// adlarını Hyundai'nin parça kataloğu kısaltmalarıyla yazıyor. Aşağıdaki
// sorgular o yazım BİÇİMİNDE (genel Hyundai terimleri); beklentileri ben yazdım.
// Ekibin dosyasının bütününde ölçülen kapsam/doğruluk sayıları depoya yazılmadı.
describe('Hyundai katalog kısaltmaları', () => {
  const parcalar = (tip: 'ev' | 'ice' = 'ice') => bolgelerAracIcin({ tip }).flatMap((b) => b.parcalar);
  const ara = (sorgu: string, tip: 'ev' | 'ice' = 'ice') =>
    esnekSuz(parcalar(tip), (p) => parcaAramaMetni(p.id), sorgu, (p) => parcaAdMetni(p.id)).map((p) => p.id);

  it('ilk sonuç beklenen parça', () => {
    const beklenen: [string, string][] = [
      ['FRT BUMPER', 'on_tampon'], ['RR BUMPER', 'arka_tampon'], ['T GATE', 'bagaj_kapagi'],
      ['T/GATE INR PNL', 'bagaj_ic_panel'], ['T GATE PNL', 'bagaj_kapagi'], ['T GATE TRIM', 'bagaj_ic_kapak'],
      ['T GATE SPOILER', 'spoyler'], ['HOOD(FRT PNL) INR PNL', 'kaput_ic'], ['HOOD PNL', 'kaput'],
      ['SEAT BACK-LH FRT', 'surucu_koltuk'], ['SEAT CUSHION-RH FRT', 'yolcu_koltuk'], ['SEAT BACK RH RR', 'arka_koltuk_sirt'],
      ['FRT DR TRIM-LH', 'sol_on_kapi_doseme'], ['RR DR W STRIP-RH', 'sag_cam_fitili'], ['FRT DR FRAME BLACK TAPE-LH', 'sol_on_kapi_bant'],
      ['FRT DR PNL INR-RH', 'sag_on_kapi_ic'], ['FRT DR PNL OTR-LH', 'sol_on_kapi'], ['RR DR BELT MOLD\'G O S-LH', 'sol_kapi_cita'],
      ['COWL TOP COVER-LH', 'on_panel'], ['C PAD-UPR', 'ip_ust'], ['FRT W SHIELD GLASS MOLD\'G', 'on_cam_cita'],
      ['RH C LAMP-QTR PNL', 'sag_stop'], ['QTR PNL-RH', 'sag_arka_camurluk'], ['FUEL FLR DR', 'sol_dolum_kapagi'],
      ['FRT DR O S MIRROR-LH', 'sol_ayna'], ['PARK\'G BRAKE LEVER', 'el_freni'], ['RR BUMPER PARKING SENSOR', 'arka_park_sensor'],
      ['BRAKE BOOSTER VACUUM HOSE', 'fren_hatti'], ['ENG MAIN WIR\'G', 'kablo_demeti'], ['MFC COVER', 'mfc_kapak'],
      ['RADIATOR AIR FLAP', 'alt_panjur'], ['FRT BUMPER LWR GRAY GARNISH', 'on_tampon_alt_garnis'],
    ];
    for (const [q, id] of beklenen) expect(ara(q)[0], q).toBe(id);
  });

  it('Türkçe ve İngilizce adla air flap bulunur (elektrikli araçta da)', () => {
    for (const q of ['air flap', 'aktif hava klapesi', 'klape', 'AAF']) expect(ara(q, 'ev')[0], q).toBe('alt_panjur');
  });

  it('kısaltma yalnız kendisine eşleşir: "dr" kapıdır, DRL\'yi getirmez', () => {
    expect(ara('FRT DR')).not.toContain('sol_drl');
    expect(aramaEslesir(parcaAramaMetni('sol_drl'), 'drl')).toBe(true);
  });

  it('Excel eki (LH, PNL, AREA, CLOS\'G) sonuç yoksa atlanır; taraf en son', () => {
    expect(ara("T GATE CLOS'G")[0]).toBe('bagaj_kapagi');
    expect(ara('FRT BUMPER LH')[0]).toBe('on_tampon');
    expect(ara('RH C LAMP-QTR PNL')).toEqual(['sag_stop']);
  });
});
