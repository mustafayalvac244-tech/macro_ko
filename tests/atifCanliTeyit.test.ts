// Canlı künye teyidi — 03.10.2026.
//
// OLAY: gerçek kullanıcı dilekçeye içtihat istedi; model iki künye yazdı, ikisi
// de havuzda yoktu; avukat aynı künyeyi İçtihat Arama'da da bulamadı (arama
// o sırada 6 kez 502 verdi). Bu test üç şeyi korur:
//  1. Havuzda olmayan künye CANLI kaynakta aranıyor ve üç sonuç ayrı tutuluyor
//     (doğrulandı-uyap / canlıda yok / ulaşılamadı → havuzda yok).
//  2. "Canlıda yok" künye, dilekçe/mütalaa/belgede hakkı düşürmeyen kusurlu
//     çıktı sayılıyor ve ekranda kırmızı gösteriliyor (tr + en).
//  3. Künye araması Emsal düşünce Bedesten'le devam ediyor; 502 sebebi loglanıyor.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kunyeNormalize } from '../supabase/functions/_shared/kunyeBicim';
import { kararAtiflari } from '../supabase/functions/_shared/kararAtif';

const KOK = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(KOK, p), 'utf8');
const aiChat = oku('supabase/functions/ai-chat/index.ts');
const ictihat = oku('supabase/functions/ictihat/index.ts');

