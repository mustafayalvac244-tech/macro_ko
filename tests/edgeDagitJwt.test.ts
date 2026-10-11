import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * edge-dagit.yml "HEPSİ" SEÇENEĞİ (10.10.2026, 50 denetçi → ajan 26).
 *
 * `supabase functions deploy` (işlev adı vermeden) TÜM işlevleri TEK bayrakla
 * dağıtıyordu: varsayılan jwt_dogrulama=true ile revenuecat-webhook,
 * stripe-webhook ve ai-chat'in verify_jwt'si canlıda KAPALI iken AÇILIRDI.
 * İlk ikisini RevenueCat/Stripe çağırır, JWT taşıyamazlar → tüm satın alma
 * bildirimleri 401 alırdı; ai-chat'te istemci jetonu başka yoldan doğrulanıyor.
 * Üstelik bu ikisi tek tek seçilebilir listede YOKTU: yalnız HEPSİ ile
 * dağıtılabiliyorlardı.
 *
 * Çözüm: işlev başına doğru bayrak, depoda tek tabloda (supabase/edge-verify-jwt.txt).
 */
const TABLO = 'supabase/edge-verify-jwt.txt';
const IS_AKISI = '.github/workflows/edge-dagit.yml';

/** list_edge_functions (salt okunur), 10.10.2026, proje wjshlysfmeqlnfiibknj. */
const CANLI: Record<string, 'acik' | 'kapali'> = {
  'ai-chat': 'kapali',
  'ai-saglik': 'acik',
  'doc-extract': 'acik',
  'embed-ictihat': 'acik',
  'harvest-tick': 'acik',
  ictihat: 'acik',
  'katalog-tick': 'acik',
  'payment-sheet': 'acik',
  'resmi-gazete': 'acik',
  'revenuecat-webhook': 'kapali',
  'stripe-webhook': 'kapali',
};

function tabloOku(): Record<string, string> {
  const t: Record<string, string> = {};
  for (const satir of readFileSync(TABLO, 'utf8').split('\n')) {
    const s = satir.trim();
    if (!s || s.startsWith('#')) continue;
    const [ad, deger] = s.split(/\s+/);
    t[ad] = deger;
  }
  return t;
}

describe('işlev başına verify_jwt tablosu', () => {
  it('tablo var', () => {
    expect(existsSync(TABLO)).toBe(true);
  });

  it('depodaki HER işlev tabloda (yeni işlev bilinçli bayraksız dağıtılamaz) ve fazlası yok', () => {
    const dizinler = readdirSync('supabase/functions').filter(
      (ad) => !ad.startsWith('_') && statSync(`supabase/functions/${ad}`).isDirectory(),
    );
    expect(Object.keys(tabloOku()).sort()).toEqual(dizinler.sort());
  });

  it('değerler canlıdakiyle birebir', () => {
    expect(tabloOku()).toEqual(CANLI);
  });
});

