// Uygulama bildirimi (push) — 30.09.2026, bkz. 0161_push_bildirim.sql.
//
// Korunan üç şey:
//  1. Gönderme fonksiyonu yalnız yöneticiye açık (herkese bildirim atma yetkisi
//     bir kullanıcıya sızarsa uygulama adına spam atılır).
//  2. Cihaz tablosu RLS'li ve anon'a kapalı (token bir cihaz tanımlayıcısı).
//  3. Çıkışta cihaz kaydı, oturum KAPANMADAN silinir; sonra silinirse RPC
//     kimliksiz koşar, hiçbir şey silmez ve telefon eski hesabın
//     bildirimlerini almaya devam eder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');
const goc = readFileSync(join(KOK, 'supabase/migrations/0161_push_bildirim.sql'), 'utf8');

function govde(ad: string): string {
  const bas = goc.indexOf(`function public.${ad}(`);
  expect(bas, `${ad} bulunamadı`).toBeGreaterThan(-1);
  return goc.slice(bas, goc.indexOf('$function$;', bas));
}

describe('push bildirimi (0161)', () => {
  it('gönderme ve özet fonksiyonu yönetici denetimiyle başlıyor', () => {
    for (const ad of ['admin_bildirim_gonder', 'admin_bildirim_ozet']) {
      expect(govde(ad)).toMatch(/is_admin[\s\S]*raise exception 'not_admin'/);
    }
  });

  it('tablolar RLS açık, anon yetkisiz', () => {
    expect(goc).toMatch(/alter table public\.push_cihaz enable row level security/);
    expect(goc).toMatch(/alter table public\.bildirim_gonderim enable row level security/);
    expect(goc).toMatch(/revoke all on public\.push_cihaz from anon/);
    for (const imza of ['push_cihaz_kaydet(text, text)', 'push_cihaz_sil(text)', 'admin_bildirim_ozet()', 'admin_bildirim_gonder(text, text, integer)']) {
      expect(goc).toContain(`revoke execute on function public.${imza} from public, anon;`);
    }
  });

  it('çıkışta cihaz kaydı oturum kapanmadan siliniyor', () => {
    const auth = readFileSync(join(KOK, 'src/store/authStore.ts'), 'utf8');
    const cikis = auth.slice(auth.indexOf('signOut: async'));
    const sil = cikis.indexOf('pushAdresiniSil()');
    const kapat = cikis.indexOf('supabase.auth.signOut()');
    expect(sil).toBeGreaterThan(-1);
    expect(sil).toBeLessThan(kapat);
  });
});
