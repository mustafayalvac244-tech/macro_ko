import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * HATA YANITLARINDA İÇ AYRINTI (10.10.2026, 50 denetçi → ajan 26).
 *
 * Kullanıcının tarayıcısına giden yanıtta kütüphane/SQL/sağlayıcı hata
 * metni (`e.message`, `error.message`, sağlayıcının gövdesi) yer almamalı:
 * iç yapıyı (tablo/sütun adı, model kimliği, yol, kotadan kalan) sızdırır ve
 * kullanıcıya hiçbir faydası yok — istemci yalnız `error` KODUNU okuyor
 * (src altında `.detail`/`.neden` okuyan yok, ölçüldü). Ayrıntı sunucu
 * günlüğüne (console.error) yazılır.
 *
 * KAPSAM: kullanıcı jetonuyla (ya da hiç jetonsuz) çağrılabilen uçlar.
 * harvest-tick, katalog-tick, resmi-gazete, embed-ictihat yalnız servis
 * anahtarıyla çağrılır (403 aksi hâlde) ve yanıtı pg_cron/net.http_post
 * okur; oradaki `detail` bir teşhis kanalıdır (hasat_saglik) — bilerek
 * kapsam dışı.
 */
const KULLANICI_UCLARI = [
  'doc-extract',
  'payment-sheet',
  'ictihat',
  'ai-chat',
  'ai-saglik',
  'revenuecat-webhook',
  'stripe-webhook',
];

/** Yorum satırlarını at; geriye kod kalsın. */
function kod(ad: string): string[] {
  return readFileSync(`supabase/functions/${ad}/index.ts`, 'utf8')
    .split('\n')
    .filter((s) => !/^\s*(\/\/|\*|\/\*)/.test(s));
}

const YASAK: Array<[string, RegExp]> = [
  ['detail: <iç hata metni>', /\bdetail\s*:\s*[^,}\n]*(\.message|String\(e|ayrinti|\bmsg\b)/],
  ['detay: …', /\bdetay\s*:/],
  ['neden: msg (ham sağlayıcı hatası)', /\bneden\s*:\s*msg\b/],
  ['error: message (ham hata)', /\berror\s*:\s*message\b/],
];

describe('kullanıcıya dönen uç yanıtlarında iç hata ayrıntısı yok', () => {
  for (const ad of KULLANICI_UCLARI) {
    it(ad, () => {
      const ihlaller: string[] = [];
      kod(ad).forEach((satir, i) => {
        for (const [etiket, desen] of YASAK) {
          if (desen.test(satir)) ihlaller.push(`${ad} satır~${i + 1} [${etiket}]: ${satir.trim().slice(0, 100)}`);
        }
      });
      expect(ihlaller).toEqual([]);
    });
  }

  it('ayrıntı kaybolmadı: doc-extract, payment-sheet ve ictihat sunucu günlüğüne yazıyor', () => {
    expect(kod('doc-extract').join('\n')).toMatch(/console\.error\([^)]*parse_failed/);
    expect(kod('payment-sheet').join('\n')).toMatch(/console\.error\(/);
    expect(kod('ictihat').join('\n')).toMatch(/console\.error\('ictihat 502:'/);
  });
});
