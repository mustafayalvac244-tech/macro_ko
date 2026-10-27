import { describe, expect, it } from 'vitest';

import { eklemeKomutlari, GERI_YUKLEME_SIRASI, yedekIceriginiCoz } from '../arac-audit-app/src/cekirdek/geriYukleme';
import { gunlukOzeti, satirFarki } from '../arac-audit-app/src/cekirdek/gunluk';
import { crc32, zipOku, zipOlustur } from '../arac-audit-app/src/cekirdek/zip';

// 26.10.2026 — dış değerlendirme (saha denetçisi + kalite müdürü): "yedek var
// ama geri yükleme yok", "düzeltme ve silme iz bırakmıyor". Beklentileri ben
// yazdım; telefonda denenmedi (dosya seçici yalnız Android'de).

describe('zip okuyucu', () => {
  it('yazıcının ürettiği arşivi aynen geri okur (metin + ikili, Türkçe ad)', () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 0, 255]);
    const zip = zipOlustur([{ ad: 'veri.json', veri: '{"ş":"ğüçö"}' }, { ad: 'fotograflar/f_1.jpg', veri: jpeg }]);
    const g = zipOku(zip);
    expect(g.map((x) => x.ad)).toEqual(['veri.json', 'fotograflar/f_1.jpg']);
    expect(new TextDecoder().decode(g[0]!.veri)).toBe('{"ş":"ğüçö"}');
    expect([...g[1]!.veri]).toEqual([...jpeg]);
  });

  it('bozuk veri CRC ile yakalanır; tanınmayan sıkıştırma okunmaz; ZIP olmayan dosya reddedilir', () => {
    const zip = zipOlustur([{ ad: 'a.txt', veri: 'merhaba' }]);
    const bozuk = zip.slice();
    bozuk[30 + 'a.txt'.length] ^= 0xFF; // veri baytı
    expect(() => zipOku(bozuk)).toThrow(/CRC/);
    // 27.10.2026'dan beri deflate (8) açılıyor (aracAuditEkipExceli.test.ts);
    // başka yöntem (12 = bzip2) hâlâ sessizce bozuk okunmaz, hata verir.
    const sikistirilmis = zip.slice();
    const merkez = sikistirilmis.length - 22 - (46 + 'a.txt'.length);
    sikistirilmis[merkez + 10] = 12;
    expect(() => zipOku(sikistirilmis)).toThrow(/desteklenmeyen yöntemle sıkıştırılmış/);
    expect(() => zipOku(new TextEncoder().encode('bu bir zip değil, uzunca bir metin dosyası'))).toThrow(/ZIP değil/);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
  });
});

describe('yedek içeriği', () => {
  it('Araç Audit yedeği kabul edilir; başka uygulama, ileri biçim ve tablosuz dosya açık hatayla reddedilir', () => {
    expect(yedekIceriginiCoz({ uygulama: 'arac-audit', bicim: 1, tarih: '2026-10-26T10:00:00Z', tablolar: { denetimler: [{ id: 'd1' }] } }))
      .toEqual({ tarih: '2026-10-26T10:00:00Z', tablolar: { denetimler: [{ id: 'd1' }] } });
    expect(() => yedekIceriginiCoz({ uygulama: 'vekil', bicim: 1, tablolar: {} })).toThrow('Araç Audit yedeği değil');
    expect(() => yedekIceriginiCoz({ uygulama: 'arac-audit', bicim: 2, tablolar: {} })).toThrow('tanınmıyor');
    expect(() => yedekIceriginiCoz({ uygulama: 'arac-audit', bicim: 1 })).toThrow('tablo yok');
    expect(() => yedekIceriginiCoz(null)).toThrow();
  });

  it('komutlar: sıra denetim → hata → foto; telefonda olmayan sütun atlanır; fotoğraf adresi yenilenir; INSERT OR IGNORE', () => {
    const icerik = yedekIceriginiCoz({
      uygulama: 'arac-audit', bicim: 1, tablolar: {
        fotograflar: [{ id: 'f1', denetim_id: 'd1', hata_id: 'h1', uri: 'file:///eski/cache/f1.jpg' }, { id: 'f2', denetim_id: 'd1', uri: 'x' }],
        hatalar: [{ id: 'h1', denetim_id: 'd1', parca_id: 'kaput', gelecek_surum_sutunu: 'yok say', kabul_edilebilir: false }],
        denetimler: [{ id: 'd1', arac_id: 'ioniq3' }],
        bilinmeyen_tablo: [{ id: 'z' }],
      },
    });
    const k = eklemeKomutlari(icerik, {
      denetimler: ['id', 'arac_id'], hatalar: ['id', 'denetim_id', 'parca_id', 'kabul_edilebilir'],
      fotograflar: ['id', 'denetim_id', 'hata_id', 'uri'],
    }, (id) => (id === 'f1' ? 'file:///belge/fotograflar/f1.jpg' : null));
    expect(k.map((x) => x.tablo)).toEqual(['denetimler', 'hatalar', 'fotograflar', 'fotograflar']);
    expect(k.filter((x) => x.tablo !== 'degisiklik_gunlugu').every((x) => x.sql.startsWith('INSERT OR IGNORE INTO '))).toBe(true);
    expect(k[1]!.sql).toBe('INSERT OR IGNORE INTO hatalar (id, denetim_id, parca_id, kabul_edilebilir) VALUES (?, ?, ?, ?)');
    expect(k[1]!.degerler).toEqual(['h1', 'd1', 'kaput', 0]);
    expect(k[2]!.degerler).toEqual(['f1', 'd1', 'h1', 'file:///belge/fotograflar/f1.jpg']);
    expect(k[3]!.degerler).toEqual(['f2', 'd1', '']); // dosyası yedekte yok: kayıt kalır, adres boş
    expect(GERI_YUKLEME_SIRASI.indexOf('denetimler')).toBeLessThan(GERI_YUKLEME_SIRASI.indexOf('hatalar'));
  });
});

