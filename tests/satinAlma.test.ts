import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CustomerInfo } from 'react-native-purchases';
import {
  abonelikYonetimAdresi,
  geriYuklemeMesaji,
  satinAlmaHataMesaji,
  ucretliPlanAcik,
  type SatinAlmaHatasi,
} from '@/lib/satinAlma';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * SATIN ALMA — saf kısım (src/lib/satinAlma.ts), 09.10.2026 denetimi.
 * Natif akış (kimlik koruması, SDK hata kodları): satinAlmaIstemcisi.test.ts.
 */

const musteri = (aktif: Record<string, unknown>) => ({ entitlements: { active: aktif } }) as unknown as CustomerInfo;

describe('geri yükleme sonucu doğru söylenir', () => {
  it('mağazada etkin yetki yoksa "bulundu" DENMEZ (RevenueCat boş yanıtı da başarı sayar)', () => {
    const m = geriYuklemeMesaji({ kind: 'success', customerInfo: musteri({}) });
    expect(m?.govde).toBe('premium.restoreNoneBody');
    expect(m?.profilYenile).toBe(false);
  });

  it('başka bir yetki tek başına abonelik sayılmaz', () => {
    expect(geriYuklemeMesaji({ kind: 'success', customerInfo: musteri({ eski_urun: {} }) })?.govde).toBe('premium.restoreNoneBody');
  });

  it.each(['premium', 'ai'])('%s yetkisi etkinse "bulundu" denir ve profil yeniden okunur', (yetki) => {
    const m = geriYuklemeMesaji({ kind: 'success', customerInfo: musteri({ [yetki]: { isActive: true } }) });
    expect(m?.govde).toBe('premium.restoreDoneBody');
    expect(m?.profilYenile).toBe(true);
  });

  it('mağaza bağlantısı yokken "satın alma bulunamadı" denmez — hiç bakılmadı', () => {
    const m = geriYuklemeMesaji({ kind: 'unavailable' });
    expect(m?.govde).toBe('premium.restoreUnavailableBody');
    expect(m?.govde).not.toBe('premium.restoreNoneBody');
  });

  it('hata geri yükleme başlığıyla ve nedene göre söylenir', () => {
    const m = geriYuklemeMesaji({ kind: 'error', neden: 'kimlik' });
    expect(m).toEqual({ baslik: 'premium.restoreFailedTitle', govde: 'premium.hata.kimlik', profilYenile: false });
  });

  it('vazgeçilirse hiçbir şey gösterilmez', () => {
    expect(geriYuklemeMesaji({ kind: 'cancelled' })).toBeNull();
  });
});

describe('satın alma hata metinleri', () => {
  const nedenler: SatinAlmaHatasi[] = [
    'oturum_yok', 'kimlik', 'ag', 'izin_yok', 'bekliyor', 'zaten_var', 'urun_yok', 'baska_hesap', 'magaza', 'bilinmeyen',
  ];

  it.each(nedenler)('%s: iki dilde de dolu, yer tutucusuz metin', (neden) => {
    const m = satinAlmaHataMesaji(neden);
    for (const sozluk of [tr, en] as Record<string, string>[]) {
      for (const anahtar of [m.baslik, m.govde]) {
        expect(sozluk[anahtar], anahtar).toBeTruthy();
        expect(sozluk[anahtar]).not.toMatch(/\[|\]/);
      }
    }
  });

  it('bekleyen ödeme "tamamlanamadı" diye değil "onay bekliyor" diye başlar', () => {
    expect(satinAlmaHataMesaji('bekliyor').baslik).toBe('premium.pendingTitle');
    expect(satinAlmaHataMesaji('ag').baslik).toBe('premium.purchaseFailedTitle');
  });

  it('kimlik bağlanamadıysa kullanıcıya ücret alınmadığı söylenir', () => {
    expect(tr['premium.hata.kimlik']).toMatch(/ücret alınmadı/);
    expect(en['premium.hata.kimlik']).toMatch(/not charged/);
  });
});

describe('ücretli plan durumu sunucuyla aynı', () => {
  it.each([
    [{ is_premium: true, ai_tier: null }, true],
    [{ is_premium: false, ai_tier: 'ai' }, true], // AI paketi Pro'yu içerir
    [{ is_premium: true, ai_tier: 'ai' }, true],
    [{ is_premium: false, ai_tier: 'baslangic' }, false],
    [{ is_premium: false, ai_tier: 'free' }, false],
    [{ is_premium: false, ai_tier: null }, false],
    [{}, false],
    [null, false],
  ])('%j → %s', (profil, beklenen) => {
    expect(ucretliPlanAcik(profil)).toBe(beklenen);
  });

  it('sunucudaki sınır kuralı hâlâ aynı (0087 plan_limiti_kontrol)', () => {
    const goc = readFileSync(join(__dirname, '..', 'supabase/migrations/0087_plan_limitleri.sql'), 'utf8');
    expect(goc).toContain("if coalesce(v_premium, false) or coalesce(v_ai, 'free') not in ('free', 'baslangic') then");
  });
});

describe('aboneliği yönet bağlantısı', () => {
  it('iOS: Apple belgesindeki abonelik sayfası', () => {
    expect(abonelikYonetimAdresi('ios')).toBe('https://apps.apple.com/account/subscriptions');
  });
  it('Android: Google Play abonelik merkezi', () => {
    expect(abonelikYonetimAdresi('android')).toBe('https://play.google.com/store/account/subscriptions');
  });
  it('web: mağaza yok', () => {
    expect(abonelikYonetimAdresi('web')).toBeNull();
  });
});
