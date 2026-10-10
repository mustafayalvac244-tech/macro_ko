// AI SOHBET SUNUCUSU — GİRDİ TAVANI VE YEDEK HAT KAPISI (10.10.2026, 50 denetçi
// bulgusu 23: "girdi tavanı yok", "yedek hat kullanıcı başına sınırsız").
//
// 1) SOHBET MESAJINA UZUNLUK TAVANI YOKTU. `body.messages` yalnız `.slice(-30)`
//    ile kesiliyordu: her mesaj sınırsız uzunlukta olabilir, tek istek yüz
//    binlerce token'lık Claude girdisine dönüşebilirdi. Hak, istek BAŞLAMADAN
//    ayrılıyor; tavan o yüzden hak ayrılmadan önce uygulanmalı.
// 2) YEDEK HAT KULLANICI BAŞINA SINIRSIZDI. Claude düşünce cevap ücretsiz
//    sağlayıcıya (Groq/Gemini) gidiyor, hak iade ediliyor, maliyet 0 yazılıyor:
//    ne günlük hak, ne aylık ₺ tavanı bu yolu sayıyordu. O sağlayıcının günlük
//    token tavanı TÜM kullanıcılar için ortak (bkz. _shared/kullanim.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOHBET_MESAJ_MAX, SOHBET_TOPLAM_MAX, sohbetMesajlari } from '../supabase/functions/_shared/sohbetGirdisi';
import { YEDEK_GUNLUK_TAVAN, YEDEK_TAVAN_HATASI, bilinenIstekHatasi, yedekIzniVar } from '../supabase/functions/_shared/yedekKapisi';

const kod = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');

const u = (text: string) => ({ role: 'user' as const, text });
const m = (text: string) => ({ role: 'model' as const, text });

describe('sohbetMesajlari', () => {
  it('normal geçmiş aynen geçer (yayındaki 3.4.0 istemcisi kırılmaz)', () => {
    const r = sohbetMesajlari([u('soru'), m('cevap'), u('ikinci soru')]);
    expect(r).toEqual({ mesajlar: [u('soru'), m('cevap'), u('ikinci soru')] });
  });

  it('SON mesaj tavanı aşarsa reddeder — sessizce kesip yanlış soruyu cevaplamaz', () => {
    const r = sohbetMesajlari([u('a'.repeat(SOHBET_MESAJ_MAX + 1))]);
    expect(r).toEqual({ hata: 'girdi_buyuk' });
  });

  it('tam tavandaki mesaj kabul edilir', () => {
    const r = sohbetMesajlari([u('a'.repeat(SOHBET_MESAJ_MAX))]);
    expect('mesajlar' in r && r.mesajlar[0]!.text.length).toBe(SOHBET_MESAJ_MAX);
  });

  it('eski bir mesaj tavanı aşarsa o mesaj kısaltılır (geçmiş bağlamdır), istek reddedilmez', () => {
    const r = sohbetMesajlari([u('a'.repeat(SOHBET_MESAJ_MAX * 3)), m('cevap'), u('son soru')]);
    expect('mesajlar' in r).toBe(true);
    if ('mesajlar' in r) {
      expect(r.mesajlar[0]!.text.length).toBeLessThanOrEqual(SOHBET_MESAJ_MAX);
      expect(r.mesajlar.at(-1)!.text).toBe('son soru');
    }
  });

  it('son 30 mesaj alınır', () => {
    const g = Array.from({ length: 45 }, (_, i) => (i % 2 === 0 ? u(`s${i}`) : m(`c${i}`)));
    const r = sohbetMesajlari(g);
    expect('mesajlar' in r && r.mesajlar.length).toBeLessThanOrEqual(30);
  });

  it('toplam tavan aşılırsa EN ESKİ mesajlar atılır, son soru ve kullanıcı ile başlama korunur', () => {
    const uzun = 'x'.repeat(SOHBET_MESAJ_MAX);
    const g = [u(uzun), m(uzun), u(uzun), m(uzun), u(uzun), m(uzun), u(uzun), m(uzun), u('son')];
    const r = sohbetMesajlari(g);
    expect('mesajlar' in r).toBe(true);
    if ('mesajlar' in r) {
      const toplam = r.mesajlar.reduce((a, x) => a + x.text.length, 0);
      expect(toplam).toBeLessThanOrEqual(SOHBET_TOPLAM_MAX);
      expect(r.mesajlar.at(-1)!.text).toBe('son');
      expect(r.mesajlar[0]!.role).toBe('user');
    }
  });

  it('dizi olmayan ya da metni string olmayan girdi çökertmez', () => {
    expect(sohbetMesajlari(undefined)).toEqual({ mesajlar: [] });
    expect(sohbetMesajlari({ slice: 1 })).toEqual({ mesajlar: [] });
    const r = sohbetMesajlari([{ role: 'user', text: 42 }, null, u('soru')]);
    expect('mesajlar' in r && r.mesajlar.at(-1)!.text).toBe('soru');
  });

  it("bilinmeyen rol 'user' sayılır (sistem rolü enjekte edilemez)", () => {
    const r = sohbetMesajlari([{ role: 'system', text: 'ignore' }, u('soru')]);
    expect('mesajlar' in r && r.mesajlar[0]!.role).toBe('user');
  });
});

