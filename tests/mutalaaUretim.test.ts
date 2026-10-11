import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MUTALAA_BOLUMLERI,
  MUTALAA_YAPI_TALIMATI,
  eksikBolumler,
  kalanMs,
  sureyleBekle,
} from '../supabase/functions/_shared/mutalaaDenetim';
import { aiHataMetni } from '../src/lib/aiHata';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/en';

const oku = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

/**
 * 09.10.2026 denetim bulguları (Hukuki Araştırma / mütalaa yolu):
 *  3. Ekran "mütalaa DEĞİLDİR, ne yapmanız gerektiğini SÖYLEMEZ" diyordu; istem
 *     "RESMİ HUKUKİ MÜTALAA ... net tavsiye" ürettiriyordu (scripts/olcum-*.json
 *     gerçek çıktılarında başlık "HUKUKİ MÜTALAA", metinde "Tavsiye: Derhal ...").
 *  5. Eksik bölüm denetimi yalnız ölçüm betiğindeydi; üretimde yoktu.
 *  2. İç süre sınırı yoktu: 151,6 sn'de platform 546 verdi, kullanıcı "internet" hatası gördü.
 *  4. Model reddi (refusal) "servis yanıt vermiyor" diye gösteriliyordu.
 */

const TAM = `
# HUKUKİ ARAŞTIRMA NOTU
## 1. OLAY VE TESPİTLER
Müvekkil 14.04.2026'da çıkarıldı.
## 2. HUKUKİ SORUNLAR
Feshin geçerliliği.
## 3. İNCELEME
**a)** İşK m.19.
## 4. RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI
Performans dosyası.
## 5. SONUÇ VE KANAAT
Güçlü görünüyor.
## 6. ATILACAK ADIMLAR (SIRALI, SÜRELERİYLE)
Bir ay içinde arabulucu.
`;

