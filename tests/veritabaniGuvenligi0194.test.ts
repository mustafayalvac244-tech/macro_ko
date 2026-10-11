// 0194 — veritabanı güvenliği (RLS / SECURITY DEFINER / grant) denetçi bulguları.
//
// Bu dosya SQL'i çalıştırmaz (çalıştıran: scripts/migration-deneme/calistir.sh
// 0194); göçün metninde ve kodla ilişkisinde şu sözleşmeleri sabitler:
//  1. profiles: başka avukatın profilini herkese açan genel okuma politikası
//     bir daha geri gelmez; yönlendirilmiş (yayında) hiçbir ekran başkasının
//     profilini doğrudan tablodan okumaz.
//  2. search_ictihat_fts: match_count tavanı, uygulamanın kendi en büyük
//     isteğiyle (ictihat ucu: 20) aynı.
//  3. kullanim_kaydet: günlük anahtar sayısı sınırlı (anon çağırabiliyor).
//  4. kvkk_onay: istemci zaman damgasını/kaynağı/türü dilediği gibi yazamaz.
//  5. case_id / client_id taşıyan tablolarda sahip denetimi tetikleyicisi.
//  6. ai_saglayici_durum yalnız yöneticiye; office_members'a rızasız üye yok.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OLAY_BICIMI } from '@/lib/kullanimOlay';

const KOK = join(__dirname, '..');
const oku = (yol: string) => readFileSync(join(KOK, yol), 'utf8');
const GOC_DIZINI = join(KOK, 'supabase/migrations');
const goc = readFileSync(join(GOC_DIZINI, '0194_veritabani_guvenligi.sql'), 'utf8');

/** Yorum satırlarını at: arama yalnız çalışan SQL'e bakar. */
const sql = goc
  .split('\n')
  .filter((s) => !s.trim().startsWith('--'))
  .join('\n');

function dosyalar(dizin: string, uzanti: RegExp, cikar: RegExp = /node_modules|\.expo|dist/): string[] {
  const out: string[] = [];
  for (const ad of readdirSync(dizin)) {
    const tam = join(dizin, ad);
    if (cikar.test(tam)) continue;
    if (statSync(tam).isDirectory()) out.push(...dosyalar(tam, uzanti, cikar));
    else if (uzanti.test(ad)) out.push(tam);
  }
  return out;
}

