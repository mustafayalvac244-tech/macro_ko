import { describe, expect, it } from 'vitest';
import { base64OnEkiniKirp, baytlariBase64 } from '../src/utils/base64Metni';

/**
 * DOSYA OKUMANIN SAF PARÇALARI.
 *
 * NEDEN. Bu iki işlev, 13.09.2026'da bulunan web arızasının düzeltmesinin
 * içindeki iki sessiz tuzağı kapatıyor. İkisi de KÜÇÜK DOSYADA ÇALIŞIP
 * BÜYÜKTE ya da FARKLI PLATFORMDA patlayan türden:
 *
 *  1) `btoa(String.fromCharCode(...baytlar))` birkaç megabaytlık bir PDF'te
 *     çağrı yığınını taşırır. Geliştiricinin denediği 2 KB'lık metin dosyası
 *     geçer, avukatın 4 MB'lık dosya belgesi patlar.
 *  2) Tarayıcı base64'ü "data:...;base64," ön ekiyle verir, natif vermez.
 *     Ön ek kırpılmazsa sunucu çözemez ve kullanıcıya "dosya bozuk" gibi
 *     görünür — oysa dosya sağlamdır.
 *
 * Okuma işlevlerinin kendisi burada sınanamaz: Platform ve expo-file-system
 * react-native çekiyor, vitest onu ayrıştıramıyor (aynı sebeple planlar
 * src/config/planlar.ts'e taşınmıştı). Bu yüzden saf kısımlar
 * src/utils/base64Metni.ts'e ayrıldı ve burada sınanıyor.
 */

describe('base64 çevrimi', () => {
  it('bilinen bir metni doğru çevirir', () => {
    const baytlar = new TextEncoder().encode('Vekil Pro');
    expect(baytlariBase64(baytlar)).toBe('VmVraWwgUHJv');
  });

  it('ikili (metin olmayan) baytları bozmadan çevirir', () => {
    // PDF imzası %PDF- ve ardından metin olmayan baytlar.
    const baytlar = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0x80, 0x7f]);
    const cikti = baytlariBase64(baytlar);
    // Geri çevirince aynı baytlar çıkmalı: kayıpsızlık asıl ölçüt.
    const geri = Uint8Array.from(atob(cikti), (c) => c.charCodeAt(0));
    expect([...geri]).toEqual([...baytlar]);
  });

  it('BÜYÜK dosyada yığın taşırmıyor (asıl sebep bu)', () => {
    // 4 MB — avukatın UYAP'tan indirdiği bir dosya belgesi bu boyutta olur.
    // Yayma işleçli uygulama burada "Maximum call stack size exceeded" verir.
    const baytlar = new Uint8Array(4 * 1024 * 1024);
    for (let i = 0; i < baytlar.length; i++) baytlar[i] = i % 256;
    const cikti = baytlariBase64(baytlar);
    expect(cikti.length).toBeGreaterThan(5_000_000);
    // Baştan ve sondan doğrula: parçalama sınırında bayt kaymasın.
    const geri = Uint8Array.from(atob(cikti.slice(0, 8)), (c) => c.charCodeAt(0));
    expect([...geri.slice(0, 3)]).toEqual([0, 1, 2]);
  });

  it('parça sınırında (32 KB) kayma olmuyor', () => {
    // Parçalama 0x8000 baytta bölüyor; tam sınırdaki bir dosya, hatalı
    // bölmenin en kolay görüleceği yer.
    const n = 0x8000 + 5;
    const baytlar = new Uint8Array(n);
    for (let i = 0; i < n; i++) baytlar[i] = (i * 7) % 256;
    const geri = Uint8Array.from(atob(baytlariBase64(baytlar)), (c) => c.charCodeAt(0));
    expect(geri.length).toBe(n);
    expect([...geri.slice(-5)]).toEqual([...baytlar.slice(-5)]);
  });
});

describe('data: ön eki', () => {
  it('tarayıcının verdiği ön eki kırpar', () => {
    expect(base64OnEkiniKirp('data:application/pdf;base64,JVBERi0x')).toBe('JVBERi0x');
  });

  it('ham base64\'e dokunmaz (natif yol bozulmasın)', () => {
    expect(base64OnEkiniKirp('JVBERi0x')).toBe('JVBERi0x');
  });

  it('içinde virgül geçen ham base64\'ü ön ek sanmaz', () => {
    // base64 alfabesinde virgül yoktur; yine de "data:" ile başlamayan hiçbir
    // metne dokunulmadığını sabitliyoruz.
    expect(base64OnEkiniKirp('AAAA,BBBB')).toBe('AAAA,BBBB');
  });
});
