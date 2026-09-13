import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TARAYICININ İSTEĞİ GÖNDEREBİLMESİ İÇİN GEREKEN BAŞLIK İZNİ.
 *
 * NEDEN BU TEST VAR — GERÇEK BİR ARIZA YÜZÜNDEN (13.09.2026, kullanıcı
 * bildirdi; biz fark etmemiştik).
 *
 * Sekiz uç işlevi kendi CORS listesini elle yazıyordu. İkisi `x-client-info`
 * başlığına izin veriyordu, ALTISI vermiyordu. supabase-js ise bu başlığı
 * HER isteğe kendiliğinden ekliyor (canlı paketten doğrulandı:
 * `"X-Client-Info":"supabase-js/2.110.0; …"`). Tarayıcı ön uçuşta başlığı
 * izinli görmeyince isteği hiç göndermiyor; supabase-js bunu gövdesiz bir
 * ağ hatası olarak sarıyor ve kullanıcı "İnternet bağlantınızı kontrol edin"
 * mesajını görüyor. Yani arıza bizdeyken suç internete atılıyordu.
 *
 * Etkisi küçük değildi: ai-chat (sohbet, dilekçe, mütalaa, belge, künye),
 * ictihat (ÜCRETSİZ içtihat araması dâhil) ve ai-saglik tarayıcıda tamamen
 * çalışmıyordu.
 *
 * GERÇEK CHROMIUM İLE ÖLÇÜLDÜ: canlı ai-chat başlıklarını taklit eden uca
 * yapılan fetch "TypeError: Failed to fetch" ile düştü (istek gitmedi);
 * doc-extract başlıklarını taklit eden uç 403 döndürdü ve gövde OKUNDU.
 *
 * BU TESTİN İŞİ: bir uç işlevinin kendi başına CORS listesi tanımlayıp
 * ortak dosyayı atlamasını engellemek. Kural yazıyla korunmaz — nitekim
 * korunmadı.
 */

const KOK = new URL('..', import.meta.url).pathname;
const UCLAR = join(KOK, 'supabase', 'functions');

/** supabase-js'in gönderdiği/gönderebileceği, izinli olması ZORUNLU başlıklar. */
const ZORUNLU = ['authorization', 'apikey', 'content-type', 'x-client-info'];

function ucDosyalari(): string[] {
  return readdirSync(UCLAR)
    .filter((ad) => !ad.startsWith('_') && statSync(join(UCLAR, ad)).isDirectory())
    .map((ad) => join(UCLAR, ad, 'index.ts'))
    .filter((yol) => {
      try { return statSync(yol).isFile(); } catch { return false; }
    });
}

describe('uç işlevlerinin CORS başlıkları', () => {
  it('ortak listede supabase-js\'in gönderdiği başlıkların hepsi izinli', () => {
    const ortak = readFileSync(join(UCLAR, '_shared', 'cors.ts'), 'utf8');
    const izin = ortak.match(/'Access-Control-Allow-Headers':\s*\n?\s*'([^']+)'/)?.[1] ?? '';
    const liste = izin.toLowerCase().split(',').map((x) => x.trim());
    expect(ZORUNLU.filter((b) => !liste.includes(b))).toEqual([]);
  });

  it('hiçbir uç kendi CORS listesini elle yazmıyor', () => {
    // Elle yazmak serbest bırakılırsa aradaki fark sessiz kalır: kod derlenir,
    // testler geçer, yalnız TARAYICI çalışmaz — en geç fark edilen arıza türü.
    const suclular: string[] = [];
    for (const yol of ucDosyalari()) {
      const metin = readFileSync(yol, 'utf8').replace(/\/\/[^\n]*/g, '');
      if (/Access-Control-Allow-Headers/.test(metin)) suclular.push(yol.replace(KOK, ''));
    }
    expect(suclular).toEqual([]);
  });

  it('tarayıcıyla konuşan her uç ortak listeyi içe aktarıyor', () => {
    const eksik: string[] = [];
    for (const yol of ucDosyalari()) {
      const metin = readFileSync(yol, 'utf8');
      // CORS kullanan ama ortak dosyadan almayan uç, listeyi nereden buluyor?
      const kullaniyor = /\bCORS\b|\bcorsHeaders\b/.test(metin);
      const aliyor = /from '\.\.\/_shared\/cors\.ts'/.test(metin);
      if (kullaniyor && !aliyor) eksik.push(yol.replace(KOK, ''));
    }
    expect(eksik).toEqual([]);
  });
});