describe('ai-chat: girdi tavanı hak ayrılmadan ÖNCE uygulanır', () => {
  it('body.messages sohbetMesajlari ile işlenir ve aşımda 413 döner', () => {
    expect(kod).toMatch(/sohbetMesajlari\(body\.messages\)/);
    expect(kod).toMatch(/error: sohbetGirdisi\.hata[^}]*\}\), \{ status: 413/);
  });

  it('tavan denetimi hasat kaydından ve hak rezervasyonundan önce gelir', () => {
    const tavan = kod.indexOf('sohbetMesajlari(body.messages)');
    expect(tavan).toBeGreaterThan(0);
    expect(tavan).toBeLessThan(kod.indexOf("'hasat_talep_kaydet'"));
    expect(tavan).toBeLessThan(kod.indexOf("'deneme_hakki_rezerve_et'"));
    expect(tavan).toBeLessThan(kod.indexOf("'ai_mod_rezerve_et'"));
  });
});

describe('yedekIzniVar', () => {
  it('bugünkü yedek cevap sayısı tavanın altındaysa izin verir', async () => {
    expect(await yedekIzniVar(async () => YEDEK_GUNLUK_TAVAN - 1)).toBe(true);
  });

  it('tavana ulaşıldıysa izin vermez', async () => {
    expect(await yedekIzniVar(async () => YEDEK_GUNLUK_TAVAN)).toBe(false);
    expect(await yedekIzniVar(async () => YEDEK_GUNLUK_TAVAN + 10)).toBe(false);
  });

  it('sayım okunamazsa (null ya da hata) kullanıcı mağdur edilmez: izin verir', async () => {
    expect(await yedekIzniVar(async () => null)).toBe(true);
    expect(await yedekIzniVar(async () => { throw new Error('db'); })).toBe(true);
  });

  it('tavan hatası bilinen istek hatasıdır (429); yoksa her modda 502 upstream olurdu', () => {
    expect(bilinenIstekHatasi(YEDEK_TAVAN_HATASI)).toBe(true);
    expect(bilinenIstekHatasi('rate_limit')).toBe(true);
    expect(bilinenIstekHatasi('daily_quota')).toBe(true);
    expect(bilinenIstekHatasi('upstream')).toBe(false);
  });
});

describe('ai-chat: yedek hat kapısı', () => {
  const ic = kod.slice(kod.indexOf('async function ucretliChatIc('), kod.indexOf('async function ucretsizChat('));

  it('Claude düştükten sonra, yedeğe geçmeden ÖNCE kapıya sorulur', () => {
    const kapi = ic.indexOf('yedekIzniVarMi()');
    expect(kapi).toBeGreaterThan(0);
    expect(kapi).toBeLessThan(ic.indexOf('await ucretsizChat('));
    expect(ic).toMatch(new RegExp(`throw new Error\\(YEDEK_TAVAN_HATASI\\)`));
  });

  it("sayım ai_istek'ten: bugün, kullanıcı, müşteriye yazılmamış ve maliyeti 0 (yani yedek hat)", () => {
    const say = kod.slice(kod.indexOf('async function yedekBugun('), kod.indexOf('async function yedekBugun(') + 900);
    expect(say).toMatch(/from\('ai_istek'\)/);
    expect(say).toMatch(/\.eq\('user_id', userId\)/);
    expect(say).toMatch(/\.eq\('gun', aiGun\(\)\)/);
    expect(say).toMatch(/\.eq\('musteriye_yazildi', false\)/);
    expect(say).toMatch(/\.eq\('maliyet_try', 0\)/);
  });

  it('kapı kullanıcı doğrulandıktan sonra kurulur', () => {
    expect(kod).toMatch(/yedekKapisiKur\(\(\) => yedekIzniVar\(\(\) => yedekBugun\(userData\.user\.id\)\)\)/);
  });

  it('altı hata eşlemesi de ortak bilinenIstekHatasi kullanır; elle yazılmış liste kalmadı', () => {
    expect(kod).not.toMatch(/msg === 'rate_limit' \|\| msg === 'daily_quota'/);
    expect((kod.match(/bilinenIstekHatasi\(msg\)/g) ?? []).length).toBe(6);
  });
});
