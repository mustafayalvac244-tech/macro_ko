// Yayınlanan web paketi gerçek Supabase projesine bağlanıyor mu — 26.09.2026.
//
// OLAY: 18.09.2026'dan (b6800e2) 26.09.2026'ya kadar canlı web uygulaması
// giriş yaptıramadı. docs/app, EXPO_PUBLIC_SUPABASE_URL tanımsızken
// derlenmişti; src/lib/supabase.ts bu durumda "placeholder.supabase.co"ya
// düşüyor ve derleme hata vermiyor. Üç ardışık paket böyle canlıya gitti.
// Artık `npm run export:web` ortam yoksa durur (scripts/web-ortam-denetimi.mjs);
// bu test de depoya giren paketin gerçek proje adresini taşıdığını denetler.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');

describe('docs/app web paketi', () => {
  it('gerçek Supabase proje adresini içeriyor', () => {
    const eas = JSON.parse(readFileSync(join(KOK, 'eas.json'), 'utf8'));
    const url: string = eas.build.production.env.EXPO_PUBLIC_SUPABASE_URL;
    const ref = new URL(url).hostname.split('.')[0];
    const giris = readFileSync(join(KOK, 'docs/app/index.html'), 'utf8').match(/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/);
    expect(giris, 'docs/app/index.html paket dosyasını göstermiyor').not.toBeNull();
    const paket = readFileSync(join(KOK, 'docs/app', giris![0]), 'utf8');
    expect(paket.includes(ref), `web paketi ${ref} adresini içermiyor — EXPO_PUBLIC_SUPABASE_URL olmadan derlenmiş`).toBe(true);
  });
});