describe('0194 — profiles genel okuması', () => {
  it('"profiles readable by authenticated" kaldırılıyor ve kendi-okuma korunuyor', () => {
    expect(sql).toMatch(/drop policy if exists "profiles readable by authenticated" on public\.profiles/);
    expect(sql).not.toMatch(/create policy "profiles readable by authenticated"/);
    expect(sql).toContain('profiles are self-readable');
  });

  it('sonraki hiçbir göç genel okuma politikasını yeniden kurmuyor', () => {
    const adlar = readdirSync(GOC_DIZINI).filter((a) => a.endsWith('.sql')).sort();
    let son = '';
    for (const a of adlar) {
      const m = readFileSync(join(GOC_DIZINI, a), 'utf8')
        .split('\n')
        .filter((s) => !s.trim().startsWith('--'))
        .join('\n');
      if (/create policy "profiles readable by authenticated"/.test(m)) son = `create:${a}`;
      if (/drop policy if exists "profiles readable by authenticated"/.test(m)) son = `drop:${a}`;
    }
    expect(son).toBe('drop:0194_veritabani_guvenligi.sql');
  });

  it('başkasının profilini tablodan gömen kod yalnız bekleyen ekranların kancalarında', () => {
    const gomen = dosyalar(join(KOK, 'src'), /\.(ts|tsx)$/)
      .concat(dosyalar(join(KOK, 'app'), /\.(ts|tsx)$/))
      .filter((f) => /:\s*profiles\s*\(|\.from\(['"]profiles['"]\)\s*\.select/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(KOK, f))
      .sort();
    // Bu iki kanca 0194'ten sonra başkalarının profilini OKUYAMAZ (yalnız
    // kendi satırı). Yalnız src/ekranlar-beklemede kullanıyor; oraya geri
    // dönülürken güvenli bir RPC'ye çevrilmeleri gerekir.
    expect(gomen).toEqual(['src/hooks/useDailyQuestion.ts', 'src/hooks/useOffice.ts']);

    const yayinda = dosyalar(join(KOK, 'src'), /\.(ts|tsx)$/)
      .concat(dosyalar(join(KOK, 'app'), /\.(ts|tsx)$/))
      .filter((f) => !relative(KOK, f).startsWith('src/ekranlar-beklemede'))
      .filter((f) => !/src\/hooks\/(useOffice|useDailyQuestion)\.ts$/.test(f));
    const kullananlar = yayinda
      .filter((f) => /hooks\/(useOffice|useDailyQuestion)['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(KOK, f));
    expect(kullananlar).toEqual([]);
  });
});

describe('0194 — search_ictihat_fts', () => {
  it('match_count 1..20 arasına sıkıştırılıyor ve 20, ictihat ucunun kendi tavanı', () => {
    expect(sql).toContain('match_count := least(greatest(coalesce(match_count, 15), 1), 20);');
    expect(oku('supabase/functions/ictihat/index.ts')).toMatch(/Math\.min\(20, Math\.max\(1, Number\(body\.pageSize/);
  });

  it('yetkiler 0172 ile aynı: anon/public yok, authenticated + service_role var', () => {
    expect(sql).toMatch(/revoke all on function public\.search_ictihat_fts\(text, integer\) from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.search_ictihat_fts\(text, integer\) to authenticated, service_role/);
  });

  it('fonksiyon gövdesinin kalanı 0172 ile aynı (yalnız tavan satırı eklendi)', () => {
    const al = (s: string) => {
      const i = s.indexOf('CREATE OR REPLACE FUNCTION public.search_ictihat_fts');
      const a = s.indexOf('$function$', i) + '$function$'.length;
      return s.slice(a, s.indexOf('$function$', a));
    };
    const eski = al(oku('supabase/migrations/0172_ai_bekleme_veritabani.sql'));
    const yeni = al(goc);
    const tavanDisi = yeni
      .split('\n')
      .filter((s) => !s.includes('match_count := least(') && !s.trim().startsWith('-- 0194'))
      .join('\n');
    const eskiSade = eski.split('\n').filter((s) => !s.trim().startsWith('--')).join('\n');
    const yeniSade = tavanDisi.split('\n').filter((s) => !s.trim().startsWith('--')).join('\n');
    expect(yeniSade).toBe(eskiSade);
  });
});

describe('0194 — kullanim_kaydet', () => {
  it('olay biçimi istemci ile aynı ve günlük satır tavanı var', () => {
    expect(sql).toContain(`p_olay !~ '${OLAY_BICIMI}'`);
    expect(sql).toMatch(/select count\(\*\) from public\.kullanim_sayac k where k\.gun = v_gun\) >= 500/);
  });

  it('kişiye bağlanabilecek bir şey eklenmedi (auth.uid yok)', () => {
    const kaydet = sql.slice(sql.indexOf('function public.kullanim_kaydet('), sql.indexOf('$function$;', sql.indexOf('function public.kullanim_kaydet(')));
    expect(kaydet).not.toMatch(/auth\.uid|user_id/);
  });

  it('anon çağrısı korunuyor (giriş/kayıt ekranları oturumsuz)', () => {
    expect(sql).toMatch(/grant execute on function public\.kullanim_kaydet\(text, text\) to anon, authenticated/);
  });
});

describe('0194 — kvkk_onay', () => {
  it('istemci tablo-geneli INSERT yetkisi taşımıyor; zaman damgası ve kimlik sütunları dışarıda', () => {
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.kvkk_onay from authenticated, anon/);
    const m = sql.match(/grant insert \(([^)]*)\) on public\.kvkk_onay to authenticated/);
    expect(m).not.toBeNull();
    const kolonlar = m![1].split(',').map((s) => s.trim());
    expect(kolonlar).toEqual(['user_id', 'tur', 'surum', 'onay', 'kaynak', 'kanit']);
    expect(kolonlar).not.toContain('verildi_at');
    expect(kolonlar).not.toContain('id');
  });

  it('INSERT politikası yalnız uygulamanın yazdığı değerleri kabul ediyor', () => {
    const bas = sql.indexOf('create policy kvkk_onay_kendi_yazar');
    const pol = sql.slice(bas, sql.indexOf(';', bas));
    expect(pol).toContain('auth.uid() = user_id');
    expect(pol).toContain("tur = 'yurtdisi_ai'");
    expect(pol).toContain("kaynak = 'ayarlar'");
    expect(pol).toContain("jsonb_typeof(kanit) = 'object'");
    // İstemcinin gerçekten gönderdikleri bu değerlerle uyumlu kalmalı.
    const kart = oku('src/components/KvkkRizaKarti.tsx');
    expect(kart).toContain("tur: 'yurtdisi_ai'");
    expect(kart).toContain("kaynak: 'ayarlar'");
    expect(kart).not.toContain('verildi_at:');
  });
});

describe('0194 — case_id / client_id sahip denetimi', () => {
  // Canlıda FK ile cases/clients'e bağlı tablolar (08.10 pg_constraint ölçümü).
  // time_entries'in kendi tetikleyicisi var (0131).
  const BEKLENEN: Array<[string, string[]]> = [
    ['case_expenses', ['case_id:cases']],
    ['case_installments', ['case_id:cases']],
    ['cases', ['client_id:clients']],
    ['client_advances', ['client_id:clients']],
    ['client_expenses', ['client_id:clients']],
    ['deadlines', ['case_id:cases']],
    ['documents', ['case_id:cases', 'client_id:clients']],
    ['enforcement_files', ['client_id:clients']],
    ['hearings', ['case_id:cases']],
    ['payment_promises', ['case_id:cases', 'client_id:clients']],
    ['payments', ['case_id:cases']],
    ['powers_of_attorney', ['client_id:clients']],
  ];

  it.each(BEKLENEN)('%s tablosu tetikleyiciye bağlı', (tablo, kolonlar) => {
    const satir = sql.split('\n').find((s) => s.includes(`'${tablo}'`) && s.includes('array['));
    expect(satir, `${tablo} listede yok`).toBeDefined();
    for (const k of kolonlar) expect(satir).toContain(`'${k}'`);
  });

  it('tetikleyici aynı hata kodunu veriyor (varlık sızdırmaz) ve istemciye kapalı', () => {
    expect(sql).toContain("errcode = '23503'");
    expect(sql).toMatch(/revoke all on function public\.fk_sahip_denetimi\(\) from public, anon, authenticated/);
    expect(sql).toMatch(/before insert or update of/);
  });
});

describe('0194 — ai_saglayici_durum ve office_members', () => {
  it('sağlayıcı durumu artık using(true) değil, yalnız yönetici', () => {
    const bas = sql.indexOf('create policy ai_saglayici_durum_read');
    const pol = sql.slice(bas, sql.indexOf(';', bas));
    expect(pol).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(pol).toContain('is_admin');
    expect(pol).toContain('auth.uid()');
  });

  it('ofis üyeliği: kimse başkasını rızasız ekleyemez', () => {
    const bas = sql.indexOf('create policy "office admin insert members"');
    const pol = sql.slice(bas, sql.indexOf(';', bas));
    expect(pol).toContain('user_id = auth.uid()');
    expect(pol).toContain('o.owner_id = auth.uid()');
  });
});
