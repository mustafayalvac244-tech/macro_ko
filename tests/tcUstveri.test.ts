import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * T.C. KİMLİK NO AUTH ÜSTVERİSİNDE KALMAZ (09.10.2026 denetimi).
 *
 * Kayıt formu TC'yi signUp'ın options.data'sıyla gönderiyor (e-posta
 * doğrulaması açıkken oturum olmadığı için bilinçli yol, bkz. 0086).
 * handle_new_user onu profiles.tc_no'ya kopyalıyordu ama
 * auth.users.raw_user_meta_data'dan SİLMİYORDU. Supabase user_metadata'yı
 * kullanıcının erişim jetonuna koyar; TC her istekle şifresiz (base64) ve
 * cihazdaki oturum kaydında dolaşıyordu.
 *
 * Bu test, handle_new_user'ı EN SON tanımlayan göçün temizliği yaptığını ve
 * 0086'nın doğrulamalarını koruduğunu denetler.
 */
const GOC = join(__dirname, '..', 'supabase', 'migrations');
const dosyalar = readdirSync(GOC).filter((f) => f.endsWith('.sql')).sort();
const tanimlayanlar = dosyalar.filter((f) =>
  /create\s+or\s+replace\s+function\s+public\.handle_new_user\s*\(/i.test(readFileSync(join(GOC, f), 'utf8')),
);
const sonDosya = tanimlayanlar[tanimlayanlar.length - 1]!;
const son = readFileSync(join(GOC, sonDosya), 'utf8');
const govde = son.slice(son.search(/function\s+public\.handle_new_user/i), son.indexOf('$$;') + 3);

describe('handle_new_user — TC üstveride kalmaz', () => {
  it('en son tanım TC\'yi profile yazdıktan sonra üstveriden siler', () => {
    expect(govde, sonDosya).toMatch(/update\s+auth\.users\s+set\s+raw_user_meta_data\s*=\s*raw_user_meta_data\s*-\s*'tc_no'/i);
    // Silme, profil satırı yazıldıktan SONRA olmalı (önce silinirse TC kaybolur).
    expect(govde.search(/insert\s+into\s+public\.profiles/i)).toBeGreaterThan(-1);
    expect(govde.search(/insert\s+into\s+public\.profiles/i)).toBeLessThan(govde.search(/update\s+auth\.users/i));
  });

  it('0086\'nın doğrulamaları ve alanları korunur', () => {
    expect(govde).toMatch(/'\^\[0-9\]\{11\}\$'/); // TC yalnız 11 hane rakamsa
    expect(govde).toMatch(/insert into public\.profiles \(id, email, full_name, firm_name, tc_no, baro, bar_number\)/);
    expect(govde).toMatch(/security definer/i);
    // is_premium / is_admin üstveriden ASLA okunmaz (0076/0086 koruması).
    expect(govde).not.toMatch(/is_premium|is_admin|ai_tier/);
  });

  it('var olan kayıtlardaki kopya da temizlenir; profiles.tc_no\'ya dokunulmaz', () => {
    expect(son).toMatch(/update\s+auth\.users\s+set\s+raw_user_meta_data\s*=\s*raw_user_meta_data\s*-\s*'tc_no'\s+where\s+raw_user_meta_data\s*\?\s*'tc_no'/i);
    expect(son).not.toMatch(/update\s+public\.profiles/i);
  });

  it('tetikleyici gövdesi istemciye kapalı kalır (0079 kilidi)', () => {
    expect(son).toMatch(/revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/i);
  });
});
