import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Butce, istek } from '../scripts/istek.mjs';

/**
 * ÖLÇÜLEN ARIZA (2026-09-11, canlı koşu 34635964721). "tam ölçüm" koşusu
 * 51 dakika "in_progress" göründü ve veritabanına TEK BİR AI isteği düşmedi;
 * bunu ai_harcama_ozeti(3) ile 70 saniye arayla iki kez ölçtüm, ikisinde de
 * son istek koşu başlamadan ÖNCEKİ istekti.
 *
 * Sebep adaylarının ikisi de gerçek kusurdu ve ikisi de burada sınanıyor:
 *   • Hiçbir ölçüm betiğinde istek zaman aşımı yoktu. Node'un fetch'i
 *     kendiliğinden zaman aşımına uğramaz — asılı bir istek betiği sonsuza
 *     kadar bekletir.
 *   • Tek bir 429, 30 dakikaya kadar sessizce uyutabiliyordu (bekleme.mjs
 *     üst sınırı) ve bu 6 defa tekrarlanabiliyordu.
 *
 * İkisinin ortak sonucu, asıl zarar veren şeydi: betikler sonucu yalnız SONDA
 * yazdığı için koşu tavana çarpınca elde HİÇBİR ölçüm kalmıyordu.
 */

describe('istek — zaman aşımı', () => {
  let sunucu: Server;
  let adres = '';

  beforeAll(async () => {
    // Bağlantıyı kabul eden ama HİÇ CEVAP VERMEYEN sunucu: asılı isteğin
    // gerçek hâli. Eskiden burada test sonsuza kadar beklerdi.
    sunucu = createServer(() => {
      /* bilerek cevapsız */
    });
    await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
    const a = sunucu.address();
    adres = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}/`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => sunucu.close(() => r()));
  });

  it('cevap vermeyen uçta beklemeyi keser ve hata atar', async () => {
    const t0 = Date.now();
    await expect(istek(adres, {}, 300)).rejects.toThrow(/ZAMAN_ASIMI/);
    // Süre gerçekten kesilmiş olmalı; "hata attı" tek başına yetmez.
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('hata mesajı kaç saniye beklendiğini söyler', async () => {
    await expect(istek(adres, {}, 2000)).rejects.toThrow('ZAMAN_ASIMI (2sn)');
  });
});

describe('Butce', () => {
  it('bütçeye sığan uykuyu bekler ve true döner', async () => {
    const b = new Butce(5000);
    expect(await b.bekle(10)).toBe(true);
    expect(b.doldu()).toBe(false);
  });

  it('bütçeden uzun uykuyu BEKLEMEZ — asıl kusur buydu', async () => {
    // Gerçek örnek: 20 dakikalık bütçede 30 dakikalık geri çekilme ipucu.
    // Eskiden 30 dakika uyunuyor, iş tavana çarpıyor, sonuç yazılmıyordu.
    const b = new Butce(20 * 60 * 1000);
    const t0 = Date.now();
    expect(await b.bekle(30 * 60 * 1000)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it('bütçe dolunca doldu() true olur ve hiç beklenmez', async () => {
    const b = new Butce(0);
    expect(b.doldu()).toBe(true);
    expect(b.kalan()).toBe(0);
    expect(await b.bekle(1)).toBe(false);
  });

  it('satir() harcanan süreyi ve bütçeyi birlikte yazar', () => {
    expect(new Butce(20 * 60 * 1000).satir()).toMatch(/bütçe 20dk/);
  });
});
