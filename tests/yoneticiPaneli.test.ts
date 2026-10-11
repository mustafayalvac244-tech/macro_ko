import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onbellegeYazilsinMi } from '../src/lib/onbellekKurali';

/**
 * YÖNETİCİ PANELİ — 10.10.2026 denetimi (ajan 27). Ekran kodu okunarak bulundu;
 * hiçbiri kullanıcı bildirimi değil.
 *
 *  1) Premium tek dokunuşla, onaysız veriliyor/alınıyordu: yanlış satıra
 *     dokunmak bir kullanıcının aboneliğini sessizce açar ya da kapatırdı.
 *  2) Panelin 5 sorgusu `enabled` almıyordu: yönetici olmayan biri /admin
 *     adresini açarsa (ekran "erişim yok" gösterse bile) sorgular yine koşuyor,
 *     sunucudan `not_admin` hatası dönüyordu.
 *  3) Tüm sorgu verisi cihaza yazılıyor (src/lib/queryClient.ts, 24 saat).
 *     Panel TÜM kullanıcıların e-postasını/adını/finans toplamını getirir;
 *     bunlar yöneticinin telefonunda/tarayıcı deposunda şifresiz kalıyordu.
 *  4) Arama yalnız yüklenen son N kaydı süzer; toplam kullanıcı N'den
 *     büyükse "kullanıcı yok" sonucu yanıltıcıdır, bu söylenmiyordu.
 */

const KOK = new URL('..', import.meta.url).pathname;
const oku = (...yol: string[]) => readFileSync(join(KOK, ...yol), 'utf8');

describe('yönetici paneli', () => {
  it('premium vermek/almak onay penceresinden geçiyor', () => {
    const ekran = oku('app', 'admin.tsx');
    expect(ekran).toMatch(/from '@\/lib\/uyari'/);
    // Eski hâl: düğme doğrudan mutate çağırıyordu.
    expect(ekran).not.toMatch(/onToggle=\{\(\) => setPremium\.mutate/);
    // Yeni hâl: mutate yalnız bir uyar(...) düğmesinin onPress'inde.
    const uyarIdx = ekran.indexOf('uyar(');
    const mutateIdx = ekran.indexOf('setPremium.mutate(');
    expect(uyarIdx).toBeGreaterThan(-1);
    expect(mutateIdx).toBeGreaterThan(uyarIdx);
    expect(ekran.slice(uyarIdx, mutateIdx)).toMatch(/onPress:\s*\(\)\s*=>\s*$/);
    // Onay metni kimi etkilediğini söylemeli.
    expect(ekran).toMatch(/admin\.premiumOnayGovde/);
  });

  it('panel sorguları yönetici değilken koşmuyor', () => {
    const kanca = oku('src', 'hooks', 'useAdmin.ts');
    const ekran = oku('app', 'admin.tsx');
    // Ekranda doğrudan çağrılan beş sorgu kancası `enabled` almalı.
    for (const ad of ['useAdminOverview', 'useAdminUsers', 'useAdminAiOzeti', 'useAdminDenemeTakibi']) {
      expect(kanca, `${ad} enabled parametresi almıyor`).toMatch(
        new RegExp(`export function ${ad}\\(enabled = true\\)`),
      );
      expect(ekran, `${ad} ekranda !!isAdmin ile çağrılmıyor`).toMatch(
        new RegExp(`${ad}\\(!!isAdmin\\)`),
      );
    }
    expect(kanca).toMatch(/export function useAdminAtifDenetimi\(gun = 30, enabled = true\)/);
    expect(ekran).toMatch(/useAdminAtifDenetimi\(30, !!isAdmin\)/);
  });

  it('yönetici verisi cihaz önbelleğine yazılmıyor', () => {
    expect(onbellegeYazilsinMi(['admin', 'users'])).toBe(false);
    expect(onbellegeYazilsinMi(['admin', 'overview'])).toBe(false);
    expect(onbellegeYazilsinMi(['admin', 'kullanim-ozet', 7])).toBe(false);
    // Çevrimdışı dayanıklılık için yazılan sıradan veri etkilenmemeli.
    expect(onbellegeYazilsinMi(['cases'])).toBe(true);
    expect(onbellegeYazilsinMi(['hearings', 'bugun'])).toBe(true);
    expect(onbellegeYazilsinMi([])).toBe(true);

    // Kural gerçekten kalıcı yazıcıya bağlı mı? (Tanımlanıp bağlanmayan kural
    // hiçbir şeyi korumaz.)
    expect(oku('src', 'lib', 'queryClient.ts')).toMatch(/onbellegeYazilsinMi\(/);
    expect(oku('app', '_layout.tsx')).toMatch(/dehydrateOptions:\s*\{\s*shouldDehydrateQuery:\s*kalicidaTutulsunMu/);
  });

  it('arama sınırı kullanıcıya söyleniyor', () => {
    expect(oku('app', 'admin.tsx')).toMatch(/admin\.searchLimit/);
    for (const dil of ['tr', 'en']) {
      expect(oku('src', 'i18n', `${dil}.ts`), `${dil}.ts admin.searchLimit yok`).toMatch(/'admin\.searchLimit':/);
      expect(oku('src', 'i18n', `${dil}.ts`), `${dil}.ts admin.premiumOnayGovde yok`).toMatch(/'admin\.premiumOnayGovde':/);
    }
  });
});
