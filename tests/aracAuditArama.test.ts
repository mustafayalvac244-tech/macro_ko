import { describe, expect, it } from 'vitest';

import { aramaEslesir, aramaMetni, aramaSadelestir } from '../arac-audit-app/src/cekirdek/arama';
import {
  bolgelerAracIcin, parcaAramaMetni, parcaHataTipleri, parcaTamAdi,
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
    // Dış panelde tanımlı sıra değişmedi: önce yüzey.
    expect(parcaHataTipleri('kaput')[0]?.grup).toBe('yuzey');
  });
});
