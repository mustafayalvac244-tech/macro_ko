// İşçilik dilekçesi denetimi (bkz. _shared/iscilikDenetim.ts).
// Fikstür: 01.10.2026'da Sonnet 5'in GERÇEK deneme çıktısı (isimler köşeli
// parantezli yer tutucu; kişisel veri yok). Üç hata elle doğrulandı.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ISCILIK_UYARI, iscilikUyarilari } from '../supabase/functions/_shared/iscilikDenetim';

const gercek = readFileSync(join(__dirname, 'fixtures/iscilik-dilekce-sonnet-2026-10-01.txt'), 'utf8');

describe('iscilikUyarilari — gerçek Sonnet dilekçesi', () => {
  const u = iscilikUyarilari(gercek);
  it('ücrete yasal faizi yakalar', () => expect(u).toContain(ISCILIK_UYARI.ucretFaiz));
  it('alacak davasındaki 2 haftayı yakalar', () => expect(u).toContain(ISCILIK_UYARI.ikiHafta));
  it('zamanaşımının anılmadığını yakalar', () => expect(u).toContain(ISCILIK_UYARI.zamanasimi));
  it('doğru yazılan kıdem faizini (en yüksek) İŞARETLEMEZ', () => expect(u).not.toContain(ISCILIK_UYARI.kidemFaiz));
});

describe('iscilikUyarilari — yanlış pozitif olmasın', () => {
  it('doğru dilekçe temiz geçer', () => {
    const dogru = [
      'Ödenmeyen Haziran ve Temmuz 2026 ücret alacağının en yüksek mevduat faizi ile tahsiline,',
      'Kıdem tazminatının fesih tarihinden itibaren en yüksek banka mevduat faizi ile,',
      'Fazla çalışma ücretinin yasal faizi ile; zamanaşımı süresi içindeki dönem için,',
    ].join('\n');
    expect(iscilikUyarilari(dogru)).toEqual([]);
  });
  it('fazla çalışma ücretine yasal faiz uyarı DEĞİL (ayrı kalem)', () => {
    expect(iscilikUyarilari('Fazla çalışma ücreti alacağının yasal faizi ile tahsiline. Zamanaşımı kontrol edildi.')).toEqual([]);
  });
  it('işe iade dilekçesinde 2 hafta uyarı DEĞİL', () => {
    expect(iscilikUyarilari('İşe iade davası, son tutanaktan itibaren 2 hafta içinde açılmıştır.')).toEqual([]);
  });
  it('kıdeme yasal faiz uyarı verir', () => {
    expect(iscilikUyarilari('Kıdem tazminatının yasal faiziyle tahsiline.')).toContain(ISCILIK_UYARI.kidemFaiz);
  });
});

describe('kural metinleri (kod KB + 0164)', () => {
  const kod = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');
  const goc = readFileSync(join(__dirname, '..', 'supabase/migrations/0164_iscilik_kurallari.sql'), 'utf8');
  it('istisnasız "son tutanaktan itibaren 2 HAFTA içinde dava açılır" cümlesi KB\'de yok', () => {
    expect(kod).not.toContain("Anlaşamama hâlinde son tutanaktan itibaren 2 HAFTA içinde dava açılır.'");
  });
  it('arabuluculuk ve işe iade kuralları 2 haftanın YALNIZ işe iadeye ait olduğunu söylüyor', () => {
    expect((kod.match(/YALNIZ İŞE İADE/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((goc.match(/YALNIZ İŞE İADE/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('işçilik faiz kuralı ücret ve kıdeme EN YÜKSEK faizi söylüyor (kod + göç)', () => {
    for (const k of [kod, goc]) {
      expect(k).toContain('iscilik_faiz');
      expect(k).toMatch(/ÜCRET için mevduata uygulanan EN YÜKSEK faiz/);
    }
  });
  it('dilekçe uyarılarına işçilik denetimi ekleniyor', () => {
    expect(kod).toMatch(/\.\.\.iscilikUyarilari\(temiz\.metin\)/);
  });
});
