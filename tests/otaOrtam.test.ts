// OTA paketinin ortam değişkenleri — 03.10.2026.
//
// `eas update` eas.json'daki build profilini KULLANMAZ; EXPO_PUBLIC_* değerleri
// ota-yayinla.yml'de ayrıca verilmek zorunda. RevenueCat anahtarları orada
// yoktu: OTA inen her telefonda satın alma modülü hiç kurulmuyordu ve
// kimse abonelik alamıyordu (ekranda hata da çıkmıyordu). Bu test, derleme
// profilinde olup OTA'da olmayan bir EXPO_PUBLIC_* kalırsa düşer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');
const eas = JSON.parse(readFileSync(join(KOK, 'eas.json'), 'utf8'));
const ota = readFileSync(join(KOK, '.github/workflows/ota-yayinla.yml'), 'utf8');

describe('OTA ortamı (ota-yayinla.yml)', () => {
  const env: Record<string, string> = eas.build.production.env;

  it('production profilindeki her EXPO_PUBLIC_* değeri OTA adımında da aynı', () => {
    const anahtarlar = Object.keys(env).filter((k) => k.startsWith('EXPO_PUBLIC_'));
    expect(anahtarlar).toContain('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
    for (const k of anahtarlar) {
      expect(ota, `${k} OTA ortamında yok`).toContain(`${k}: ${env[k]}`);
    }
  });
});
