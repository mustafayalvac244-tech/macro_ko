import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ARAÇ AUDIT — OTA AYARLARI BİRBİRİNİ TUTMALI (28.09.2026).
// Ürün sahibi: "OTA ile güncelleme at … sonra da OTA ile dağıt."
// Bu ayarlardan biri kayarsa güncelleme yayımlanır ama HATA VERMEDEN hiçbir
// telefona inmez; fark etmek zordur. Sınav o sessiz kaymayı yakalamak için.

const KOK = new URL('..', import.meta.url).pathname;
const oku = (...yol: string[]) => readFileSync(join(KOK, ...yol), 'utf8');
const uygulama = JSON.parse(oku('arac-audit-app', 'app.json')).expo;
const paket = JSON.parse(oku('arac-audit-app', 'package.json'));

describe('Araç Audit OTA ayarları', () => {
  it('güncelleme adresi projenin kendi kimliğine işaret ediyor', () => {
    const kimlik: string = uygulama.extra.eas.projectId;
    expect(kimlik).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(uygulama.updates.url).toBe(`https://u.expo.dev/${kimlik}`);
    expect(uygulama.owner).toBe('olivyeejiru');
  });

  it('Vekil Pro’nun projesine işaret etmiyor', () => {
    // Aynı Expo hesabı, AYRI proje. Aynı kimlik olsaydı Araç Audit'in
    // güncellemesi avukatların telefonuna gidebilirdi.
    const vekil = JSON.parse(oku('app.json')).expo;
    expect(uygulama.extra.eas.projectId).not.toBe(vekil.extra.eas.projectId);
    expect(uygulama.slug).not.toBe(vekil.slug);
  });

  it('APK’nın istediği kanal ile iş akışının yayımladığı kanal aynı', () => {
    expect(uygulama.updates.requestHeaders['expo-channel-name']).toBe('production');
    expect(oku('.github', 'workflows', 'arac-audit-ota.yml')).toContain('--channel production');
  });

  it('çalışma zamanı sürümden gelir; açılış güncellemeyi beklemez', () => {
    expect(uygulama.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(uygulama.updates.fallbackToCacheTimeout).toBe(0);
    expect(uygulama.updates.checkAutomatically).toBe('ON_LOAD');
  });

  it('expo-updates kurulu ve SDK 57 sürümünde', () => {
    expect(paket.dependencies['expo-updates']).toMatch(/^~57\./);
    expect(paket.dependencies.expo).toMatch(/^~57\./);
  });
});
