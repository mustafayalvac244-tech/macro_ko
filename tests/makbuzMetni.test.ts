import { describe, expect, it } from 'vitest';
import { makbuzMetni, sayiyiYaziyaCevir, tutariYaziyaCevir } from '../src/utils/makbuzMetni';

/**
 * SINAVI BEN YAZDIM. Beklenen okunuşları da ben seçtim. Türkçe sayı okunuşu
 * için bir avukat/muhasebeci doğrulaması yapılmadı; aşağıdakiler yerleşik
 * okunuş kurallarına göre yazıldı.
 */
describe('sayiyiYaziyaCevir', () => {
  it('temel sayılar', () => {
    expect(sayiyiYaziyaCevir(0)).toBe('SIFIR');
    expect(sayiyiYaziyaCevir(5)).toBe('BEŞ');
    expect(sayiyiYaziyaCevir(15)).toBe('ONBEŞ');
    expect(sayiyiYaziyaCevir(90)).toBe('DOKSAN');
  });

  it('yüzler — "BİRYÜZ" diye bir okunuş yoktur', () => {
    expect(sayiyiYaziyaCevir(100)).toBe('YÜZ');
    expect(sayiyiYaziyaCevir(200)).toBe('İKİYÜZ');
    expect(sayiyiYaziyaCevir(345)).toBe('ÜÇYÜZKIRKBEŞ');
  });

  it('binler — 1000 "BİN"dir, "BİRBİN" değil', () => {
    expect(sayiyiYaziyaCevir(1000)).toBe('BİN');
    expect(sayiyiYaziyaCevir(1500)).toBe('BİNBEŞYÜZ');
    expect(sayiyiYaziyaCevir(2000)).toBe('İKİBİN');
    expect(sayiyiYaziyaCevir(21000)).toBe('YİRMİBİRBİN');
  });

  it('milyon ve sıfır grupları atlanır', () => {
    expect(sayiyiYaziyaCevir(1_000_000)).toBe('BİRMİLYON');
    expect(sayiyiYaziyaCevir(1_000_500)).toBe('BİRMİLYONBEŞYÜZ');
  });

  it('taşan sayıda BOŞ döner — yanlış yazıyla tutar basılmaz', () => {
    // Çağıran bunu görünce "yazıyla" satırını hiç basmıyor. Yanlış bir
    // yazıyla tutar, hiç yazmamaktan kötüdür.
    expect(sayiyiYaziyaCevir(1_000_000_000_000)).toBe('');
  });
});

describe('tutariYaziyaCevir', () => {
  it('lira ve kuruşu ayırır', () => {
    expect(tutariYaziyaCevir(1234.5)).toBe('BİNİKİYÜZOTUZDÖRT TL ELLİ KR');
    expect(tutariYaziyaCevir(3000)).toBe('ÜÇBİN TL');
  });

  it('kuruş sıfırsa KR yazmaz', () => {
    expect(tutariYaziyaCevir(500)).toBe('BEŞYÜZ TL');
  });
});

describe('makbuzMetni', () => {
  const temel = {
    makbuzNo: 'A-2026-001',
    tarih: '2026-09-13T10:00:00.000Z',
    aciklama: 'Boşanma davası vekalet ücreti',
    matrah: 10000,
    kdvOrani: 20,
    stopajOrani: 20,
    avukatAd: 'Av. Test Avukat',
    buro: 'Test Hukuk Bürosu',
    baroSicil: '12345',
    muvekkilAd: 'Ahmet Yılmaz',
  };

  it('hesabı serbestMeslekMakbuzu ile aynı yapar', () => {
    const { hesap } = makbuzMetni(temel);
    expect(hesap.kdvTutari).toBe(2000);
    expect(hesap.belgeToplami).toBe(12000);
    expect(hesap.stopajTutari).toBe(2000);
    expect(hesap.tahsilEdilecek).toBe(10000);
  });

  it('resmî makbuz OLMADIĞI belgenin içinde yazar', () => {
    // Bu uyarı kalkarsa avukat çıktıyı resmî makbuz sanıp koçandan kesmeyebilir
    // ve eksikliği aylar sonra fark eder. Test bu yüzden var.
    const { metin } = makbuzMetni(temel);
    expect(metin).toContain('resmî serbest meslek makbuzu değildir');
    expect(metin).toContain('e-SMM');
  });

  it('stopajı eksi işaretiyle ve açıklamasıyla yazar', () => {
    const { metin } = makbuzMetni(temel);
    expect(metin).toContain('−2.000,00 TL');
    expect(metin).toContain('vergi dairesine yatırılır');
  });

  it('stopaj yoksa o satır ve notu HİÇ basılmaz', () => {
    const { metin } = makbuzMetni({ ...temel, stopajOrani: null });
    expect(metin).not.toContain('stopaj');
    expect(metin).not.toContain('vergi dairesine yatırılır');
    // Boşluk sayısına bağlanmıyoruz: hizalama etiket uzunluklarından
    // hesaplanıyor ve yeni bir kalem eklenince değişir. Test edilen şey
    // DEĞER, sütun genişliği değil.
    expect(metin).toMatch(/^TAHSİL EDİLECEK\s+: 12\.000,00 TL$/m);
  });

  it('KDV yoksa o satır basılmaz ve toplam matraha eşit olur', () => {
    const { metin, hesap } = makbuzMetni({ ...temel, kdvOrani: null, stopajOrani: null });
    // "KDV" kelimesi yine geçer — "Brüt ücret (KDV hariç)" satırında. Aranan
    // şey KDV KALEMİNİN kendisi: "KDV (%20) : ..." satırı basılmamalı.
    expect(metin).not.toMatch(/^KDV \(%/m);
    expect(hesap.belgeToplami).toBe(10000);
  });

  it('boş alanlar satır olarak hiç basılmaz — "—" de basılmaz', () => {
    const { metin } = makbuzMetni({
      ...temel,
      buro: null,
      baroSicil: null,
      muvekkilAd: null,
      makbuzNo: null,
    });
    expect(metin).not.toContain('Büro:');
    expect(metin).not.toContain('Baro Sicil No:');
    expect(metin).not.toContain('MÜŞTERİ');
    expect(metin).not.toContain('Makbuz No:');
    expect(metin).not.toContain('—');
  });

  it('yazıyla tutar tahsil edilecek rakamı gösterir, belge toplamını değil', () => {
    // Yazıyla satırı elle yazılan yer olduğu için en sık hata burada olur:
    // 12.000 (belge toplamı) yazılırsa müvekkil fazla ödediğini sanır.
    const { metin } = makbuzMetni(temel);
    expect(metin).toMatch(/^Yazıyla\s+: ONBİN TL$/m);
  });
});