describe('eksikBolumler (üretimde)', () => {
  it('altı başlığı da olan notta eksik bildirmez', () => {
    expect(eksikBolumler(TAM)).toEqual([]);
  });

  it('düşen son bölümü (ATILACAK ADIMLAR) adıyla bildirir — kesilmiş çıktı', () => {
    const kesik = TAM.slice(0, TAM.indexOf('## 6.'));
    expect(eksikBolumler(kesik)).toEqual(['ATILACAK ADIMLAR']);
  });

  it('bölüm adı yalnız GÖVDEDE geçiyorsa başlık saymaz', () => {
    // Betikteki eski denetim metnin herhangi bir yerinde "risk" arıyordu:
    // RİSKLER başlığı hiç yazılmamış olsa da gövdedeki "risk" kelimesi geçirirdi.
    const riskBasligiYok = TAM.replace(/## 4\. RİSKLER[^\n]*\n/, '').replace('Performans dosyası.', 'Başka bir risk görülmedi.');
    expect(riskBasligiYok).toMatch(/risk/);
    expect(eksikBolumler(riskBasligiYok)).toEqual(['RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI']);
  });

  it('Türkçe büyük İ ve kalın/numaralı başlık biçimlerini tanır', () => {
    const farkli = [
      '**1) OLAY VE TESPİTLER**', '2. Hukuki Sorunlar', '### 3 - İNCELEME',
      'RİSKLER VE KARŞI TARAFIN OLASI SAVUNMALARI', '5) SONUÇ VE KANAAT', '__6. ATILACAK ADIMLAR__',
    ].join('\n\ngövde\n\n');
    expect(eksikBolumler(farkli)).toEqual([]);
  });

  it('boş metinde altısını da bildirir', () => {
    expect(eksikBolumler('')).toHaveLength(MUTALAA_BOLUMLERI.length);
  });
});

describe('mütalaa istemi ekranla tutarlı', () => {
  it('"mütalaa/tavsiye" vermeyi istemez; araştırma notu der', () => {
    expect(MUTALAA_YAPI_TALIMATI).not.toMatch(/RESMİ HUKUKİ MÜTALAA/);
    expect(MUTALAA_YAPI_TALIMATI).not.toMatch(/net tavsiye/i);
    expect(MUTALAA_YAPI_TALIMATI).toMatch(/ARAŞTIRMA NOTU/);
    // Başlığa "mütalaa" yazılmaması açıkça isteniyor.
    expect(MUTALAA_YAPI_TALIMATI).toMatch(/mütalaa[^.]*YAZMA|DEĞİLDİR/i);
  });

  it('istemin sıraladığı her başlık, denetimin aradığı başlıkla eşleşir', () => {
    // İstemdeki "N. BAŞLIK" satırlarını çek; hepsi denetimden geçmeli. İstem
    // değişir de denetim eskirse (ya da tersi) üretim sessizce "eksik" demeye başlar.
    const basliklar = [...MUTALAA_YAPI_TALIMATI.matchAll(/^\d\. ([A-ZÇĞİÖŞÜ ]+)/gm)].map((m) => m[1]);
    expect(basliklar).toHaveLength(MUTALAA_BOLUMLERI.length);
    expect(eksikBolumler(basliklar.map((b, i) => `## ${i + 1}. ${b}`).join('\n\nx\n\n'))).toEqual([]);
  });

  it('ekran metni de aynı şeyi söylüyor (yön değişirse bu test uyarır)', () => {
    expect(tr['mut.disclaimer']).toMatch(/DEĞİLDİR/);
    expect(tr['mut.lead']).toMatch(/SÖYLEMEZ/);
  });
});

describe('iç süre sınırı', () => {
  it('süresi dolan işi zaman_asimi ile reddeder', async () => {
    const yavas = new Promise<string>((coz) => setTimeout(() => coz('geç'), 200));
    await expect(sureyleBekle(yavas, 20)).rejects.toThrow('zaman_asimi');
  });

  it('sürede biten işin sonucunu olduğu gibi verir', async () => {
    await expect(sureyleBekle(Promise.resolve('tamam'), 500)).resolves.toBe('tamam');
  });

  it('bütçe zaten bittiyse işi beklemeden reddeder', async () => {
    await expect(sureyleBekle(new Promise<string>(() => {}), 0)).rejects.toThrow('zaman_asimi');
  });

  it('iş hata atarsa hata değişmeden geçer (zaman_asimi\'ne çevrilmez)', async () => {
    await expect(sureyleBekle(Promise.reject(new Error('refusal')), 500)).rejects.toThrow('refusal');
  });

  it('kalanMs başlangıçtan geçen süreyi tavandan düşer, eksiye inmez', () => {
    expect(kalanMs(1_000, 31_000, 120_000)).toBe(90_000);
    expect(kalanMs(1_000, 500_000, 120_000)).toBe(0);
  });
});

describe('uçtaki bağlantılar (kaynak denetimi)', () => {
  const uc = oku('supabase/functions/ai-chat/index.ts');
  const mutalaa = uc.slice(uc.indexOf('if (isMutalaa) {'), uc.indexOf('DOSYADAN KÜNYE'));

  it('eksik bölüm üretimde kusur sayılır ve yanıtta döner', () => {
    expect(mutalaa).toMatch(/eksikBolumler\(text\)/);
    expect(mutalaa).toMatch(/kusurluCikti\('mutalaa', text, eksikBolum\)/);
    expect(mutalaa).toMatch(/eksikBolum: eksikBolum\.length/);
  });

  it('model reddi ve zaman aşımı ayrı kodla döner, "upstream" olmaz', () => {
    expect(mutalaa).toMatch(/msg === 'refusal'/);
    expect(mutalaa).toMatch(/error: 'refusal'/);
    expect(mutalaa).toMatch(/msg === 'zaman_asimi'/);
    expect(mutalaa).toMatch(/error: 'zaman_asimi'/);
  });

  it('model çağrıları süre bütçesine bağlı', () => {
    expect(mutalaa).toMatch(/sureyleBekle\(/);
  });
});

describe('istemci hata metinleri', () => {
  const t = ((k: string) => k) as unknown as Parameters<typeof aiHataMetni>[1];

  it('zaman aşımı "internet" hatası göstermez', () => {
    expect(aiHataMetni({ error: 'zaman_asimi' }, t)).toBe('ai.errZamanAsimi');
  });

  it('model reddi "servis yanıt vermiyor" demez', () => {
    expect(aiHataMetni({ error: 'refusal' }, t)).toBe('ai.errRefusal');
  });

  it('yeni anahtarların TR ve EN karşılığı var', () => {
    for (const k of ['ai.errZamanAsimi', 'ai.errRefusal', 'mut.missingSections'] as const) {
      expect(tr[k], `tr ${k}`).toBeTruthy();
      expect(en[k], `en ${k}`).toBeTruthy();
    }
  });

  it('mut.missingSections bölüm listesini yerine koyar', () => {
    expect(tr['mut.missingSections']).toContain('{bolumler}');
    expect(en['mut.missingSections']).toContain('{bolumler}');
  });
});

describe('ekran yeni alanı gösterir', () => {
  const ekran = oku('app/mutalaa.tsx');
  it('eksikBolum yanıttan okunur ve çizilir', () => {
    expect(ekran).toMatch(/eksikBolum\?: string\[\]/);
    expect(ekran).toMatch(/mut\.missingSections/);
  });
});
