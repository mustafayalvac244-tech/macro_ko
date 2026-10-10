// AI SOHBET EKRANI — GÖNDERİM HATASI, SESSİZ DEPO HATASI, ZAMAN AŞIMI
// (10.10.2026, 50 denetçi bulgusu 22).
//
// • Taslak: başarısız gönderimde soru kutuya geri konuyordu (d580234), ama
//   araya yeni metin girmişse geri konan soru SESSİZCE kayboluyordu; ve
//   gönderim sürerken gelen ikinci çağrı `true` dönüp kutuyu boşaltıyordu.
// • Depo: AsyncStorage yazma hatası `.catch(() => {})` ile yutuluyordu; dolu
//   depoda sohbet kapanınca gidiyor, kullanıcı haberdar olmuyordu.
// • Zaman aşımı: istemci sunucuyu sonsuza kadar bekliyordu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_SOHBET_ZAMAN_ASIMI_MS, aiBaglantiKodu, aiHataMetni } from '../src/lib/aiHata';
import { taslakGeriYukle } from '../src/utils/sohbetGecmisi';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/en';

const oku = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const kanca = oku('src/hooks/useAiChat.ts');
const ekran = oku('app/ai-chat.tsx');

describe('taslakGeriYukle', () => {
  it('kutu boşsa gönderilen soru geri gelir', () => {
    expect(taslakGeriYukle('', 'uzun soru')).toBe('uzun soru');
    expect(taslakGeriYukle('   ', 'uzun soru')).toBe('uzun soru');
  });

  it('araya yeni metin girmişse İKİSİ de korunur', () => {
    expect(taslakGeriYukle('yeni', 'eski soru')).toBe('eski soru\n\nyeni');
  });

  it('aynı metin iki kez eklenmez', () => {
    expect(taslakGeriYukle('eski soru', 'eski soru')).toBe('eski soru');
  });
});

describe('aiBaglantiKodu', () => {
  it('iptal (zaman aşımı) hatası zaman_asimi', () => {
    expect(aiBaglantiKodu({ name: 'FunctionsFetchError', context: { name: 'AbortError' } })).toBe('zaman_asimi');
    expect(aiBaglantiKodu({ name: 'FunctionsFetchError', context: { name: 'TimeoutError' } })).toBe('zaman_asimi');
  });

  it('diğer ağ hatası generic (internet)', () => {
    expect(aiBaglantiKodu({ name: 'FunctionsFetchError', context: new TypeError('Network request failed') })).toBe('generic');
  });

  it('sunucu cevap verdiyse (HTTP/relay hatası) bağlantı hatası DEĞİL', () => {
    expect(aiBaglantiKodu({ name: 'FunctionsHttpError' })).toBeNull();
    expect(aiBaglantiKodu({ name: 'FunctionsRelayError' })).toBeNull();
    expect(aiBaglantiKodu(null)).toBeNull();
  });
});

describe('yeni hata kodları kullanıcıya doğru cümleyi söyler', () => {
  const t = ((k: string) => k) as unknown as Parameters<typeof aiHataMetni>[1];
  it('zaman_asimi, girdi_buyuk, yedek_gunluk', () => {
    expect(aiHataMetni({ error: 'zaman_asimi' }, t)).toBe('ai.errZamanAsimi');
    expect(aiHataMetni({ error: 'girdi_buyuk' }, t)).toBe('ai.errGirdiBuyuk');
    expect(aiHataMetni({ error: 'yedek_gunluk' }, t)).toBe('ai.errYedekGunluk');
  });

  it('çeviri anahtarları tr ve en dosyalarında var', () => {
    for (const k of ['ai.errZamanAsimi', 'ai.errGirdiBuyuk', 'ai.errYedekGunluk', 'ai.errSaklama']) {
      expect((tr as Record<string, string>)[k], `tr ${k}`).toBeTruthy();
      expect((en as Record<string, string>)[k], `en ${k}`).toBeTruthy();
    }
  });

  it('zaman aşımı mesajı "hakkınızdan düşülmedi" DEMEZ (sunucu işi bitirmiş olabilir)', () => {
    expect((tr as Record<string, string>)['ai.errZamanAsimi']).not.toMatch(/düşülmedi/);
  });
});

describe('useAiChat', () => {
  it('sunucuya zaman aşımı verir', () => {
    expect(AI_SOHBET_ZAMAN_ASIMI_MS).toBeGreaterThan(0);
    expect(kanca).toMatch(/functions\.invoke\('ai-chat', \{[\s\S]*timeout: AI_SOHBET_ZAMAN_ASIMI_MS/);
  });

  it('bağlantı hatası (iptal/ağ) ayrı koda çevrilir, "sunucuya ulaşıldı" sayılmaz', () => {
    expect(kanca).toMatch(/aiBaglantiKodu\(fnErr\)/);
  });

  it('depo yazma hatası yutulmaz: kullanıcıya bildirilir', () => {
    expect(kanca).not.toMatch(/sohbetleriYaz\([^)]*\)\.catch\(\(\) => \{\}\)/);
    expect(kanca).toMatch(/setSaklamaHatasi\(true\)/);
    expect(ekran).toMatch(/saklamaHatasi/);
    expect(ekran).toMatch(/t\('ai\.errSaklama'\)/);
  });

  it('gönderim sürerken gelen ikinci çağrı ref ile engellenir ve false döner (soru kutuya geri döner)', () => {
    expect(kanca).toMatch(/gonderiyorRef\.current/);
    expect(kanca).not.toMatch(/if \(!text \|\| sending\) return true;/);
  });

  it('ekran geri yükleme için ortak yardımcıyı kullanır', () => {
    expect(ekran).toMatch(/taslakGeriYukle\(d, text\)/);
  });
});
