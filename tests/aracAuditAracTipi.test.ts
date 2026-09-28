import { describe, expect, it } from 'vitest';

import { BOLGELER, bolgelerAracIcin, PARCA_INDEKS } from '../arac-audit-app/src/cekirdek/katalog';

// Ürün sahibi, 28.09.2026: "Elektrikli araç seçince özellikler ona göre
// gelsin." Önceden iki araç tipinde de "Yakıt / şarj kapağı" ve "Şanzıman /
// redüktör" görünüyordu; elektrikli araçta "yakıt" ve "şanzıman" yazıyordu.

const kimlikler = (tip: 'ev' | 'ice') =>
  bolgelerAracIcin({ tip }).flatMap((b) => b.parcalar.map((p) => p.id));
const adlar = (tip: 'ev' | 'ice') =>
  bolgelerAracIcin({ tip }).flatMap((b) => b.parcalar.map((p) => p.ad));

describe('araç tipine göre parçalar', () => {
  it('elektrikli araçta şarj kapağı ve redüktör var, yakıt ve şanzıman yok', () => {
    const ev = kimlikler('ev');
    for (const id of ['sol_sarj_kapagi', 'sag_sarj_kapagi', 's_reduktor', 'sarj_soketi', 'batarya_muh']) {
      expect(ev, id).toContain(id);
    }
    for (const id of ['sol_dolum_kapagi', 'sag_dolum_kapagi', 's_sanziman', 'yakit_deposu', 'egzoz_hatti', 'motor_ice']) {
      expect(ev, id).not.toContain(id);
    }
  });

  it('benzinli araçta yakıt kapağı ve şanzıman var, şarj ve HV parçaları yok', () => {
    const ice = kimlikler('ice');
    for (const id of ['sol_dolum_kapagi', 'sag_dolum_kapagi', 's_sanziman', 'yakit_deposu']) {
      expect(ice, id).toContain(id);
    }
    for (const id of ['sol_sarj_kapagi', 'sag_sarj_kapagi', 's_reduktor', 'sarj_soketi', 'batarya_muh', 'hv_kablo', 'f_sarj', 's_rejen']) {
      expect(ice, id).not.toContain(id);
    }
  });

  it('elektrikli araçta ekranda "yakıt", "şanzıman", "(EV)" geçmez', () => {
    // "(EV)" eki yalnız elektrikliye çıkan parçada zaten gereksizdi.
    const yasak = /yakıt|şanzıman|egzoz|\(EV\)/i;
    expect(adlar('ev').filter((a) => yasak.test(a))).toEqual([]);
  });

  it('eski kayıtların parça kimlikleri hâlâ çözülür', () => {
    // Kimlikler korundu: eski bir kayıtta "sol_dolum_kapagi" varsa raporda
    // ham kimlik değil parça adı görünmeli.
    expect(PARCA_INDEKS.sol_dolum_kapagi?.ad).toBe('Yakıt kapağı');
    expect(PARCA_INDEKS.s_sanziman?.ad).toBe('Şanzıman');
  });

  it('parça kimlikleri benzersiz', () => {
    const hepsi = BOLGELER.flatMap((b) => b.parcalar.map((p) => p.id));
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });
});
