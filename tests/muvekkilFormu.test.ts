import { describe, expect, it } from 'vitest';
import {
  BOS_MUVEKKIL_FORMU,
  formuDoldur,
  kayitYuku,
  kaydetmeEngeli,
  type MuvekkilFormu,
} from '@/utils/muvekkilFormu';
import type { Client } from '@/types/database';

/**
 * MÜVEKKİL FORMU — yükleme/kaydetme yolu ve kaydı engelleyen durumlar.
 *
 * Kimlik numaraları SENTETİKTİR (tests/tckn.test.ts ile aynı örnekler):
 * algoritmayla üretilmiş, gerçek bir kişiye ait değildir.
 */
const mevcut: Client = {
  id: 'm1',
  owner_id: 'u1',
  full_name: 'Örnek Tekstil A.Ş.',
  title: null,
  client_type: 'tuzel',
  company: 'Örnek Tekstil A.Ş.',
  tc_no: null,
  email: 'bilgi@ornek.test',
  phone: '0555 000 00 03',
  address: 'Örnek Mah. 1',
  notes: 'not',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const form = (degisen: Partial<MuvekkilFormu>): MuvekkilFormu => ({
  ...BOS_MUVEKKIL_FORMU,
  fullName: 'Ayşe Kaya',
  ...degisen,
});

describe('düzenleme — kayıttan formu doldurup geri yazmak hiçbir alanı ezmez', () => {
  // 09.10.2026: formda şirket alanının ayarlayıcısı yoktu ve kayıttan
  // yüklenmiyordu; her düzenleme company'yi null'a eziyordu.
  it('şirket (company) korunur', () => {
    expect(kayitYuku(formuDoldur(mevcut)).company).toBe('Örnek Tekstil A.Ş.');
  });

  it('bütün alanlar gidip geldiği gibi döner', () => {
    const { id: _i, owner_id: _o, created_at: _c, updated_at: _u, ...alanlar } = mevcut;
    expect(kayitYuku(formuDoldur(mevcut))).toEqual(alanlar);
  });

  it('boş metin null yazılır, ad kırpılır', () => {
    expect(kayitYuku(form({ fullName: '  Ayşe Kaya ', email: '   ' }))).toMatchObject({
      full_name: 'Ayşe Kaya',
      email: null,
      company: null,
    });
  });
});

describe('kaydetmeEngeli — geçersiz T.C. kimlik numarası kaydedilmez', () => {
  it('ad yoksa kaydedilmez', () => {
    expect(kaydetmeEngeli(form({ fullName: '  ' }))).toBe('adYok');
  });

  it('kontrol hanesi tutmayan 11 haneli numara kaydı engeller', () => {
    expect(kaydetmeEngeli(form({ tcNo: '12345678951' }))).toBe('tcGecersiz');
    expect(kaydetmeEngeli(form({ tcNo: '12345678960' }))).toBe('tcGecersiz');
  });

  it('11 haneden kısa numara kaydı engeller (veritabanı biçim kısıtı zaten reddediyor)', () => {
    expect(kaydetmeEngeli(form({ tcNo: '12345' }))).toBe('tcEksik');
  });

  it('geçerli ya da boş numara engel değildir', () => {
    expect(kaydetmeEngeli(form({ tcNo: '12345678950' }))).toBeNull();
    expect(kaydetmeEngeli(form({ tcNo: '' }))).toBeNull();
  });

  it('tüzel kişide alan gizli olduğundan T.C. denetlenmez', () => {
    expect(kaydetmeEngeli(form({ clientType: 'tuzel', tcNo: '12345678951' }))).toBeNull();
  });
});
