import { describe, expect, it } from 'vitest';

import {
  aynalaHarita, cokgenAlani, GorunumHaritasi, noktadakiParca, PARCA_HARITALARI,
} from '../arac-audit-app/src/cekirdek/gorunumParcalari';
import { bolgelerAracIcin } from '../arac-audit-app/src/cekirdek/katalog';
import { ARAC_INDEKS } from '../arac-audit-app/src/cekirdek/model3d';

// 26.10.2026 — ürün sahibi: "sol ön garnişe tıklayınca o parça seçilsin."
// Döndürülebilir araç görünümünde parça çokgenleri. Beklentileri ben yazdım.

const kare = (x0: number, y0: number, x1: number, y1: number) =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const;

describe('noktadakiParca', () => {
  const harita: GorunumHaritasi = {
    oran: 2,
    alanlar: [
      { parcaId: 'sol_on_kapi', nokta: kare(0.1, 0.1, 0.9, 0.9) },
      { parcaId: 'sol_kapi_kolu', nokta: kare(0.4, 0.4, 0.6, 0.6) },
    ],
  };

  it('iç içe karelerde küçük olan kazanır; dışta büyük; hiçbirinde değilse null', () => {
    expect(noktadakiParca(harita, 0.5, 0.5)).toBe('sol_kapi_kolu');
    expect(noktadakiParca(harita, 0.2, 0.2)).toBe('sol_on_kapi');
    expect(noktadakiParca(harita, 0.95, 0.5)).toBeNull();
    expect(noktadakiParca(harita, 0.5, 0.05)).toBeNull();
  });

  it('sıra fark etmez: küçük önce de yazılsa küçük kazanır', () => {
    const ters: GorunumHaritasi = { oran: 2, alanlar: [...harita.alanlar].reverse() };
    expect(noktadakiParca(ters, 0.5, 0.5)).toBe('sol_kapi_kolu');
  });

  it('içbükey çokgen: girintideki nokta dışarıda sayılır', () => {
    // "C" biçimi: sağ ortası oyuk.
    const c: GorunumHaritasi = {
      oran: 1,
      alanlar: [{ parcaId: 'c', nokta: [[0, 0], [1, 0], [1, 0.3], [0.4, 0.3], [0.4, 0.7], [1, 0.7], [1, 1], [0, 1]] }],
    };
    expect(noktadakiParca(c, 0.2, 0.5)).toBe('c');
    expect(noktadakiParca(c, 0.7, 0.5)).toBeNull();
    expect(noktadakiParca(c, 0.7, 0.15)).toBe('c');
  });

  it('alan: birim kare 1, üçgen 0,5; ikiden az köşeli alan yok sayılır', () => {
    expect(cokgenAlani(kare(0, 0, 1, 1))).toBeCloseTo(1, 12);
    expect(cokgenAlani([[0, 0], [1, 0], [0, 1]])).toBeCloseTo(0.5, 12);
    expect(noktadakiParca({ oran: 1, alanlar: [{ parcaId: 'cizgi', nokta: [[0, 0], [1, 1]] }] }, 0.5, 0.5)).toBeNull();
  });
});

describe('aynalaHarita', () => {
  const sol: GorunumHaritasi = {
    oran: 2,
    alanlar: [
      { parcaId: 'sol_on_kapi', nokta: kare(0.1, 0.2, 0.3, 0.8) },
      { parcaId: 'kaput', nokta: kare(0.5, 0.1, 0.6, 0.2) },
      { parcaId: 'sag_ayna', nokta: kare(0.7, 0.3, 0.8, 0.4) },
    ],
  };
  const ayna = aynalaHarita(sol);

  it('x → 1 − x; sol_ ↔ sag_; tarafsız kimlik aynı; oran korunur', () => {
    expect(ayna.oran).toBe(2);
    expect(ayna.alanlar.map((a) => a.parcaId)).toEqual(['sag_on_kapi', 'kaput', 'sol_ayna']);
    expect(noktadakiParca(sol, 0.2, 0.5)).toBe('sol_on_kapi');
    expect(noktadakiParca(ayna, 0.8, 0.5)).toBe('sag_on_kapi');
    expect(noktadakiParca(ayna, 0.2, 0.5)).toBeNull();
    expect(noktadakiParca(ayna, 0.25, 0.35)).toBe('sol_ayna');
  });

  it('iki kez aynalamak ilk haritayı verir; ilk harita değişmez', () => {
    const iki = aynalaHarita(ayna);
    expect(iki.alanlar.map((a) => a.parcaId)).toEqual(sol.alanlar.map((a) => a.parcaId));
    expect(iki.alanlar[0]!.nokta[0]![0]).toBeCloseTo(0.1, 12);
    expect(sol.alanlar[0]!.parcaId).toBe('sol_on_kapi');
  });
});

