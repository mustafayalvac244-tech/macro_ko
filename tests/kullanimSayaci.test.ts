// Kullanım sayacı — 03.10.2026, bkz. 0165_kullanim_sayac.sql.
//
// Korunan üç şey:
//  1. KİŞİSEL VERİ YOK: tabloda kullanıcı/cihaz kimliği sütunu yok, istemci
//     RPC'ye yalnız olay + platform gönderiyor. Biri "kim girdi" diye
//     user_id eklerse bu bir izleme aracına döner ve aydınlatma metni yanlış
//     olur — test düşer.
//  2. İstemcinin ürettiği her olay adı sunucunun biçimine uyuyor. Uymazsa
//     sunucu SESSİZCE atlar ve sayaç hiç artmaz; bunu ekrandan fark etmek
//     mümkün değil, ancak burada yakalanır.
//  3. Tablo anon/authenticated'a kapalı; özet yalnız yöneticiye.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OLAY_BICIMI, yolSade } from '@/lib/kullanimOlay';

const KOK = join(__dirname, '..');
const oku = (yol: string) => readFileSync(join(KOK, yol), 'utf8');
const goc = oku('supabase/migrations/0165_kullanim_sayac.sql');
const bicim = new RegExp(OLAY_BICIMI);

describe('kullanım sayacı (0165)', () => {
  it('tabloda kişiye bağlanabilecek sütun yok', () => {
    const tablo = goc.slice(goc.indexOf('create table if not exists public.kullanim_sayac'), goc.indexOf(');', goc.indexOf('create table if not exists public.kullanim_sayac')));
    expect(tablo).toContain('olay');
    expect(tablo).not.toMatch(/user|uuid|cihaz|device|ip\b|metin/i);
    const kaydet = goc.slice(goc.indexOf('function public.kullanim_kaydet('), goc.indexOf('$function$;', goc.indexOf('function public.kullanim_kaydet(')));
    expect(kaydet).not.toMatch(/auth\.uid/);
  });

  it('istemci RPC\'ye yalnız olay ve platform gönderiyor', () => {
    const istemci = oku('src/lib/kullanim.ts');
    expect(istemci).toMatch(/rpc\('kullanim_kaydet', \{ p_olay: olay, p_platform: platform \}\)/);
    expect(istemci).not.toMatch(/user|session|auth/i);
  });

  it('sunucu ve istemci aynı olay biçimini kullanıyor', () => {
    expect(goc).toContain(`p_olay !~ '${OLAY_BICIMI}'`);
  });

  it('yol sadeleştirme kimlikleri siliyor ve biçime uyuyor', () => {
    expect(yolSade('/clients/3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab')).toBe('/clients/:id');
    expect(yolSade('/cases/123/edit')).toBe('/cases/:id/edit');
    expect(yolSade('/ictihat?q=kira')).toBe('/ictihat');
    expect(yolSade('')).toBe('/');
    for (const yol of ['/', '/premium', '/clients/42', '/Müvekkil Ekle', '/a'.repeat(100), '/x?y=z&t=1']) {
      expect(`ekran:${yolSade(yol)}`).toMatch(bicim);
    }
  });

  it('koddaki her sabit olay adı biçime uyuyor', () => {
    const dosyalar = ['app/_layout.tsx', 'app/(auth)/signup.tsx', 'app/premium.tsx'];
    let sayi = 0;
    for (const d of dosyalar) {
      for (const m of oku(d).matchAll(/kullanimKaydet\(([`'])(.+?)\1\)/g)) {
        const ad = m[2];
        if (ad.startsWith('ekran:')) continue; // yol yolSade'den geçiyor, yukarıda sınandı
        for (const plan of ['temel', 'ai']) {
          expect(ad.replace('${plan}', plan), `${d}: ${ad}`).toMatch(bicim);
        }
        sayi++;
      }
    }
    // Kayıt + satın almanın 6 adımı. Sayı düşerse bir olay sessizce silinmiştir.
    expect(sayi).toBeGreaterThanOrEqual(7);
  });

  it('tablo anon/authenticated\'a kapalı, özet yalnız yöneticiye', () => {
    expect(goc).toMatch(/alter table public\.kullanim_sayac enable row level security/);
    expect(goc).toMatch(/revoke all on public\.kullanim_sayac from anon, authenticated/);
    expect(goc).toMatch(/function public\.admin_kullanim_ozet[\s\S]*is_admin[\s\S]*raise exception 'not_admin'/);
    expect(goc).toContain('revoke execute on function public.admin_kullanim_ozet(integer) from public, anon;');
  });
});