describe('edge-dagit.yml', () => {
  const yml = readFileSync(IS_AKISI, 'utf8');
  // Yorumları at: tuzak anlatan başlık yorumu komut içeriyor olabilir.
  const kod = yml
    .split('\n')
    .filter((s) => !/^\s*#/.test(s))
    .join('\n');

  it('işlev adı vermeden (tek bayrakla hepsi) dağıtım komutu YOK', () => {
    // Eski komut: `supabase functions deploy --project-ref … $BAYRAK`.
    expect(kod).not.toMatch(/functions deploy\s+--/);
  });

  it('webhook işlevleri artık tek tek seçilebilir', () => {
    for (const ad of ['revenuecat-webhook', 'stripe-webhook', 'payment-sheet']) {
      expect(kod).toMatch(new RegExp(`^\\s*-\\s*${ad}\\b`, 'm'));
    }
  });

  it('bayrak tablodan okunuyor', () => {
    expect(kod).toContain('supabase/edge-verify-jwt.txt');
  });

  it('jwt_dogrulama girdisi korundu ve eski değerleri (true/false) kabul ediyor', () => {
    const blok = kod.slice(kod.indexOf('jwt_dogrulama:'), kod.indexOf('jobs:'));
    expect(blok).toMatch(/type:\s*choice/);
    expect(blok).toMatch(/^\s*-\s*'?otomatik'?/m);
    expect(blok).toMatch(/^\s*-\s*'?true'?\s*$/m);
    expect(blok).toMatch(/^\s*-\s*'?false'?\s*$/m);
  });

  it('HEPSİ açık bayrakla birleştirilemez (tek bayrak = hata)', () => {
    expect(kod).toMatch(/HEPSİ[\s\S]{0,400}otomatik|otomatik[\s\S]{0,400}HEPSİ/);
  });
});

/**
 * "Dağıt" adımının GERÇEK kabuk betiği çalıştırılır; `supabase` komutu yalnız
 * argümanlarını yazan bir taklitle değiştirilir (dağıtım YOK). Bayrakların
 * işlev başına doğru çıktığı böylece yaml'daki metinden değil, çalışan
 * betikten ölçülür. bash yoksa (ör. Windows) atlanır.
 */
const bashVar = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' }).stdout?.trim() === 'ok';

function dagitBetigi(): string {
  const satirlar = readFileSync(IS_AKISI, 'utf8').split('\n');
  const basla = satirlar.findIndex((s) => s.includes('- name: Dağıt'));
  const bitis = satirlar.findIndex((s) => s.includes('- name: Ne dağıtıldı'));
  const blok = satirlar.slice(basla, bitis);
  const run = blok.findIndex((s) => /run:\s*\|/.test(s));
  return blok
    .slice(run + 1)
    .map((s) => s.replace(/^ {10}/, ''))
    .join('\n');
}

function kos(islev: string, jwt: string) {
  const dizin = mkdtempSync(join(tmpdir(), 'edge-dagit-'));
  const taklit = join(dizin, 'supabase');
  writeFileSync(taklit, '#!/bin/bash\necho "supabase $*"\n');
  chmodSync(taklit, 0o755);
  const r = spawnSync('bash', ['-c', dagitBetigi()], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dizin}:${process.env.PATH}`, PROJECT_ID: 'P', RUNNER_TEMP: dizin, ISLEV: islev, JWT_GIRDISI: jwt },
  });
  const dagitimlar = (r.stdout ?? '')
    .split('\n')
    .filter((s) => s.startsWith('supabase functions deploy'))
    .map((s) => {
      const [, , , ad, ...bayrak] = s.split(' ');
      return { ad, jwtKapali: bayrak.includes('--no-verify-jwt') };
    });
  return { kod: r.status, dagitimlar, stderr: r.stderr ?? '' };
}

describe.skipIf(!bashVar)('Dağıt adımı (çalışan betik, taklit supabase)', () => {
  it('HEPSİ + otomatik: 11 işlev TEK TEK, her biri canlıdaki ayarla', () => {
    const r = kos('HEPSİ', 'otomatik');
    expect(r.kod).toBe(0);
    expect(r.dagitimlar).toHaveLength(Object.keys(CANLI).length);
    for (const { ad, jwtKapali } of r.dagitimlar) expect(jwtKapali, ad).toBe(CANLI[ad] === 'kapali');
    // Bozulan üçü özellikle:
    for (const ad of ['revenuecat-webhook', 'stripe-webhook', 'ai-chat']) {
      expect(r.dagitimlar.find((d) => d.ad === ad)?.jwtKapali, ad).toBe(true);
    }
  });

  it('tek işlev + otomatik: ai-chat KAPALI, ictihat AÇIK', () => {
    expect(kos('ai-chat', 'otomatik').dagitimlar).toEqual([{ ad: 'ai-chat', jwtKapali: true }]);
    expect(kos('ictihat', 'otomatik').dagitimlar).toEqual([{ ad: 'ictihat', jwtKapali: false }]);
  });

  it('eski çağrı biçimi (jwt_dogrulama=false ile ai-chat) hâlâ çalışır, uyarısız', () => {
    const r = kos('ai-chat', 'false');
    expect(r.kod).toBe(0);
    expect(r.dagitimlar).toEqual([{ ad: 'ai-chat', jwtKapali: true }]);
    expect(r.stderr).not.toContain('::warning::');
  });

  it('canlıdakinden FARKLI açık seçim uyarı verir (ai-chat + true)', () => {
    const r = kos('ai-chat', 'true');
    expect(r.dagitimlar).toEqual([{ ad: 'ai-chat', jwtKapali: false }]);
    expect(r.stderr).toContain('::warning::');
  });

  it('HEPSİ + açık bayrak REDDEDİLİR, hiçbir şey dağıtılmaz', () => {
    for (const jwt of ['true', 'false']) {
      const r = kos('HEPSİ', jwt);
      expect(r.kod).not.toBe(0);
      expect(r.dagitimlar).toEqual([]);
    }
  });

  it('tabloda kaydı olmayan işlev dağıtılmaz', () => {
    const r = kos('nobetci', 'otomatik');
    expect(r.kod).not.toBe(0);
    expect(r.dagitimlar).toEqual([]);
  });
});
