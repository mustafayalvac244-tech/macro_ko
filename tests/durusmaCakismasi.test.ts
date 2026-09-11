import { describe, expect, it } from 'vitest';
import {
  ayniKonum,
  cakisanKimlikler,
  cakismaBul,
  enAgirTur,
  konumAnahtari,
  DURUSMA_SURESI_DK,
  YOL_PAYI_DK,
  type CakismaKaydi,
} from '@/utils/durusmaCakismasi';

/**
 * DURUŞMA ÇAKIŞMASI.
 *
 * BULUNAN EKSİK: uygulama aynı güne aynı saate iki duruşma kaydetmeye izin
 * veriyor ve tek kelime uyarmıyordu. Gidilmeyen celsede yokluğunda karar
 * verilebilir, dosya işlemden kaldırılabilir (HMK m.150). Yani hak kaybı.
 *
 * EŞİKLER ÖLÇÜM DEĞİL: 45 dk "duruşma süresi" ve 90 dk "yol payı" gerçek
 * verilerden ölçülmedi, seçilmiş varsayılanlardır. Testler de bu yüzden
 * sabit dakika yazmak yerine sabitlerin KENDİSİNE göre kurulu — eşik
 * değişirse testler anlamını korur.
 */

function kayit(id: string, saat: string, konum: string | null = 'Çağlayan Adliyesi', bitti = false): CakismaKaydi {
  return { id, scheduled_at: `2026-09-15T${saat}:00+03:00`, title: `Duruşma ${id}`, location: konum, is_completed: bitti };
}

describe('konumAnahtari', () => {
  it('Türkçe harfleri sadeleştirir, noktalama ve fazla boşluğu atar', () => {
    expect(konumAnahtari('Çağlayan  Adliyesi,')).toBe('caglayan adliyesi');
  });

  it('"İ" büyük/küçük farkı eşleşmeyi bozmaz (toLowerCase tuzağı)', () => {
    // JS'te 'İ'.toLowerCase() iki kod birimine açılır; naif karşılaştırma
    // "İSTANBUL ADLİYESİ" ile "İstanbul Adliyesi"yi farklı sayardı.
    expect(konumAnahtari('İSTANBUL ADLİYESİ')).toBe(konumAnahtari('İstanbul Adliyesi'));
  });
});

describe('ayniKonum', () => {
  it('yazım farkına rağmen aynı adliyeyi eşleştirir', () => {
    expect(ayniKonum('Çağlayan Adliyesi', 'çağlayan adliyesi')).toBe(true);
  });

  it('biri boşsa KARAR VERMEZ — false döner', () => {
    // Boş konumu "aynı yer" saymak, farklı adliyedeki çakışmayı gizlerdi.
    expect(ayniKonum(null, 'Çağlayan Adliyesi')).toBe(false);
    expect(ayniKonum('', '')).toBe(false);
  });
});

describe('cakismaBul', () => {
  it('aynı saatteki duruşmayı "ortusuyor" olarak bulur', () => {
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'Çağlayan Adliyesi' }, [kayit('b', '10:00')]);
    expect(c).toHaveLength(1);
    expect(c[0].tur).toBe('ortusuyor');
    expect(c[0].farkDk).toBe(0);
  });

  it('duruşma süresinden kısa aralık örtüşme sayılır', () => {
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'X' }, [kayit('b', '10:30', 'X')]);
    expect(DURUSMA_SURESI_DK).toBeGreaterThan(30);
    expect(c[0].tur).toBe('ortusuyor');
  });

  it('FARKLI adliyede yol payı yetmiyorsa uyarır', () => {
    // 10:00 Çağlayan, 11:00 Anadolu → 60 dk, yol payının altında.
    const c = cakismaBul(
      { scheduled_at: kayit('a', '10:00').scheduled_at, location: 'Çağlayan Adliyesi' },
      [kayit('b', '11:00', 'Anadolu Adliyesi')]
    );
    expect(YOL_PAYI_DK).toBeGreaterThan(60);
    expect(c[0].tur).toBe('yol_yetmez');
    expect(c[0].konumFarkli).toBe(true);
  });

  it('AYNI adliyede arka arkaya ise yalnız "sikisik" der, çakışma demez', () => {
    const c = cakismaBul(
      { scheduled_at: kayit('a', '10:00').scheduled_at, location: 'Çağlayan Adliyesi' },
      [kayit('b', '11:00', 'Çağlayan Adliyesi')]
    );
    expect(c[0].tur).toBe('sikisik');
    expect(c[0].konumFarkli).toBe(false);
  });

  it('yol payından uzaksa hiç uyarmaz', () => {
    const c = cakismaBul(
      { scheduled_at: kayit('a', '09:00').scheduled_at, location: 'Çağlayan Adliyesi' },
      [kayit('b', '15:00', 'Anadolu Adliyesi')]
    );
    expect(c).toEqual([]);
  });

  it('TAMAMLANMIŞ duruşma çakışma saymaz — geçmiş celse randevu engellemez', () => {
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'X' }, [kayit('b', '10:00', 'X', true)]);
    expect(c).toEqual([]);
  });

  it('düzenlenen kaydın KENDİSİ çakışma sayılmaz', () => {
    const mevcut = kayit('ayni-id', '10:00');
    const c = cakismaBul({ id: 'ayni-id', scheduled_at: mevcut.scheduled_at, location: mevcut.location }, [mevcut]);
    expect(c).toEqual([]);
  });

  it('başka gündeki duruşmaya hiç bakmaz', () => {
    const c = cakismaBul(
      { scheduled_at: '2026-09-15T10:00:00+03:00', location: 'X' },
      [{ id: 'b', scheduled_at: '2026-09-18T10:00:00+03:00', title: 'b', location: 'X', is_completed: false }]
    );
    expect(c).toEqual([]);
  });

  it('geçersiz tarihte çökmez', () => {
    expect(cakismaBul({ scheduled_at: 'olmayan-tarih' }, [kayit('b', '10:00')])).toEqual([]);
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'X' }, [
      { id: 'b', scheduled_at: 'bozuk', title: 'b', location: 'X', is_completed: false },
    ]);
    expect(c).toEqual([]);
  });

  it('en yakın çakışma önce sıralanır', () => {
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'Çağlayan Adliyesi' }, [
      kayit('uzak', '11:15', 'Anadolu Adliyesi'),
      kayit('yakin', '10:10', 'Anadolu Adliyesi'),
    ]);
    expect(c.map((x) => x.digeri.id)).toEqual(['yakin', 'uzak']);
  });
});

describe('enAgirTur', () => {
  it('örtüşme en ağırdır', () => {
    const c = cakismaBul({ scheduled_at: kayit('a', '10:00').scheduled_at, location: 'Çağlayan Adliyesi' }, [
      kayit('b', '10:05', 'Çağlayan Adliyesi'),
      kayit('c', '11:10', 'Anadolu Adliyesi'),
    ]);
    expect(enAgirTur(c)).toBe('ortusuyor');
  });

  it('boş listede null', () => {
    expect(enAgirTur([])).toBeNull();
  });
});

describe('cakisanKimlikler', () => {
  it('çakışan İKİ kaydı da işaretler (rozet iki tarafta da çıksın)', () => {
    const hepsi = [kayit('a', '10:00'), kayit('b', '10:20'), kayit('c', '16:00')];
    const isaretli = cakisanKimlikler(hepsi);
    expect(isaretli.has('a')).toBe(true);
    expect(isaretli.has('b')).toBe(true);
    expect(isaretli.has('c')).toBe(false);
  });
});
