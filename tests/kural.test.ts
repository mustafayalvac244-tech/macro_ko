import { describe, expect, it } from 'vitest';
import { atlananKurallar } from '../supabase/functions/_shared/kural';

/**
 * ÖLÇÜLEN İKİ MÜTALAA KUSURU DA "KURAL DOSYADAYDI, MODEL YOK SAYDI"YDI.
 * İkisi de korpus eksiği değildi — doğru kural havuzda vardı, aramada
 * çıkıyordu, dosyaya giriyordu. İstem zaten "sessizce atlama" diyor; talimat
 * tutmadı. Talimatla gideremiyoruz ama atlandığını görebiliyoruz.
 */
describe('atlananKurallar', () => {
  const iseIade = [{ id: 'ise_iade', zorunlu_terimler: ['arabulucu'] }];

  it('terim geçiyorsa uyarı üretmez', () => {
    expect(atlananKurallar(iseIade, 'Öncelikle arabulucuya başvurulmalıdır.')).toEqual([]);
  });

  it('ölçümdeki gerçek kusuru yakalar', () => {
    // Modelin yazdığı: "4 hafta içinde dava açın" — arabuluculuktan hiç söz yok.
    // Arabulucuya gidilmeden açılan dava USULDEN REDDEDİLİR.
    expect(atlananKurallar(iseIade, 'Fesihten itibaren 4 hafta içinde işe iade davası açılmalıdır.')).toEqual([
      'arabulucu',
    ]);
  });

  it('seçeneklerden biri yeterlidir', () => {
    const trafik = [{ id: 'trafik_zamanasimi', zorunlu_terimler: ['ceza zamanaşımı|uzamış|daha uzun'] }];
    expect(atlananKurallar(trafik, 'Kaza suç oluşturuyorsa daha uzun süre uygulanır.')).toEqual([]);
    expect(atlananKurallar(trafik, 'İki yıllık zamanaşımı 12.06.2026 tarihinde dolar.')).toEqual(['ceza zamanaşımı']);
  });

  it('büyük harfli Türkçe yazımı da eşleşir', () => {
    // JS'in /i bayrağı 'İ' (U+0130) harfini 'i'ye katlamaz; bu yüzden düzenli
    // ifade değil, toLocaleLowerCase('tr') kullanılıyor. Kural metinleri
    // BÜYÜK HARFLE vurgu yaptığı için bu tuzak burada gerçek.
    const heyet = [{ id: 'tuketici_hakem_heyeti', zorunlu_terimler: ['hakem heyeti'] }];
    expect(atlananKurallar(heyet, 'TÜKETİCİ HAKEM HEYETİNE başvuru zorunludur.')).toEqual([]);
  });

  it('terimi olmayan kural uyarı üretmez', () => {
    // Kuralların çoğunda terim yok; olmayanlar sessiz kalmalı ki uyarı
    // gürültüye dönüşmesin.
    expect(atlananKurallar([{ id: 'velayet', zorunlu_terimler: [] }], 'herhangi bir metin')).toEqual([]);
    expect(atlananKurallar([{ id: 'velayet' }], 'herhangi bir metin')).toEqual([]);
  });

  it('aynı terimi iki kuraldan da gelse bir kez söyler', () => {
    // 'arabulucu' hem ise_iade hem arabuluculuk_dava_sarti_kapsam kuralında
    // var ve ikisi birlikte dosyaya giriyor (ölçümde tam böyle oldu).
    const iki = [
      { id: 'ise_iade', zorunlu_terimler: ['arabulucu'] },
      { id: 'arabuluculuk_dava_sarti_kapsam', zorunlu_terimler: ['arabulucu'] },
    ];
    expect(atlananKurallar(iki, 'Dava açılmalıdır.')).toEqual(['arabulucu']);
  });

  it('boş metinde tüm terimler atlanmış sayılır', () => {
    expect(atlananKurallar(iseIade, '')).toEqual(['arabulucu']);
  });
});
