import { describe, expect, it } from 'vitest';

import { HATA_GRUPLARI, HATA_TIPLERI, HATA_TIPI_INDEKS, parcaHataTipleri } from '../arac-audit-app/src/cekirdek/katalog';

// 26.10.2026 — hata kataloğu ekibin Excel'ine ("NAS") uyarlandı. Excel'deki en
// sık problem tiplerinden 8'inin uygulamada karşılığı yoktu; boşluk ve kademe
// yön taşımıyordu. Bu test uyarlamanın kalıcı olduğunu ve eski kimliklerin
// (eski kayıtlar onlarla okunur) silinmediğini sınar. (Bu dosya UYGULAMANIN
// kataloğunu sınar; aracAuditKatalog.test.ts eski web sürümününkini.)
const T = HATA_TIPI_INDEKS as Record<string, { id: string; grup: string; en: string; ad: string }>;

describe('ekibin Excel diline uyarlanmış hata kataloğu', () => {
  it('kimlikler tekil, her tipin grubu tanımlı', () => {
    const idler = HATA_TIPLERI.map((h) => h.id);
    expect(new Set(idler).size).toBe(idler.length);
    for (const h of HATA_TIPLERI) expect(HATA_GRUPLARI, `${h.id} grubu yok`).toHaveProperty(h.grup);
  });

  it('Excel\'de karşılığı olmayan 8 sık tip eklendi, ekibin İngilizce adıyla', () => {
    const beklenen: Record<string, string> = {
      temas: 'Touching', cakisma: 'Interference', dalga: 'Wave', cokuntu: 'Sink mark',
      sarkma: 'Sagging', kaynak_izi: 'Welding mark', kalip_izi: 'Mould mark', yapisma_zayif: 'Poor sticky',
    };
    for (const [id, en] of Object.entries(beklenen)) expect(T[id]?.en, id).toBe(en);
  });

  it('boşluk ve kademe yönleriyle ayrıldı; genel olanlar eski kayıtlar için duruyor', () => {
    expect(T['bosluk_fazla'].en).toBe('Over gap');
    expect(T['bosluk_dar'].en).toBe('Narrow gap');
    expect(T['bosluk_duzensiz'].en).toBe('Uneven gap');
    expect(T['kademe_disari'].en).toBe('Over flush');
    expect(T['kademe_iceri'].en).toBe('Under flush');
    expect(T['bosluk'].en).toBe('Gap');
    expect(T['kademe'].en).toBe('Flush');
  });

  it('birebir karşılıkların İngilizce adı ekibin terimi', () => {
    expect(T['gocuk'].en).toBe('Dent mark');
    expect(T['gicirti'].en).toBe('Squeak noise');
    expect(T['tikirti'].en).toBe('Rattle noise');
    expect(T['hizasiz'].en).toBe('Mismatching');
    expect(T['mastik'].en).toBe('Poor sealer');
  });

  it('yeni tipler gerçek bir parçada seçilebilir', () => {
    const kapi = parcaHataTipleri('sol_on_kapi').map((h) => h.id);
    for (const id of ['bosluk_fazla', 'bosluk_dar', 'kademe_disari', 'temas', 'dalga']) expect(kapi, id).toContain(id);
    // Sıra: yönlü boşluklar genel boşluktan ÖNCE (en sık kullanılanlar üstte).
    expect(kapi.indexOf('bosluk_fazla')).toBeLessThan(kapi.indexOf('bosluk'));
  });
});
