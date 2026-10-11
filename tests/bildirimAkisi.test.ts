// Hatırlatma bildirimi akışı — 09.10.2026 denetimi.
//
// Bu dosyalar expo-notifications / react-native içe aktarıyor ve test koşucusu
// onları yükleyemiyor (vitest.config.ts). Saf mantık utils/bildirimPlani.ts ve
// utils/bildirimMetni.ts testlerinde; burada yalnız BAĞLANTILAR korunuyor —
// her biri gerçek bir kusurun geri gelmesini yakalar:
//  1. Web'de tarayıcıdan bildirim izni istenmez (web hiçbir bildirim kuramıyor).
//  2. Kayıt yolu ve eşitleme TEK kurucudan geçer: tetik anı işareti ve
//     dokununca açılacak ekran iki yolda ayrışamaz.
//  3. Eşitleme, iOS'un okunamayan tetikleyicisini "güncel" saymaz.
//  4. İzin sonradan verilince eşitleme yeniden koşar.
//  5. Bildirime dokununca yanıtı dinleyen kod vardır.
//  6. Web'de Ayarlar'daki hatırlatma anahtarı gösterilmez.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');
const oku = (yol: string) => readFileSync(join(KOK, yol), 'utf8');

function fonksiyonGovdesi(kaynak: string, bas: string): string {
  const i = kaynak.indexOf(bas);
  expect(i, `${bas} bulunamadı`).toBeGreaterThan(-1);
  const son = kaynak.indexOf('\n}\n', i);
  return kaynak.slice(i, son === -1 ? undefined : son);
}

describe('notifications.ts', () => {
  const kaynak = oku('src/lib/notifications.ts');

  it('web’de izin İSTEMEDEN false döner', () => {
    const govde = fonksiyonGovdesi(kaynak, 'export async function registerForNotificationsAsync');
    const web = govde.indexOf("Platform.OS === 'web'");
    expect(web).toBeGreaterThan(-1);
    expect(web).toBeLessThan(govde.indexOf('requestPermissionsAsync'));
  });

  it('plan bildirimleri TEK yerden kurulur ve tetik anı + hedef verisi taşır', () => {
    // Biri bildirimKur (kayıt + eşitleme), biri sabah özeti.
    expect(kaynak.match(/scheduleNotificationAsync\(/g)).toHaveLength(2);
    expect(fonksiyonGovdesi(kaynak, 'async function bildirimKur')).toContain('data: bildirimVerisi(p)');
  });

  it('eşitleme kurulu bildirimi anı VE metniyle karşılaştırır (iOS biçimi dahil)', () => {
    const govde = fonksiyonGovdesi(kaynak, 'export async function syncEtkinlikBildirimleri');
    expect(govde).toContain('kuruluBildirimGuncelMi(');
    expect(govde).toContain('planIcerigi(p, kaynak)');
  });

  it('eşitlemeler web’de hiçbir şey denemez ve gördüğü izni kaydeder', () => {
    for (const ad of ['export async function syncEtkinlikBildirimleri', 'export async function syncMorningDigests']) {
      const govde = fonksiyonGovdesi(kaynak, ad);
      expect(govde, ad).toContain("Platform.OS === 'web'");
      expect(govde, ad).toContain('izinDurumunuYaz(');
    }
  });

  it('kayıt yolu dava/müvekkil adını bildirime taşımaz', () => {
    expect(kaynak).not.toMatch(/caseTitle\s*\}?\s*—/);
    expect(kaynak).not.toMatch(/name:\s*params\.clientName/);
  });
});

describe('izin sonradan verilince eşitleme koşar', () => {
  for (const yol of ['src/hooks/useReminderSync.ts', 'src/hooks/useMorningDigest.ts']) {
    it(yol, () => {
      const kaynak = oku(yol);
      expect(kaynak).toContain('useBildirimIzni((s) => s.izinli)');
      const bagimliliklar = kaynak.slice(kaynak.lastIndexOf('}, ['));
      expect(bagimliliklar.slice(0, bagimliliklar.indexOf(']'))).toContain('izinli');
    });
  }

  it('uygulama öne gelince izin yeniden okunur (cihaz ayarlarından verilmiş olabilir)', () => {
    const kaynak = oku('app/_layout.tsx');
    expect(kaynak).toMatch(/AppState\.addEventListener\('change'[\s\S]{0,200}bildirimIzniniYenile\(\)/);
  });
});

describe('bildirime dokununca', () => {
  it('kök düzen yanıtı dinler ve yalnız bilinen hedefi açar', () => {
    const kaynak = oku('app/_layout.tsx');
    expect(kaynak).toContain('Notifications.addNotificationResponseReceivedListener(');
    expect(kaynak).toContain('Notifications.getLastNotificationResponse()');
    expect(kaynak).toContain('bildirimHedefi(');
  });
});

describe('Ayarlar — web', () => {
  it('hatırlatma anahtarı web’de gösterilmez, yerine açıklama çıkar', () => {
    const kaynak = oku('app/settings.tsx');
    const i = kaynak.indexOf("t('settings.reminders')");
    const kart = kaynak.slice(i, kaynak.indexOf('</Card>', i));
    expect(kart).toMatch(/Platform\.OS !== 'web' && \(\s*<Switch/);
    expect(kart).toContain("t('settings.remindersWebOnly')");
  });
});
