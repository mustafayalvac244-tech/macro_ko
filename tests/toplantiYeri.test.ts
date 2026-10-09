import { describe, expect, it } from 'vitest';
import { arabuluculukCoz, toplantiYeriCoz } from '../src/utils/toplantiYeri';

const yerTr = { ofis: 'Ofis', online: 'Online', muvekkil_adresi: 'Müvekkil Adresinde', diger: 'Diğer' } as const;
const kimTr = { taraf: 'Taraf ile', arabulucu: 'Arabulucu ile' } as const;

// Düzenlemede yer seçenekleri kayıttan geri çözülmüyor, kaydedince "Ofis" oluyordu.
describe('toplantı yeri geri çözülür', () => {
  it.each([
    ['Online', 'online', ''],
    ['Ofis', 'ofis', ''],
    ['Müvekkil Adresinde — Kadıköy Moda Cad. 5', 'muvekkil_adresi', 'Kadıköy Moda Cad. 5'],
    ['Diğer — Adliye kafeteryası', 'diger', 'Adliye kafeteryası'],
    ['Client address — Kadıköy', 'diger', 'Client address — Kadıköy'],
    ['', 'ofis', ''],
  ])('%s', (kayit, yer, ek) => {
    expect(toplantiYeriCoz(kayit, (y) => yerTr[y])).toEqual({ yer, ek });
  });

  it('arabuluculuk', () => {
    expect(arabuluculukCoz('Arabulucu ile · Online', (k) => kimTr[k], (y) => yerTr[y])).toEqual({ kim: 'arabulucu', yer: 'online' });
    expect(arabuluculukCoz('başka', (k) => kimTr[k], (y) => yerTr[y])).toBeNull();
  });
});