describe('değişiklik günlüğü', () => {
  it('fark: yalnız değişen sütunlar; yok sayılanlar ve aynı kalanlar girmez; değişiklik yoksa null', () => {
    const eski = { id: 'h1', derece: '1', sinif: 'MINOR', guncelleme: 'a', aciklama: '' };
    const yeni = { id: 'h1', derece: '2', sinif: 'MINOR', guncelleme: 'b', aciklama: 'sağ köşe' };
    expect(satirFarki(eski, yeni, ['guncelleme'])).toEqual({ eski: { derece: '1', aciklama: '' }, yeni: { derece: '2', aciklama: 'sağ köşe' } });
    expect(satirFarki(eski, { ...eski, guncelleme: 'z' }, ['guncelleme'])).toBeNull();
  });

  it('ekrandaki cümle: düzeltme, silme, denetim silme; iki dilde, parça ve hata adlarıyla', () => {
    expect(gunlukOzeti({ tur: 'hata_duzeltildi', eski: { derece: '1', hata_tipi_id: 'cizik' }, yeni: { derece: '2', hata_tipi_id: 'gocuk' } }, 'tr'))
      .toBe('Düzeltildi: demerit 1 → 2, hata Çizik → Göçük');
    expect(gunlukOzeti({ tur: 'hata_silindi', eski: { parca_id: 'kaput', ikinci_parca_id: 'sol_on_camurluk', hata_tipi_id: 'bosluk_fazla', derece: '1' }, yeni: null }, 'tr'))
      .toBe('Silindi: Kaput ↔ Sol ön çamurluk — Boşluk fazla (demerit 1)');
    expect(gunlukOzeti({ tur: 'hata_silindi', eski: { parca_id: 'kaput', hata_tipi_id: 'cizik', derece: '3' }, yeni: null }, 'en'))
      .toBe('Deleted: Hood — Scratch (demerit 3)');
    expect(gunlukOzeti({ tur: 'denetim_silindi', eski: { denetim: {}, hatalar: [{}, {}] }, yeni: null }, 'tr')).toBe('Denetim silindi (2 kayıt)');
    expect(gunlukOzeti({ tur: 'denetim_duzeltildi', eski: { denetim_tipi: 'AUDIT' }, yeni: { denetim_tipi: 'LONG TERM' } }, 'tr'))
      .toBe('Denetim düzeltildi: kaynak AUDIT → LONG TERM');
    expect(gunlukOzeti({ tur: 'hata_duzeltildi', eski: { aciklama: '' }, yeni: { aciklama: 'x' } }, 'tr')).toBe('Düzeltildi: açıklama (boş) → x');
  });
});

// 26.10.2026 — 2. dış değerlendirme: başka telefonun yedeğindeki günlük satırları kimlik çakışmasıyla düşüyordu.
describe('geri yükleme: değişiklik günlüğü', () => {
  it('kimlik yazılmaz; aynı olay varsa eklenmez', () => {
    const icerik = yedekIceriginiCoz({
      uygulama: 'arac-audit', bicim: 1,
      tablolar: { degisiklik_gunlugu: [{ id: 1, zaman: '2026-10-26T09:00:00Z', denetim_id: 'd9', kayit_id: 'h9', tur: 'hata_silindi', denetci: 'B', eski: '{}', yeni: null }] },
    });
    const k = eklemeKomutlari(icerik, { degisiklik_gunlugu: ['id', 'zaman', 'denetim_id', 'kayit_id', 'tur', 'denetci', 'eski', 'yeni'] }, () => null);
    expect(k).toHaveLength(1);
    expect(k[0]!.sql).not.toContain('(id,');
    expect(k[0]!.sql).toContain('WHERE NOT EXISTS');
    expect(k[0]!.degerler.slice(-4)).toEqual(['2026-10-26T09:00:00Z', 'h9', 'hata_silindi', 'd9']);
  });
});
