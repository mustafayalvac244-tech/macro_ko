import { describe, expect, it } from 'vitest';
import { atlananKurallar, cakisanDayanaklar } from '../supabase/functions/_shared/kural';

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

/**
 * ÇELİŞEN DAYANAK ÇİFTLERİ — atlananKurallar'ın tersi bir denetim.
 *
 * Gerçek kullanım denemesinde model, birbirinin ALTERNATİFİ olan iki kuralı
 * (temerrüt / iki haklı ihtar) birlikte dayanak gösterdi. Talimatla ayrımı
 * tutarlı yaptıramadık (koşudan koşuya değişti); mekanik denetim ekliyoruz.
 */
describe('cakisanDayanaklar', () => {
  it('her iki kural da dosyadaysa VE ikisinin işareti de metinde geçiyorsa uyarır', () => {
    const kurallar = new Set(['kira_temerrut_tahliye', 'iki_hakli_ihtar_tahliye']);
    const metin = 'TBK m.315 uyarınca temerrüt... ayrıca TBK m.352/2 iki haklı ihtar şartları...';
    expect(cakisanDayanaklar(kurallar, metin)).toHaveLength(1);
  });

  it('yalnız bir kural dosyadaysa uyarmaz', () => {
    const kurallar = new Set(['kira_temerrut_tahliye']);
    expect(cakisanDayanaklar(kurallar, 'TBK m.315 ve TBK m.352/2 ikisi de geçse bile')).toEqual([]);
  });

  it('ikisi de dosyada ama metinde yalnız biri dayanak gösterilmişse uyarmaz', () => {
    // Ölçümde görülen İYİ durum: model kuralı dosyada gördü ama HUKUKİ
    // SEBEPLER'de yalnız doğru olanı (315) kullandı; 352 hiç geçmedi.
    const kurallar = new Set(['kira_temerrut_tahliye', 'iki_hakli_ihtar_tahliye']);
    expect(cakisanDayanaklar(kurallar, 'Yalnız TBK m.315 uyarınca temerrüt oluşmuştur.')).toEqual([]);
  });

  it('bilinmeyen kural çiftinde uyarmaz', () => {
    expect(cakisanDayanaklar(new Set(['ise_iade', 'trafik_zamanasimi']), '315 352')).toEqual([]);
  });
});
