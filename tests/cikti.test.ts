import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { dosyaAdiUret } from '@/utils/dosyaAdi';

/**
 * YAPAY ZEKÂ ÇIKTISINI DIŞARI ÇIKARMA.
 *
 * BULUNAN KUSUR (ölçüm, 2026-09-11): dilekçe, belge incelemesi ve mütalaa
 * ekranlarında metni dışarı çıkarmanın TEK yolu `Share.share()` idi.
 * react-native-web'in karşılığı Web Share desteklenmeyen tarayıcıda
 * `Promise.reject` ediyor (node_modules/react-native-web/src/exports/Share/
 * index.js), çağrı yerlerinin hepsi ise `.catch(() => {})` ile yazılmıştı.
 * Sonuç: masaüstünde düğmeye basınca HİÇBİR ŞEY olmuyordu — hata bile yoktu.
 *
 * Aşağıdaki testler yeni davranışı sabitler: web'de kopyala/indir, desteklenmeyen
 * durumda SESSİZ BAŞARISIZLIK DEĞİL, açık bir sonuç kodu.
 */

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Share: { share: vi.fn() },
}));

const cikti = await import('@/lib/cikti');

describe('dosyaAdiUret', () => {
  const gun = new Date(2026, 8, 11); // 11 Eylül 2026

  it('Türkçe harfleri sadeleştirir, boşlukları tire yapar', () => {
    expect(dosyaAdiUret('Dilekçe Taslağı', 'txt', gun)).toBe('dilekce-taslagi-2026-09-11.txt');
  });

  it('"İ" harfini bozmadan çevirir (toLowerCase tuzağı)', () => {
    // JS'te 'İ'.toLowerCase() iki kod birimine açılır ve dosya adını bozar.
    expect(dosyaAdiUret('İcra İtirazı', 'txt', gun)).toBe('icra-itirazi-2026-09-11.txt');
  });

  it('dosya sisteminde yasak karakterleri atar', () => {
    const ad = dosyaAdiUret('Dava / Cevap: "Ek*"', 'txt', gun);
    expect(ad).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('boş veya anlamsız başlıkta yine geçerli bir ad üretir', () => {
    expect(dosyaAdiUret('', 'txt', gun)).toBe('vekil-pro-2026-09-11.txt');
    expect(dosyaAdiUret('***', 'txt', gun)).toBe('vekil-pro-2026-09-11.txt');
  });

  it('çok uzun başlığı kırpar', () => {
    const ad = dosyaAdiUret('a'.repeat(300), 'txt', gun);
    expect(ad.length).toBeLessThan(90);
  });
});

describe('yetenek sorguları', () => {
  const orjNavigator = globalThis.navigator;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (orjNavigator) vi.stubGlobal('navigator', orjNavigator);
  });

  it('pano yoksa kopyalanabilirMi false', () => {
    vi.stubGlobal('navigator', {});
    expect(cikti.kopyalanabilirMi()).toBe(false);
  });

  it('pano varsa true', () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });
    expect(cikti.kopyalanabilirMi()).toBe(true);
  });

  it('navigator.share yoksa paylasilabilirMi false — düğme çizilmemeli', () => {
    vi.stubGlobal('navigator', {});
    expect(cikti.paylasilabilirMi()).toBe(false);
  });
});

describe('metniKopyala', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('panoya yazar ve kopyalandi döner', async () => {
    const yaz = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: yaz } });

    expect(await cikti.metniKopyala('merhaba')).toBe('kopyalandi');
    expect(yaz).toHaveBeenCalledWith('merhaba');
  });

  it('pano reddederse HATA döner — sessizce yutmaz', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(async () => { throw new Error('izin yok'); }) },
    });
    expect(await cikti.metniKopyala('x')).toBe('hata');
  });

  it('pano hiç yoksa desteklenmiyor döner', async () => {
    vi.stubGlobal('navigator', {});
    expect(await cikti.metniKopyala('x')).toBe('desteklenmiyor');
  });
});

describe('metniPaylas — web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Web Share YOKSA panoya kopyalar (eski davranış: hiçbir şey yapmazdı)', async () => {
    const yaz = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: yaz } });

    expect(await cikti.metniPaylas('dilekçe metni')).toBe('kopyalandi');
    expect(yaz).toHaveBeenCalledWith('dilekçe metni');
  });

  it('Web Share VARSA onu kullanır', async () => {
    const paylas = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { share: paylas, clipboard: { writeText: vi.fn() } });

    expect(await cikti.metniPaylas('metin', 'Başlık')).toBe('paylasildi');
    expect(paylas).toHaveBeenCalledWith({ title: 'Başlık', text: 'metin' });
  });

  it('kullanıcı paylaşım penceresini kapatırsa bu hata sayılmaz', async () => {
    const hata = Object.assign(new Error('iptal'), { name: 'AbortError' });
    vi.stubGlobal('navigator', {
      share: vi.fn(async () => { throw hata; }),
      clipboard: { writeText: vi.fn() },
    });
    expect(await cikti.metniPaylas('metin')).toBe('paylasildi');
  });
});

describe('metniIndir', () => {
  let tiklandi: { href?: string; download?: string } | null = null;

  beforeEach(() => {
    tiklandi = null;
    vi.stubGlobal('Blob', class { constructor(public parcalar: string[], public secenek: unknown) {} });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:sahte', revokeObjectURL: vi.fn() });
    const a: Record<string, unknown> = { click: vi.fn(() => { tiklandi = a as never; }) };
    vi.stubGlobal('document', {
      createElement: () => a,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('BOM ile UTF-8 .txt indirir (Word Türkçe harfleri bozmasın)', () => {
    const sonuc = cikti.metniIndir('Şirket ödemeyi yapmadı.', 'Dilekçe Taslağı');
    expect(sonuc).toBe('indirildi');
    expect(tiklandi?.download).toMatch(/^dilekce-taslagi-\d{4}-\d{2}-\d{2}\.txt$/);
  });
});
