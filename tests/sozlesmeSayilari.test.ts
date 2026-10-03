import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AI_SORU_HAKKI, AI_MUTALAA_HAKKI, AI_ASIL_MODEL_HAKKI, DENEME_SORU_HAKKI, UCRETSIZ_DENEME_HAKKI, UCRETSIZ_LIMIT,
} from '../src/config/planlar';

/**
 * WEB'DEKİ SÖZLEŞME, KODDAKİ SAYILARLA AYNI ŞEYİ SÖYLEMELİ.
 *
 * NEDEN BU TEST VAR — ölçülmüş bir olay üzerine yazıldı. 12.09.2026'da yapay
 * zekâ kotası yükseltildi (250 → 750 asıl model, 12 → 25 mütalaa, üstüne 900
 * taşma). Uygulama içindeki sözleşme (app/terms.tsx) sayıları KODDAN okuduğu
 * için kendiliğinden güncellendi. docs/terms.html ise elle yazılıydı ve geride
 * kaldı: AYNI sözleşme web'de "250 soru", uygulamada "1.650 istek" diyordu.
 *
 * Bu, bu projede tekrar eden bir hata sınıfı: elle yazılıp unutulan liste.
 * Daha önce gizlilik metni "hiçbir veri paylaşılmaz" derken metinler ABD'ye
 * gidiyordu; aktarılan taraflar bu yüzden artık koddan okunuyor. Sözleşme
 * sayıları için de aynısı gerekiyordu.
 *
 * Test HTML'i üretmiyor, yalnız DOĞRULUYOR: sayı değişince test düşer ve
 * dosyayı güncellemek zorunda kalırsınız. Sessizce ayrışamaz.
 */
const HTML = readFileSync(new URL('../docs/terms.html', import.meta.url), 'utf8');

/** Sayıyı, HTML'de görüldüğü gibi (binlik ayraçsız) arar. */
const gecer = (n: number) => HTML.includes(String(n));

describe('docs/terms.html — sözleşmedeki sayılar koddaki sabitlerle aynı mı', () => {
  it('aylık toplam istek hakkı yazılı', () => {
    expect(gecer(AI_SORU_HAKKI)).toBe(true);
  });

  it('asıl modelle karşılanan istek sayısı yazılı', () => {
    // Bu ayrım gizlenemez: 751. istekten sonra çıktıyı üreten model değişiyor
    // ve kullanıcı bunu fark eder. Sözleşmede yazmazsa yanlış beyan olur.
    expect(gecer(AI_ASIL_MODEL_HAKKI)).toBe(true);
  });

  it('aylık mütalaa hakkı yazılı', () => {
    expect(gecer(AI_MUTALAA_HAKKI)).toBe(true);
  });

  it('deneme hakkı sayısı yazılı', () => {
    expect(gecer(DENEME_SORU_HAKKI)).toBe(true);
  });

  /**
   * SİTE KARTLARI SUNUCUYLA AYNI DENEME SAYISINI SÖYLESİN — 28.09.2026.
   *
   * Metin ile sunucu ayrışırsa hiçbir şey patlamaz; kullanıcı yanlış sayıyı
   * okur. 25.09'a kadar Vekil Pro kartı "3" diyordu, sunucu 10 veriyordu.
   * Ücretsiz karta 5 deneme 28.09'da geri geldi (ürün sahibi kararı).
   */
  it('ücretsiz kart ücretsiz deneme sayısını, Vekil Pro kartı toplam sayıyı yazıyor', () => {
    const site = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '');
    const bas = site.indexOf('<h3>Ücretsiz</h3>');
    const orta = site.indexOf('<h3>Vekil Pro</h3>');
    expect(bas, 'ücretsiz plan kartı bulunamadı').toBeGreaterThan(-1);
    expect(orta, 'Vekil Pro kartı bulunamadı').toBeGreaterThan(bas);
    const ucretsiz = site.slice(bas, orta);
    const pro = site.slice(orta, orta + 1500);
    expect(ucretsiz).toContain(`${UCRETSIZ_DENEME_HAKKI} deneme sorusu`);
    expect(pro).toContain(`toplam ${DENEME_SORU_HAKKI} deneme sorusu`);
  });

  it('sözleşme ücretsiz deneme sayısını yazıyor', () => {
    expect(HTML).toContain(`tek seferlik ${UCRETSIZ_DENEME_HAKKI} soru`);
    expect(HTML).toContain(`toplam hak ${DENEME_SORU_HAKKI} sorudur`);
  });

  it('ücretsiz katman satır sınırları yazılı', () => {
    expect(gecer(UCRETSIZ_LIMIT.dava)).toBe(true);
    expect(gecer(UCRETSIZ_LIMIT.muvekkil)).toBe(true);
    expect(gecer(UCRETSIZ_LIMIT.belge)).toBe(true);
  });

  it('ESKİ kota sayıları metinde KALMAMIŞ olmalı', () => {
    // 250 ve 12, 12.09.2026 öncesinin değerleriydi. Yeni sayılar eklenip
    // eskiler unutulursa sözleşme iki farklı rakam söyler; bu testin asıl
    // yakaladığı durum buydu.
    const eskiKota = /aylık\s*250\s*soru|12\s*hukuki\s*mütalaa/i;
    expect(eskiKota.test(HTML)).toBe(false);
  });
});