// IONIQ 3 haritası (ioniq3Haritasi.ts). Çokgenleri de, aşağıdaki işaret
// noktalarını da BEN seçtim (kaplama görsellerine bakarak); bu test bağımsız bir
// doğrulama değil, verinin sonradan bozulmasına karşı bekçi.
describe('veri — IONIQ 3', () => {
  const H = PARCA_HARITALARI.ioniq3!;
  const evParcalari = new Set(bolgelerAracIcin(ARAC_INDEKS.ioniq3).flatMap((b) => b.parcalar.map((p) => p.id)));

  it('sekiz bakış var; sağ yan YOK (sol yanın aynası kullanılır); oran 2', () => {
    expect(Object.keys(H).sort()).toEqual(['arka', 'on', 'sag_arka', 'sag_on', 'sol', 'sol_arka', 'sol_on', 'ust']);
    for (const h of Object.values(H)) expect(h!.oran).toBe(2);
  });

  it('her parça kimliği katalogda ve IONIQ 3 (elektrikli) için listeleniyor', () => {
    const eksik = Object.entries(H).flatMap(([g, h]) => h!.alanlar.filter((a) => !evParcalari.has(a.parcaId)).map((a) => `${g}:${a.parcaId}`));
    expect(eksik).toEqual([]);
  });

  it('çokgenler: en az 3 köşe, 0–1 içinde, kendini kesmiyor', () => {
    const kesisir = (p1: readonly number[], p2: readonly number[], p3: readonly number[], p4: readonly number[]) => {
      const d = (a: readonly number[], b: readonly number[], c: readonly number[]) => (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
      const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    const sorun: string[] = [];
    for (const [g, h] of Object.entries(H)) {
      h!.alanlar.forEach((a, i) => {
        const n = a.nokta;
        if (n.length < 3) sorun.push(`${g}[${i}] ${a.parcaId}: ${n.length} köşe`);
        if (n.some(([x, y]) => !(x >= 0 && x <= 1 && y >= 0 && y <= 1))) sorun.push(`${g}[${i}] ${a.parcaId}: aralık dışı`);
        for (let k = 0; k < n.length; k++) {
          for (let j = k + 2; j < n.length; j++) {
            if (k === 0 && j === n.length - 1) continue;
            if (kesisir(n[k]!, n[(k + 1) % n.length]!, n[j]!, n[(j + 1) % n.length]!)) sorun.push(`${g}[${i}] ${a.parcaId}: kenar ${k}×${j}`);
          }
        }
      });
    }
    expect(sorun).toEqual([]);
  });

  // [x %, y %, beklenen parça] — görseldeki konum, yüzde.
  const ISARET: Record<string, readonly (readonly [number, number, string])[]> = {
    sol: [[21.7, 51, 'sol_camurluk_garnis'], [82.5, 49, 'sol_qtr_garnis'], [45, 55, 'sol_on_kapi'], [65, 50, 'sol_arka_kapi'],
      [21.7, 69.6, 'sol_on_jant'], [82.5, 69.6, 'sol_arka_jant'], [37.5, 37.5, 'sol_ayna'], [52.5, 46.3, 'sol_kapi_kolu'],
      [15, 41.6, 'kaput'], [50, 72, 'sol_marspiyel'], [60, 16.8, 'sol_tavan_cita'], [48, 30, 'sol_on_kapi_cam'], [7, 53, 'sol_far']],
    sol_on: [[52, 51.5, 'sol_camurluk_garnis'], [17, 65, 'on_plaka'], [36, 54.5, 'sol_far'], [25, 40, 'kaput'], [45, 22, 'on_cam'],
      [50.5, 74.5, 'sol_on_jant'], [66, 32, 'sol_ayna'], [68, 50, 'sol_on_kapi'], [92, 46, 'sol_qtr_garnis'], [14, 86, 'sag_on_jant'],
      [61, 37, 'sol_delta_garnis']],
    on: [[50, 66, 'on_plaka'], [29, 54, 'sag_far'], [71, 54, 'sol_far'], [50, 40, 'kaput'], [50, 20, 'on_cam'], [19, 31, 'sag_ayna'],
      [81, 31, 'sol_ayna'], [50, 54, 'on_izgara']],
    arka: [[50, 61, 'arka_plaka'], [50, 50, 'bagaj_kapagi'], [50, 12, 'arka_cam'], [28, 37.5, 'sol_stop'], [72, 37.5, 'sag_stop'],
      [50, 68, 'arka_tampon'], [25, 90, 'sol_arka_jant']],
    sol_arka: [[51, 78, 'sol_arka_jant'], [51, 49, 'sol_qtr_garnis'], [82.5, 61, 'arka_plaka'], [22, 50, 'sol_on_kapi'],
      [38, 50, 'sol_arka_kapi'], [83, 51, 'bagaj_kapagi'], [8, 45, 'sol_camurluk_garnis']],
    sag_arka: [[50.5, 80, 'sag_arka_jant'], [89, 72, 'sag_on_jant'], [51.5, 49, 'sag_qtr_garnis'], [78, 58, 'sag_on_kapi'],
      [64, 55, 'sag_arka_kapi'], [18.5, 61, 'arka_plaka'], [91.3, 50, 'sag_camurluk_garnis']],
    sag_on: [[48, 75, 'sag_on_jant'], [46.5, 50, 'sag_camurluk_garnis'], [83, 66.5, 'on_plaka'], [63, 55.5, 'sag_far'],
      [32, 31, 'sag_ayna'], [30, 50, 'sag_on_kapi'], [75, 40, 'kaput']],
    ust: [[18, 50, 'kaput'], [35, 50, 'on_cam'], [60, 50, 'cam_tavan'], [86, 50, 'arka_cam'], [38.5, 6, 'sag_ayna'],
      [38.5, 94, 'sol_ayna'], [47, 12, 'sag_on_kapi'], [47, 88, 'sol_on_kapi']],
  };

  it('işaret noktaları beklenen parçayı seçer (ürün sahibinin örneği: sol ön garniş)', () => {
    const uymayan: string[] = [];
    for (const [g, liste] of Object.entries(ISARET)) {
      for (const [x, y, beklenen] of liste) {
        const p = noktadakiParca(H[g as keyof typeof H]!, x / 100, y / 100);
        if (p !== beklenen) uymayan.push(`${g} (${x}, ${y}): ${p} ≠ ${beklenen}`);
      }
    }
    expect(uymayan).toEqual([]);
  });

  it('sağ yan = sol yanın aynası: sağ ön garniş, sağ ön kapı, sağ ayna', () => {
    const sag = aynalaHarita(H.sol!);
    expect(noktadakiParca(sag, 1 - 0.217, 0.51)).toBe('sag_camurluk_garnis');
    expect(noktadakiParca(sag, 1 - 0.45, 0.55)).toBe('sag_on_kapi');
    expect(noktadakiParca(sag, 1 - 0.375, 0.375)).toBe('sag_ayna');
  });

  it('kapı kolu kapının, ayna kapının üstünde: küçük olan kazanır', () => {
    expect(noktadakiParca(H.sol!, 0.525, 0.463)).toBe('sol_kapi_kolu');
    expect(noktadakiParca(H.sol!, 0.5, 0.52)).toBe('sol_on_kapi');
  });
});

// 27.10.2026 — ürün sahibi: "air flapler seçilmiyor". Haritada "alt panjur" yalnız
// plakanın altındaki koyu bloğu (genişliğin %8'i) kaplıyordu; Hyundai'nin IONIQ 3
// sayfası klapeyi "above the silver skid plate" diye tarif ediyor — iki yandaki
// paneller "ön tampon" seçiliyordu. Noktalar ürün sahibinin görsellerinde ölçüldü.
describe('IONIQ 3: aktif hava klapesi (AAF) seçilir', () => {
  const h = PARCA_HARITALARI.ioniq3!;
  it('önden: sol ve sağ klape paneli ve ortadaki blok klape; altındaki gümüş alt koruma ayrı', () => {
    expect(noktadakiParca(h.on!, 0.40, 0.75)).toBe('alt_panjur');
    expect(noktadakiParca(h.on!, 0.60, 0.75)).toBe('alt_panjur');
    expect(noktadakiParca(h.on!, 0.50, 0.74)).toBe('alt_panjur');
    expect(noktadakiParca(h.on!, 0.40, 0.83)).toBe('on_tampon_alt_garnis');
    expect(noktadakiParca(h.on!, 0.50, 0.66)).toBe('on_plaka');
  });
  it('sol önden ve sağ önden de klape seçilir', () => {
    expect(noktadakiParca(h.sol_on!, 0.09, 0.72)).toBe('alt_panjur');
    expect(noktadakiParca(h.sol_on!, 0.25, 0.74)).toBe('alt_panjur');
    expect(noktadakiParca(h.sag_on!, 0.75, 0.74)).toBe('alt_panjur');
    expect(noktadakiParca(h.sag_on!, 0.92, 0.73)).toBe('alt_panjur');
  });
});
