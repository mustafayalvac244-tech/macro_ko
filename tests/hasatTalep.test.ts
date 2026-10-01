// Hasat talebi (0162) — "sorulan konulara yoğunlaş" ama SORU METNİ SAKLANMADAN.
//
// Korunan iki şey:
//  1. Sayaç tablosu yalnız konu/gün/kaynak/adet tutar. Buraya bir metin ya da
//     kullanıcı sütunu eklenirse avukatın sorusu (müvekkil sırrı) veritabanına
//     yazılmaya başlar — aydınlatma metni bunu söylemiyor.
//  2. Sayaç fonksiyonunu yalnız sunucu (service_role) çağırabilir; kullanıcı
//     çağırabilseydi önceliği istediği konuya şişirebilirdi.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const goc = readFileSync(join(__dirname, '..', 'supabase/migrations/0162_hasat_talep_onceligi.sql'), 'utf8');

describe('hasat talebi (0162)', () => {
  it('sayaç tablosunda yalnız konu/gün/kaynak/adet var', () => {
    const govde = goc.slice(goc.indexOf('create table if not exists public.hasat_konu_talep ('));
    const tanim = govde.slice(0, govde.indexOf(');'));
    const sutunlar = tanim.split('\n').slice(1).map((s) => s.trim().split(/\s+/)[0]).filter((s) => s && s !== 'primary');
    expect(sutunlar).toEqual(['terim', 'gun', 'kaynak', 'adet']);
  });

  it('sayaç fonksiyonu kullanıcıya kapalı', () => {
    expect(goc).toContain('revoke execute on function public.hasat_talep_kaydet(text, text) from public, anon, authenticated;');
    expect(goc).not.toMatch(/grant execute on function public\.hasat_talep_kaydet\(text, text\) to [^;]*authenticated/);
  });
});
