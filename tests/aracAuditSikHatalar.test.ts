import { describe, expect, it } from 'vitest';

import { GecmisKayit, parcaninSikTipleri, sikHataOnerileri } from '../arac-audit-app/src/cekirdek/sikHatalar';

// 27.10.2026 — "daha hızlı hata ekleyebilir". Şerit yalnız bu telefonun
// geçmişinden; en az iki kez görülmeyen ikili "sık" değil. Beklentileri ben yazdım.

const k = (parcaId: string, hataTipiId: string, zaman: string, ikinciParcaId?: string): GecmisKayit =>
  ({ parcaId, hataTipiId, zaman, ...(ikinciParcaId ? { ikinciParcaId } : {}) });

const gecmis: GecmisKayit[] = [
  k('kaput', 'cizik', '2026-10-01T09:00:00Z'),
  k('kaput', 'cizik', '2026-10-02T09:00:00Z'),
  k('kaput', 'cizik', '2026-10-03T09:00:00Z'),
  k('on_tampon', 'bosluk_fazla', '2026-10-01T09:00:00Z', 'sol_on_camurluk'),
  // İki parça arası sırasız sayılır: çamurluk↔tampon = tampon↔çamurluk.
  k('sol_on_camurluk', 'bosluk_fazla', '2026-10-04T09:00:00Z', 'on_tampon'),
  k('bagaj_kapagi', 'tikirti', '2026-10-05T09:00:00Z'),
  k('bagaj_kapagi', 'tikirti', '2026-10-06T09:00:00Z'),
  k('anten', 'gevsek', '2026-10-07T09:00:00Z'),
  k('kaput', 'gocuk', '2026-10-01T09:00:00Z'),
  k('kaput', 'gocuk', '2026-10-01T10:00:00Z'),
];

describe('sık hatalar', () => {
  it('en sık önce; eşitlikte en yeni önce; tek görülen sık değil', () => {
    const o = sikHataOnerileri(gecmis);
    expect(o.map((x) => [x.parcaId, x.ikinciParcaId ?? '', x.hataTipiId, x.sayi])).toEqual([
      ['kaput', '', 'cizik', 3],
      ['bagaj_kapagi', '', 'tikirti', 2],
      ['on_tampon', 'sol_on_camurluk', 'bosluk_fazla', 2],
      ['kaput', '', 'gocuk', 2],
    ]);
  });

  it('geçersiz (bu araçta olmayan parça, kaldırılmış tip) süzülür; sayı sınırı', () => {
    expect(sikHataOnerileri(gecmis, { gecerli: (x) => x.parcaId !== 'kaput' }).map((x) => x.parcaId)).toEqual(['bagaj_kapagi', 'on_tampon']);
    expect(sikHataOnerileri(gecmis, { enFazla: 1 })).toHaveLength(1);
    expect(sikHataOnerileri([])).toEqual([]);
  });

  it('parçanın sık tipleri — iki parça arası kendi anahtarıyla', () => {
    expect(parcaninSikTipleri(gecmis, 'kaput', null).map((x) => [x.hataTipiId, x.sayi])).toEqual([['cizik', 3], ['gocuk', 2]]);
    expect(parcaninSikTipleri(gecmis, 'sol_on_camurluk', 'on_tampon').map((x) => x.hataTipiId)).toEqual(['bosluk_fazla']);
    expect(parcaninSikTipleri(gecmis, 'on_tampon', null)).toEqual([]);
  });
});
