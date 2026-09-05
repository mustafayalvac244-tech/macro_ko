import { describe, expect, it } from 'vitest';
import { beslemeyiKirp, kuralBasliklari, tokenTahmin } from '../supabase/functions/_shared/besleme';

/**
 * Groq'un ücretsiz anahtarında dakikalık tavan 8.000 token ve sağlayıcı bunu
 * girdi + istenen çıktı olarak sayıyor. Dilekçe isteğimiz 8.003 çıkıp HTTP 413
 * aldı — üç token yüzünden cevap hiç üretilmedi. Sağlık ucuyla tek tek
 * sorduk: bu anahtardaki BÜTÜN modellerin tavanı 8.000, yani "başka modele
 * geç" bu sorunu çözmüyor.
 */
describe('tokenTahmin', () => {
  it('kötümser tarafta kalır', () => {
    // Fazla tahmin edip gereksiz kırpmak, az tahmin edip 413 almaktan iyidir:
    // biri cevabı zayıflatır, öteki cevabı yok eder.
    expect(tokenTahmin('a'.repeat(300))).toBe(100);
  });

  it('boş girdide çökmez', () => {
    expect(tokenTahmin('')).toBe(0);
    expect(tokenTahmin(undefined as unknown as string)).toBe(0);
  });
});

describe('beslemeyiKirp', () => {
  const sabit = 'x'.repeat(3000); // ~1.000 token

  it('sığan beslemeye dokunmaz', () => {
    const b = 'y'.repeat(3000); // ~1.000 token
    const s = beslemeyiKirp(b, sabit, 3000);
    expect(s.kirpildi).toBe(false);
    expect(s.besleme).toBe(b);
  });

  it('sığmayan beslemeyi kırpar ve tavanın altına indirir', () => {
    const b = 'y'.repeat(30000); // ~10.000 token
    const s = beslemeyiKirp(b, sabit, 3000);
    expect(s.kirpildi).toBe(true);
    expect(s.tahminiBoy).toBeLessThanOrEqual(8000);
  });

  it('sondan kırpar: kurallar kalır, içtihat gider', () => {
    // Öncelik sırası: kural (ölçümle kazanılmış düzeltmeler) → madde metni →
    // içtihat (destekleyici). Sığmayan istekte en az kritik olan kaybedilir.
    const b =
      '\n\n### KESİN HUKUKİ KURALLAR\n' + 'k'.repeat(6000) +
      '\n\n### İLGİLİ MEVZUAT\n' + 'm'.repeat(6000) +
      '\n\n### İÇTİHAT\n' + 'i'.repeat(9000);
    const s = beslemeyiKirp(b, sabit, 3000);
    expect(s.kirpildi).toBe(true);
    expect(s.besleme).toContain('KESİN HUKUKİ KURALLAR');
    expect(s.besleme).not.toContain('### İÇTİHAT');
  });

  it('bölüm sınırında keser (yarım madde metni vermez)', () => {
    const b = '\n\n### A\n' + 'a'.repeat(9000) + '\n\n### B\n' + 'b'.repeat(9000);
    const s = beslemeyiKirp(b, sabit, 3000);
    expect(s.besleme.endsWith('b')).toBe(false);
  });

  it('besleme olmadan bile sığmıyorsa boş döner', () => {
    // Bu durumda çağıranın çıktı tavanını düşürmesi gerekir; beslemeyi kırpmak
    // sorunu çözmez.
    const s = beslemeyiKirp('z'.repeat(3000), 'x'.repeat(30000), 3000);
    expect(s.besleme).toBe('');
    expect(s.kirpildi).toBe(true);
  });
});

describe('kuralBasliklari', () => {
  const besleme =
    '\n\n### KESİN HUKUKİ KURALLAR — BUNLARA UYMAK ZORUNDASIN:\n' +
    '• İKİ HAKLI İHTAR NEDENİYLE TAHLİYE (TBK m.352/2) — kira bedelini zamanında ödemeyen kiracıya karşı.\nDevam eden satır.\n' +
    '• İŞE İADE — arabuluculuk dava şartıdır.\nBaşka satır.\n';

  it('kural başlıklarını çıkarır', () => {
    // Ölçümde üç kez görüldü: kural beslemeye birinci sırada girdi, mütalaada
    // hiç geçmedi. Başlıkları istemin SONUNA koymak, beslemeyi büyütmeden
    // aynı bilgiyi görünür kılar.
    expect(kuralBasliklari(besleme)).toEqual([
      'İKİ HAKLI İHTAR NEDENİYLE TAHLİYE (TBK m.352/2)',
      'İŞE İADE',
    ]);
  });

  it('gövdeyi tekrarlamaz (liste beslemenin kendisi kadar uzamasın)', () => {
    for (const b of kuralBasliklari(besleme)) expect(b.length).toBeLessThanOrEqual(120);
  });

  it('kural yoksa boş döner', () => {
    expect(kuralBasliklari('')).toEqual([]);
    expect(kuralBasliklari('### MEVZUAT\nHMK m.119 ...')).toEqual([]);
  });
});
