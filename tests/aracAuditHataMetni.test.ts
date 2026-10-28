import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ekipExceliniDoldur } from '../arac-audit-app/src/cekirdek/ekipExceli';
import { yedekIceriginiCoz } from '../arac-audit-app/src/cekirdek/geriYukleme';
import { hataMetni, KullaniciHatasi } from '../arac-audit-app/src/cekirdek/hataMetni';
import { kapsamDurumu } from '../arac-audit-app/src/cekirdek/sistemler';
import { zipOlustur } from '../arac-audit-app/src/cekirdek/zip';

// 28.10.2026 — değerlendirmede (erişilebilirlik ajanı) "Dosya doldurulamadı:
// DEFLATE: geçersiz Huffman kodu" gibi iletilerin ekrana düştüğü, İngilizce
// arayüzde de Türkçe çıktığı bulundu. Beklentileri ben yazdım.

const KOK = join(__dirname, '../arac-audit-app/src');
const TURKCE_HARF = /[çğıöşüÇĞİÖŞÜ]/;

/** Kaynaktaki `throw new Error('…')` iletileri; ${…} yerine örnek değer. */
function atilanIletiler(dosya: string): string[] {
  const kaynak = readFileSync(join(KOK, dosya), 'utf8');
  return [...kaynak.matchAll(/throw new Error\((['`])(.*?)\1\)/g)].map((m) => m[2]!.replace(/\$\{[^}]*\}/g, 'x'));
}

const hataYakala = (f: () => unknown): unknown => {
  try { f(); } catch (h) { return h; }
  throw new Error('hata beklenirdi');
};

describe('hata metni', () => {
  it('teknik dosyaların (inflate, zip, xlsxOku) her iletisi çevrilir — ham ileti ekrana düşmez', () => {
    const iletiler = ['cekirdek/inflate.ts', 'cekirdek/zip.ts', 'cekirdek/xlsxOku.ts'].flatMap(atilanIletiler);
    // Aletin kendisi: ayıklama bir şey bulmalı (bulamazsa aşağıdaki döngü boşuna geçerdi).
    expect(iletiler.length).toBeGreaterThanOrEqual(20);
    for (const ileti of iletiler) {
      const tr = hataMetni(new Error(ileti), 'tr');
      const en = hataMetni(new Error(ileti), 'en');
      expect(tr, ileti).not.toBe(ileti);
      expect(en, ileti).not.toMatch(TURKCE_HARF);
    }
  });

  it('kullanıcıya yazılmış hata arayüzün dilinde; message Türkçe kalır', () => {
    const h = new KullaniciHatasi('Bu dosya Araç Audit yedeği değil.', 'This file is not an Araç Audit backup.');
    expect(hataMetni(h, 'tr')).toBe('Bu dosya Araç Audit yedeği değil.');
    expect(hataMetni(h, 'en')).toBe('This file is not an Araç Audit backup.');
    expect(h.message).toBe('Bu dosya Araç Audit yedeği değil.');
    expect(h).toBeInstanceOf(Error);
  });

  it('kullanıcıya dönük dosyalarda düz Error kalmadı (yeni ileti iki dilli yazılmalı)', () => {
    for (const dosya of ['cekirdek/ekipExceli.ts', 'cekirdek/geriYukleme.ts', 'veri/yedek.ts']) {
      expect(readFileSync(join(KOK, dosya), 'utf8'), dosya).not.toMatch(/throw new Error\(/);
    }
  });

  it('gerçek akış: Excel olmayan dosya, Excel olmayan zip, bozuk Excel, yanlış yedek', () => {
    const rastgele = hataYakala(() => ekipExceliniDoldur(new Uint8Array([1, 2, 3, 4, 5]), []));
    expect(hataMetni(rastgele, 'en')).toBe('The selected file is not an Excel or backup file.');

    const baskaZip = hataYakala(() => ekipExceliniDoldur(zipOlustur([{ ad: 'not.txt', veri: 'merhaba' }]), []));
    expect(hataMetni(baskaZip, 'tr')).toBe('Bu bir Excel (xlsx/xlsm) dosyası değil.');
    expect(hataMetni(baskaZip, 'en')).toBe('This is not an Excel (xlsx/xlsm) file.');

    // Sağlam bir zip'in ortasından bayt bozulunca CRC tutmaz → "bozuk ya da yarım".
    const zip = zipOlustur([{ ad: 'xl/workbook.xml', veri: '<workbook>' + 'a'.repeat(200) + '</workbook>' }]);
    const bozuk = zip.slice();
    bozuk[60] ^= 0xFF;
    const bozukHata = hataYakala(() => ekipExceliniDoldur(bozuk, []));
    expect(hataMetni(bozukHata, 'tr')).toMatch(/^Dosya bozuk ya da yarım inmiş/);
    expect(hataMetni(bozukHata, 'en')).not.toMatch(TURKCE_HARF);

    const yanlisYedek = hataYakala(() => yedekIceriginiCoz({ uygulama: 'baska' }));
    expect(hataMetni(yanlisYedek, 'en')).toBe('This file is not an Araç Audit backup.');

    expect(hataMetni(hataYakala(() => JSON.parse('{bozuk')), 'tr')).toBe('Dosyanın içeriği okunamadı (bozuk ya da yarım).');
  });

  it('tanınmayan hata iletisiyle çıkar (sebep gizlenmez)', () => {
    expect(hataMetni(new Error('database is locked'), 'tr')).toBe('database is locked');
    expect(hataMetni('düz metin', 'en')).toBe('düz metin');
  });
});

describe('kapsam durumu (Kısmi rozeti)', () => {
  it('yalnız liste kullanılıp yarım kaldıysa kısmi; hiç işaret yoksa bilinmiyor', () => {
    expect(kapsamDurumu(0, 5)).toBe('isaretsiz');
    expect(kapsamDurumu(1, 5)).toBe('kismi');
    expect(kapsamDurumu(4, 5)).toBe('kismi');
    expect(kapsamDurumu(5, 5)).toBe('tam');
    expect(kapsamDurumu(6, 5)).toBe('tam');
  });
});
