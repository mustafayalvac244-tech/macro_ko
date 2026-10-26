import { describe, expect, it } from 'vitest';

import { aktarilacaklar, VARSAYILAN_AKTARIM } from '../arac-audit-app/src/cekirdek/aktarim';

// 26.10.2026 — ikinci dış değerlendirme (kalite müdürü): Excel'e aktarım yarım
// denetimleri de döküyordu, dönem seçilemiyordu. Beklentileri ben yazdım.

// Çarşamba 28.10.2026 12:00 yerel saat: bu hafta Pzt 26.10, geçen hafta 19–25.10.
const SIMDI = new Date(2026, 9, 28, 12, 0);
const d = (id: string, gun: number, ay: number, durum: string) => ({ id, baslangic: new Date(2026, ay - 1, gun, 9).toISOString(), durum });
const DENETIMLER = [
  d('bugun_tamam', 28, 10, 'tamam'),
  d('bugun_devam', 28, 10, 'devam'),
  d('pzt_tamam', 26, 10, 'tamam'),
  d('gecen_hafta', 21, 10, 'tamam'),
  d('eylul', 15, 9, 'tamam'),
  d('gecen_yil', 15, 12, 'tamam'),
].map((x, i) => (i === 5 ? { ...x, baslangic: new Date(2025, 11, 15, 9).toISOString() } : x));

const idler = (r: { secilen: { id: string }[] }) => r.secilen.map((x) => x.id);

describe('Excel aktarımı: hangi denetimler', () => {
  it('varsayılan: bütün zamanlar, yalnız bitmişler; dışarıda kalan devam sayılır', () => {
    const r = aktarilacaklar(DENETIMLER, VARSAYILAN_AKTARIM, SIMDI);
    expect(idler(r)).not.toContain('bugun_devam');
    expect(r.secilen).toHaveLength(5);
    expect(r.disaridaDevam).toBe(1);
  });

  it('devam edenler istenirse katılır', () => {
    const r = aktarilacaklar(DENETIMLER, { donem: 'hepsi', devamDahil: true }, SIMDI);
    expect(r.secilen).toHaveLength(6);
    expect(r.disaridaDevam).toBe(0);
  });

  it('dönem sınırları sayaçla aynı: bugün, bu hafta, geçen hafta, bu ay, bu yıl', () => {
    const k = (donem: Parameters<typeof aktarilacaklar>[1]['donem']) => idler(aktarilacaklar(DENETIMLER, { donem, devamDahil: false }, SIMDI));
    expect(k('bugun')).toEqual(['bugun_tamam']);
    expect(k('buHafta')).toEqual(['bugun_tamam', 'pzt_tamam']);
    expect(k('gecenHafta')).toEqual(['gecen_hafta']);
    expect(k('buAy')).toEqual(['bugun_tamam', 'pzt_tamam', 'gecen_hafta']);
    expect(k('buYil')).toEqual(['bugun_tamam', 'pzt_tamam', 'gecen_hafta', 'eylul']);
  });

  it('dönem dışındaki devam eden denetim "dışarıda kalan" sayılmaz', () => {
    const r = aktarilacaklar(DENETIMLER, { donem: 'gecenHafta', devamDahil: false }, SIMDI);
    expect(r.disaridaDevam).toBe(0);
  });
});