describe('canlı künye teyidi', () => {
  it('künye biçimi iki tarafta aynı (öndeki sıfır ve boşluk atılır)', () => {
    expect(kunyeNormalize('2019/01234')).toBe('2019/1234');
    expect(kunyeNormalize(' 2019 / 1234 ')).toBe('2019/1234');
    expect(kunyeNormalize('')).toBe('');
  });

  it('denetim sonucu canlidaYok alanı taşıyor ve kaynağı ayırıyor', () => {
    expect(aiChat).toMatch(/canlidaYok: string\[\];/);
    expect(aiChat).toMatch(/kaynak\?: 'havuz' \| 'uyap'/);
    expect(aiChat).toContain('canliKunyeDogrula(esas, karar, atifDaireAnahtari(a))');
    expect(aiChat).toMatch(/if \(r === null\) return;[\s\S]*kaynak: 'uyap'[\s\S]*canlidaYok\.push/);
    // 08.10.2026: aday seçimi canliTeyideUygun'a taşındı (kullanıcının kendi
    // künyesi ve ilk derece bağlamı muaf; bkz. tests/kunyeKaynakMuafiyet.test.ts).
    expect(aiChat).toContain('canliTeyideUygun(metin, a, kaynak)');
  });

  it('canlıda olmayan künye dilekçe, mütalaa ve belgede hak düşürmez', () => {
    const n = (aiChat.match(/\(kararDenetimi\?\.canlidaYok\.length \?\? 0\) > 0/g) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('dilekçe ve mütalaa istemi dosyada olmayan künyeyi yasaklıyor', () => {
    expect(aiChat).toContain('yalnız aşağıdaki DOSYADA listelenen kararlara');
    expect(aiChat).toContain('[emsal karar: İçtihat Arama ekranından ekleyin]');
    expect(aiChat).toContain('[emsal karar: İçtihat Arama ile ekleyin]');
  });

  it('ölçüm sayaçları göçte ve kayıtta var', () => {
    const goc = oku('supabase/migrations/0167_atif_canli_teyit.sql');
    expect(goc).toContain('canli_dogrulanan');
    expect(goc).toContain('canlida_yok');
    expect(aiChat).toContain('canlida_yok: kararDenetimi?.canlidaYok.length ?? 0');
  });

  it('uydurma künye METİNDEN ÇIKARILIR, beş modda da (ürün sahibi: "kullanıcıya yazılamaz")', () => {
    // Çıkarma: canlıda yok + olanaksız; havuzdaYok (ulaşılamadı) kalır.
    expect(aiChat).toMatch(/const hamlar = \[\.\.\.d\.canlidaYok, \.\.\.d\.olanaksiz\.map/);
    expect((aiChat.match(/uydurmaKunyeleriCikar\(/g) ?? []).length).toBe(6); // tanım + 5 mod (04.10.2026: yapay zekâyla düzelt)
    // ZEKİCE: çıkarılan künyenin cümlesi için gerçek karar aranır ve ÖNERİ olarak
    // döner; metne sokulmaz (modelin okumadığı karar dilekçeye girmez).
    expect(aiChat).toMatch(/async function gercekKararOner\(cumle: string\)/);
    expect(aiChat).toContain("s.rpc('search_ictihat_fts', { q: cumle, match_count: 2 })");
    expect(aiChat).toContain('if (oneriler.length) d.oneriler = oneriler;');
    // İçtihat istenmişse dosyaya daha çok gerçek karar girer.
    expect(aiChat).toContain('ictihatIstenmis(promptQuestion) ? 5 : 3');
    // Çıkarılan metin yanıta gidiyor (orijinal değil).
    expect(aiChat).toContain('text: sonMetin.trim(), tier, model: kullanim.model, issues,');
    expect(aiChat).toContain('text: sonMetin.trim(), tier, model: kullanilanModel, istekId,');
    // Çıkarma, boşluk/biçim farkına dayanıklı konum tabanlı yardımcıyla yapılır
    // (eski split(ham) satır sonlu künyeyi bulamıyor, ekran yine "çıkarıldı" diyordu).
    expect(aiChat).toContain('kunyeleriDegistir(m, [ham], KUNYE_YER_TUTUCU)');
    // 22. ajan (10.10.2026): bu döngü eskiden BOŞTU — önekli yazılışta kararAtiflari
    // hiç atıf döndürmüyor, hiçbir şey denetlenmiyordu. Önce atıf sayısı sınanır.
    const metin = 'Yargıtay 9. HD, E. 2019/1234, K. 2020/5678 sayılı kararı uyarınca';
    const atiflar = kararAtiflari(metin);
    expect(atiflar).toHaveLength(1);
    for (const a of atiflar) expect(metin).toContain(a.ham);
  });

  it('"doğrulandı" dairesiz olmaz: havuz (göç 0202) ve canlı teyit daireyi karşılaştırır', () => {
    // 22. ajan, 10.10.2026: esas numarası her dairede ayrı işler; numara tutan başka
    // dairenin kararı uydurma "9. HD …" künyesini "doğrulandı" yapıyordu.
    const goc = oku('supabase/migrations/0202_karar_atfi_daire.sql');
    expect(goc).toContain('public.karar_atfi_daire_no(k.daire) = a.daire');
    expect(goc).toContain('revoke all on function public.havuzdaki_kararlar(jsonb) from public, anon, authenticated;');
    const uyap = oku('supabase/functions/_shared/uyapCanli.ts');
    expect(uyap).toContain('daireAnahtarlariUyumlu(daire, x.daire)');
    expect(uyap).toContain('daireFarkli: true');
    // Başka dairede bulunan numara silinmez (uydurma kanıtı değil): sarıda kalır.
    expect(aiChat).toContain('if (r.daireFarkli) return;');
    // Konu sözcüğü olmayan cümle öneri aramasına gitmez.
    expect(aiChat).toContain('!oneriCumlesiYeterli(cumle)');
  });

  it("ekran künyeyi LİSTELEMEZ, yalnız sayı; metinler tr ve en'de", () => {
    const ui = oku('src/components/ui/AtifDenetimi.tsx');
    expect(ui).toContain("t('atif.cikarildiBaslik', { n: String(cikarilan) })");
    expect(ui).not.toContain('veri.canlidaYok!.join');
    expect(ui).not.toMatch(/veri\.olanaksiz\.map/);
    expect(ui).toContain("t('atif.kaynakUyap')");
    expect(ui).toContain("t('atif.oneriBaslik')");
    for (const dil of ['tr', 'en']) {
      const s = oku(`src/i18n/${dil}.ts`);
      for (const k of ['atif.cikarildiBaslik', 'atif.cikarildiNot', 'atif.kaynakUyap', 'atif.oneriBaslik', 'atif.oneriNot']) {
        expect(s, `${dil}: ${k}`).toContain(`'${k}':`);
      }
    }
  });

  it('künye araması Emsal düşünce Bedesten ile sürüyor; 502 sebebi loglanıyor', () => {
    expect(ictihat).toMatch(/emsalDustu = true;[\s\S]*console\.error\('kunye: emsal araması düştü:'/);
    expect(ictihat).toContain("if (emsalDustu && collected.length === 0) throw new Error('source_unreachable');");
    expect(ictihat).toContain("console.error('ictihat 502:'");
  });
});
