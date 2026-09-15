import { describe, it, expect } from 'vitest';
// @ts-ignore
import { BOLGELER, PARCA_INDEKS, HATA_TIPLERI, HATA_TIPI_INDEKS, HATA_GRUPLARI, SIDDETLER, parcaHataTipleri, bolgelerAracIcin, HIZLI_KALIPLAR } from '../arac-audit/js/katalog.js';
// @ts-ignore
import { ARACLAR, geometriUret } from '../arac-audit/js/model3d.js';

// Modüller saf JS olduğu için indeksler TypeScript'e `{}` görünür. Anahtarla
// erişebilmek için tek bir yerde daraltıyoruz (her satıra cast dağıtmak yerine).
const PARCALAR = PARCA_INDEKS as Record<string, any>;
const TIPLER = HATA_TIPI_INDEKS as Record<string, any>;

describe('katalog bütünlüğü', () => {
  it('parça kimlikleri benzersizdir', () => {
    const hepsi = BOLGELER.flatMap((b: any) => b.parcalar.map((p: any) => p.id));
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });

  it('hata tipi kimlikleri benzersizdir', () => {
    const ids = HATA_TIPLERI.map((h: any) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her hata tipi tanımlı bir gruba ve şiddete bağlıdır', () => {
    const siddetler = new Set(SIDDETLER.map((s: any) => s.id));
    for (const h of HATA_TIPLERI) {
      expect(HATA_GRUPLARI, `${h.id} grubu yok: ${h.grup}`).toHaveProperty(h.grup);
      expect(siddetler.has(h.siddet), `${h.id} şiddeti tanımsız: ${h.siddet}`).toBe(true);
    }
  });

  it('her parça, var olan hata gruplarını gösterir ve en az bir hata tipi sunar', () => {
    for (const b of BOLGELER) {
      for (const p of b.parcalar) {
        for (const g of p.gruplar) {
          expect(HATA_GRUPLARI, `${p.id} tanımsız grup istiyor: ${g}`).toHaveProperty(g);
        }
        expect(parcaHataTipleri(p.id).length, `${p.id} için seçilebilir hata yok`).toBeGreaterThan(0);
      }
    }
  });

  it('sol/sağ ön ekli parça adlarında tek harfli kısaltma küçültülmez', () => {
    // "Sol a direği garnişi" yanlış; "Sol A direği garnişi" doğru.
    expect(PARCALAR['sol_a_garnis'].ad).toBe('Sol A direği garnişi');
    expect(PARCALAR['sag_b_garnis'].ad).toBe('Sağ B direği garnişi');
    expect(PARCALAR['sol_on_kapi_doseme'].ad).toBe('Sol ön kapı döşemesi');
  });

  it('kullanıcının verdiği iki örnek katalogda karşılanır', () => {
    // "Rear door squeak noise"
    expect(PARCALAR['sol_arka_kapi'].en).toBe('Rear door');
    expect(TIPLER['gicirti'].en).toBe('Squeak');
    // "A pillar garnish dent"
    expect(PARCALAR['sol_a_garnis'].en).toBe('LH A pillar garnish');
    expect(TIPLER['gocuk'].en).toBe('Dent');
    // ve bu ikisi gerçekten seçilebilir olmalı
    expect(parcaHataTipleri('sol_arka_kapi').some((h: any) => h.id === 'gicirti')).toBe(true);
    expect(parcaHataTipleri('sol_a_garnis').some((h: any) => h.id === 'gocuk')).toBe(true);
  });

  it('hızlı seçim kalıplarının tamamı geçerli parça+hata ikilisidir', () => {
    for (const [parcaId, hataId] of HIZLI_KALIPLAR) {
      expect(PARCA_INDEKS, `kalıpta bilinmeyen parça: ${parcaId}`).toHaveProperty(parcaId);
      expect(HATA_TIPI_INDEKS, `kalıpta bilinmeyen hata: ${hataId}`).toHaveProperty(hataId);
      const uygun = parcaHataTipleri(parcaId).some((h: any) => h.id === hataId);
      expect(uygun, `${parcaId} için ${hataId} seçilemez`).toBe(true);
    }
  });

  it('elektrikli araçta yakıt parçaları, benzinlide HV parçaları listelenmez', () => {
    const ev = bolgelerAracIcin({ tip: 'ev' }).flatMap((b: any) => b.parcalar.map((p: any) => p.id));
    const ice = bolgelerAracIcin({ tip: 'ice' }).flatMap((b: any) => b.parcalar.map((p: any) => p.id));
    expect(ev).toContain('sarj_soketi');
    expect(ev).not.toContain('yakit_deposu');
    expect(ice).toContain('yakit_deposu');
    expect(ice).not.toContain('sarj_soketi');
  });
});

describe('3B model ile katalog eşleşmesi', () => {
  const meshHaritasi: Record<string, string> = {};
  for (const b of BOLGELER) for (const p of b.parcalar) if (p.mesh) meshHaritasi[p.mesh] = p.id;

  it('modelde çizilen her yüzeyin katalogda bir parçası vardır', () => {
    // Bu kırılırsa 3B modele dokunmak "bilinmeyen parça" verir ve hata
    // kaydedilemez — uygulamanın en kritik bağıdır.
    for (const arac of ARACLAR) {
      for (const mod of ['dis', 'ic']) {
        const meshler: string[] = [...new Set(geometriUret(arac.id, mod).map((f: any) => f.mesh))] as string[];
        const eksik = meshler.filter((m) => !meshHaritasi[m]);
        expect(eksik, `${arac.id}/${mod} karşılıksız mesh`).toEqual([]);
      }
    }
  });

  it('katalogda mesh i olan her parça en az bir araçta çizilir', () => {
    const cizilen = new Set<string>();
    for (const arac of ARACLAR) {
      for (const mod of ['dis', 'ic']) {
        for (const f of geometriUret(arac.id, mod)) cizilen.add(f.mesh);
      }
    }
    const cizilmeyen = Object.keys(meshHaritasi).filter((m) => !cizilen.has(m));
    expect(cizilmeyen, 'mesh tanımlı ama hiç çizilmiyor').toEqual([]);
  });

  it('dış kabuk dilimleri doğru parçayı adlandırır', () => {
    // Noktanın parca alanı, O NOKTADA BİTEN dilimi adlandırır. Yanlış tarafa
    // kayarsa ön cam "kaput" olur ve arka tampon hiç etiketlenmez.
    const dis = geometriUret('i20', 'dis');
    const adlar = new Set(dis.map((f: any) => f.mesh));
    for (const beklenen of ['on_tampon', 'on_izgara', 'kaput', 'on_cam', 'tavan', 'arka_cam', 'bagaj_kapagi', 'arka_tampon']) {
      expect(adlar.has(beklenen), `dış kabukta eksik: ${beklenen}`).toBe(true);
    }
  });

  it('geometride geçersiz koordinat üretilmez', () => {
    for (const arac of ARACLAR) {
      for (const mod of ['dis', 'ic']) {
        for (const f of geometriUret(arac.id, mod)) {
          for (const nokta of f.p) {
            expect(nokta.every((v: number) => Number.isFinite(v)), `${arac.id}/${mod}/${f.mesh}`).toBe(true);
          }
          expect(f.p.length, `${f.mesh} çokgen değil`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('her araç hem sol hem sağ yüzeyleri üretir', () => {
    for (const arac of ARACLAR) {
      const meshler: string[] = geometriUret(arac.id, 'dis').map((f: any) => f.mesh);
      expect(meshler).toContain('sol_arka_kapi');
      expect(meshler).toContain('sag_arka_kapi');
      expect(meshler).toContain('sol_jant_on');
      expect(meshler).toContain('sag_jant_arka');
    }
  });
});
