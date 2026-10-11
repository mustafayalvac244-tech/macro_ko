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

// ---------------------------------------------------------------------------
// 0187 — 10.10.2026 denetimi. Davranışın kendisi yerelde ÖLÇÜLDÜ
// (scripts/migration-deneme/push-sonuc-olcum.sql, 15 satır GEÇTİ); burada
// yalnız o ölçümün dayandığı iskelet ve istemci bağlantıları korunuyor.
describe('push oturum + gönderim sonucu (0187)', () => {
  const goc2 = readFileSync(join(KOK, 'supabase/migrations/0187_push_oturum_ve_sonuc.sql'), 'utf8');
  const govde2 = (ad: string): string => {
    const bas = goc2.indexOf(`function public.${ad}(`);
    expect(bas, `${ad} bulunamadı`).toBeGreaterThan(-1);
    return goc2.slice(bas, goc2.indexOf('$function$;', bas));
  };

  it('özet ve gönderim oturumu biten cihazı dışlar (yoksa çıkış yapılan telefona gider)', () => {
    for (const ad of ['admin_bildirim_ozet', 'admin_bildirim_gonder']) {
      expect(govde2(ad)).toMatch(/c\.oturum_id is null[\s\S]*auth\.sessions/);
    }
  });

  it('kayıt oturum kimliğini JWT session_id’den yazar, biçimsiz değeri yazmaz', () => {
    const k = govde2('push_cihaz_kaydet');
    expect(k).toContain("auth.jwt() ->> 'session_id'");
    expect(k).toMatch(/\^\[0-9a-f\]\{8\}/);
  });

  it('sonuç fonksiyonu yönetici denetimiyle başlar, hata METNİNİ okumaz (cihaz adresi sızar)', () => {
    const s = govde2('admin_bildirim_sonuc');
    expect(s).toMatch(/is_admin[\s\S]*raise exception 'not_admin'/);
    expect(s).not.toMatch(/message/);
    expect(s).toContain('details,error');
  });

  it('yeni ve değişen fonksiyonlar anon’a kapalı', () => {
    for (const imza of ['push_cihaz_kaydet(text, text)', 'admin_bildirim_ozet()', 'admin_bildirim_gonder(text, text, integer)', 'admin_bildirim_sonuc(bigint)']) {
      expect(goc2).toContain(`revoke execute on function public.${imza} from public, anon;`);
    }
  });

  it('adres bellekte yoksa silme, adresi yeniden alıp dener', () => {
    const k = readFileSync(join(KOK, 'src/lib/notifications.ts'), 'utf8');
    const sil = k.slice(k.indexOf('export async function pushAdresiniSil'), k.indexOf('export async function cancelReminder'));
    expect(sil).toMatch(/kayitliPushAdresi \?\? .*pushAdresiniAl\(\)/);
  });

  it('panel kuyruğa bırakmayı “Gönderildi” diye sunmaz ve sonuç okuma düğmesi var', () => {
    const tr = readFileSync(join(KOK, 'src/i18n/tr.ts'), 'utf8');
    expect(tr).not.toMatch(/'admin\.pushSent': 'Gönderildi/);
    const panel = readFileSync(join(KOK, 'src/components/admin/BildirimGonder.tsx'), 'utf8');
    expect(panel).toContain('useAdminBildirimSonuc');
    const hook = readFileSync(join(KOK, 'src/hooks/useAdmin.ts'), 'utf8');
    expect(hook).toContain("rpc('admin_bildirim_sonuc'");
  });
});
