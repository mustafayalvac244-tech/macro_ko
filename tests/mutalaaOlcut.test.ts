import { describe, expect, it } from 'vitest';
import { sadelestir } from '../scripts/eslestir.mjs';
import { adimlarBolumu, eksikBolumler, sureIceriyor } from '../scripts/mutalaa-olcut.mjs';

/**
 * Bu testlerin varlık sebebi somut: ölçütlerin ilk yazılışında üç bölüm
 * denetimi HER ZAMAN "eksik" diyordu, çünkü JavaScript'in /i bayrağı Türkçe
 * büyük İ'yi küçük i'ye eşlemiyor. Kusursuz bir mütalaa "üç bölümü eksik"
 * görünecekti ve buna bakıp modeli "düzeltmeye" kalkmak, doğru çalışan bir şeyi
 * bozmak olurdu.
 */
const TAM_MUTALAA = `
1. OLAY VE TESPİTLER
Müvekkil 14.04.2026 tarihinde işten çıkarılmıştır.

2. HUKUKİ SORUNLAR
Feshin geçerli sebebe dayanıp dayanmadığı.

3. İNCELEME
İşK m.19 uyarınca savunma alınmadan fesih yapılamaz.

4. RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI
İşveren performans dosyası sunabilir.

5. SONUÇ VE KANAAT
İşe iade davası açılabilir.

6. ATILACAK ADIMLAR
Fesih bildiriminden itibaren bir ay içinde arabulucuya başvurulmalıdır.
`;

describe('eksikBolumler', () => {
  it('altı bölümü de bulunan mütalaada eksik bildirmez', () => {
    expect(eksikBolumler(sadelestir(TAM_MUTALAA))).toEqual([]);
  });

  it('Türkçe büyük İ içeren başlıkları tanır', () => {
    // "RİSKLER" ve "TESPİTLER" — /i bayrağıyla eşleşmeyen tam da bu başlıklardı.
    expect(eksikBolumler(sadelestir('OLAY VE TESPİTLER ... RİSKLER ... HUKUKİ SORUNLAR')))
      .not.toContain('riskler');
  });

  it('düşen bölümü adıyla bildirir', () => {
    const eksikli = TAM_MUTALAA.replace(/4\. RİSKLER[^\n]*\n[^\n]*\n/, '');
    expect(eksikBolumler(sadelestir(eksikli))).toEqual(['riskler']);
  });
});

describe('adimlarBolumu + sureIceriyor', () => {
  it('adımlar bölümündeki süreyi görür', () => {
    const adimlar = adimlarBolumu(sadelestir(TAM_MUTALAA));
    expect(adimlar).toContain('arabulucu');
    expect(sureIceriyor(adimlar)).toBe(true);
  });

  it('süresiz adımları süreli saymaz', () => {
    const sade = sadelestir('6. ATILACAK ADIMLAR\nDosya incelenmeli ve müvekkille görüşülmelidir.');
    expect(sureIceriyor(adimlarBolumu(sade))).toBe(false);
  });

  it('yalnız önceki bölümlerde geçen süreyi adımlara saymaz', () => {
    // Süre incelemede geçip adımlarda geçmiyorsa avukat "ne zamana kadar"
    // sorusunun cevabını atacağı adımın yanında görmez.
    const sade = sadelestir('3. İNCELEME\nBir ay içinde başvurulur.\n6. ATILACAK ADIMLAR\nDilekçe yazılacak.');
    expect(sureIceriyor(adimlarBolumu(sade))).toBe(false);
  });

  it('tarih yazılışını da süre sayar', () => {
    expect(sureIceriyor(sadelestir('6. ATILACAK ADIMLAR\n14.05.2026 tarihine kadar dava açılmalı.'))).toBe(true);
  });
});
