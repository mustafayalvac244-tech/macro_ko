// ELLE HAK İADESİ KAPALI (09.10.2026, 50 denetçi bulgusu 5).
//
// `mode: 'iade'` her oturumlu kullanıcının cevabını ALMIŞ olduğu isteklerini
// tek tek iade etmesine izin veriyordu (ai_istek_iade: sahiplik ve "bir kez"
// denetimi var, SAYI tavanı yok). Cevabı alıp hakkı geri almak aylık
// soru/mütalaa kotasını anlamsız kılıyordu. Hiçbir istemci bu modu
// çağırmıyor (düğmesi hiç yazılmadı) → kapatıldı. Otomatik iadeler
// (tests/hakIadesi.test.ts) bundan bağımsız.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const kod = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');

describe('elle hak iadesi kapalı', () => {
  const bas = kod.indexOf("if (body.mode === 'iade')");
  const dal = kod.slice(bas, kod.indexOf('KVKK AÇIK RIZA KAPISI'));

  it("mode:'iade' veritabanında hiçbir şeyi geri vermiyor", () => {
    expect(bas).toBeGreaterThan(0);
    expect(dal).not.toMatch(/rpc\('ai_istek_iade'/);
  });

  it("istemciye 'kapali' diyor (2xx, ok:false — iade yanıtlarının biçimi)", () => {
    expect(dal).toMatch(/ok: false, neden: 'kapali'/);
  });

  it('uç işlevinin hiçbir yerinde elle iade RPC çağrısı kalmadı', () => {
    expect(kod).not.toMatch(/rpc\('ai_istek_iade'/);
  });
});
