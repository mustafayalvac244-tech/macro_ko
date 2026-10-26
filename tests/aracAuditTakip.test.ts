import { describe, expect, it } from 'vitest';

import { gunlukOzeti } from '../arac-audit-app/src/cekirdek/gunluk';
import { ilerlemeKodu } from '../arac-audit-app/src/cekirdek/nas';
import { acikMi, durumDegistir, TAKIP_DURUMLARI, takipAdi } from '../arac-audit-app/src/cekirdek/takip';

// 26.10.2026 — hata takibi (ekibin Excel'indeki PROGRESS / COUNTERMEASURE / CM APPLICATION DATE).
describe('hata takibi', () => {
  const T = '2026-10-27T08:00:00.000Z';

  it('dört durum, iki dilde ad; bilinmeyen durum "Açık"', () => {
    expect(TAKIP_DURUMLARI.map((d) => d.id)).toEqual(['acik', 'atandi', 'giderildi', 'kapali']);
    expect(takipAdi('giderildi')).toBe('Önlem uygulandı');
    expect(takipAdi('kapali', 'en')).toBe('Verified');
    expect(takipAdi(undefined)).toBe('Açık');
  });

  it('önlem uygulanınca tarih yazılır, var olan tarih korunur, geri alınınca silinir', () => {
    const a = durumDegistir({ durum: 'acik', giderilmeZamani: null, dogrulamaZamani: null }, 'giderildi', T);
    expect(a).toEqual({ durum: 'giderildi', giderilmeZamani: T, dogrulamaZamani: null });
    const b = durumDegistir({ ...a }, 'kapali', '2026-10-28T08:00:00.000Z');
    expect(b.giderilmeZamani).toBe(T);
    expect(b.dogrulamaZamani).toBe('2026-10-28T08:00:00.000Z');
    expect(durumDegistir(b, 'atandi', T)).toEqual({ durum: 'atandi', giderilmeZamani: null, dogrulamaZamani: null });
  });

  it('açık sayılan: açık ve paylaşıldı; önlemli ve doğrulanmış kapalı', () => {
    expect(['acik', 'atandi', 'giderildi', 'kapali'].map((d) => acikMi({ durum: d as never }))).toEqual([true, true, false, false]);
  });

  it('Excel PROGRESS: yalnız "SHARED" ya da boş', () => {
    expect(ilerlemeKodu({ durum: 'acik' })).toBe('');
    for (const d of ['atandi', 'giderildi', 'kapali'] as const) expect(ilerlemeKodu({ durum: d })).toBe('SHARED');
  });

  it('günlükte durum ve önlem okunur cümle', () => {
    const k = {
      id: 1, zaman: T, denetimId: 'd1', kayitId: 'h1', tur: 'hata_duzeltildi' as const, denetci: 'Denetçi A',
      eski: { parca_id: 'kaput', hata_tipi_id: 'cizik', durum: 'acik', onlem: '' },
      yeni: { parca_id: 'kaput', hata_tipi_id: 'cizik', durum: 'giderildi', onlem: 'Klips değişti' },
    };
    const metin = gunlukOzeti(k as never, 'tr');
    expect(metin).toContain('Açık → Önlem uygulandı');
    expect(metin).toContain('önlem');
  });
});
