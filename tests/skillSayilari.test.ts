import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SKILL'LERDEKİ SAYILAR ESKİMESİN — bekçi test.
 *
 * NEDEN VAR (ölçüldü 22.09.2026). `.claude/skills/` altındaki dosyalar
 * "ölçülerek yazıldı" diye başlıyor ve içlerinde depodan sayılmış sabitler
 * taşıyorlar. Denetlendiğinde bir kısmı eskimişti:
 *
 *   supabase-goc  "130 göç"                 → gerçek 149
 *   rn-ui-kit     "104 StyleSheet dosyası"  → gerçek 106
 *   rn-ui-kit     "24 ui/ bileşeni"         → gerçek 25
 *   rn-ui-kit     "120 .tsx / 67'si >150"   → gerçek 121 / 68
 *   rn-ui-kit     "70 dosyanın 6'sında a11y"→ gerçek 82 / 7
 *
 * Tek başına küçük sapmalar. Ama bu, `olcum` skill'inin kendi uyardığı
 * "eskimiş sabit" tuzağının ta kendisi: bir ölçüm dosyasındaki eski sayıya
 * bakıp ürün sahibine "9 gün" demek — doğrusu 76'ydı. Skill otorite taşır;
 * yanlış sayı, sayı olmamasından kötüdür.
 *
 * NE YAPAR: skill metnindeki sayıyı ayrıştırır, depoyu yeniden sayar,
 * kıyaslar. NE YAPMAZ: skill'i düzeltmez — düşerse sayıyı İNSAN (ya da
 * ölçen oturum) günceller, çünkü sayının ne anlama geldiğine karar vermek
 * testin işi değil.
 *
 * TOLERANS — neden sıfır değil. Her yeni ekranda düşen bir test kapatılır,
 * o da bizi korumasız bırakır. Bu yüzden: 20'nin altındaki sayılarda ±2,
 * üstünde ±%10 serbest. "130 → 149" (+%15) bu bantla YAKALANIRDI.
 * Kategorik iddialar ("0 dosya kullanıyor") ise tam eşleşmelidir: 0'dan
 * 1'e çıkmak, kuralın kendisinin yanlışlanmasıdır.
 */

const KOK = join(__dirname, '..');
const oku = (...y: string[]) => readFileSync(join(KOK, ...y), 'utf8');

/** Bir klasörü özyineli gezip uzantıya uyan dosyaları döndürür. */
function dosyalar(dizin: string, uzanti: string[]): string[] {
  const cikti: string[] = [];
  const gez = (d: string) => {
    for (const ad of readdirSync(d)) {
      const tam = join(d, ad);
      if (statSync(tam).isDirectory()) gez(tam);
      else if (uzanti.some((u) => ad.endsWith(u))) cikti.push(tam);
    }
  };
  gez(dizin);
  return cikti;
}

/** Kaç dosyada bu kalıp geçiyor. */
function gecenDosyaSayisi(liste: string[], kalip: RegExp): number {
  return liste.filter((f) => kalip.test(readFileSync(f, 'utf8'))).length;
}

/** Metinden `**123**` biçimindeki sayıyı, verilen bağlam kalıbıyla çeker. */
function metindekiSayi(metin: string, kalip: RegExp): number {
  const e = metin.match(kalip);
  if (!e) throw new Error(`Skill metninde beklenen cümle bulunamadı: ${kalip}`);
  return Number(e[1].replace(/\./g, ''));
}

function yakinMi(yazan: number, gercek: number): boolean {
  const pay = yazan < 20 ? 2 : Math.ceil(yazan * 0.1);
  return Math.abs(yazan - gercek) <= pay;
}

const uiKit = oku('.claude/skills/rn-ui-kit/SKILL.md');
const goc = oku('.claude/skills/supabase-goc/SKILL.md');
const agents = oku('AGENTS.md');

const tsxHepsi = [...dosyalar(join(KOK, 'app'), ['.tsx']), ...dosyalar(join(KOK, 'src'), ['.tsx'])];
const tsHepsi = [...tsxHepsi, ...dosyalar(join(KOK, 'src'), ['.ts'])];

describe('skill dosyalarındaki sayılar depoyla uyumlu', () => {
  it('supabase-goc: göç sayısı', () => {
    const yazan = metindekiSayi(goc, /altında bugün \*\*(\d+) göç\*\*/);
    const gercek = readdirSync(join(KOK, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).length;
    expect(yakinMi(yazan, gercek), `skill: ${yazan} göç · gerçek: ${gercek}`).toBe(true);
  });

  it('rn-ui-kit: ui/ bileşen sayısı', () => {
    const yazan = metindekiSayi(uiKit, /Bugün \*\*(\d+) bileşen\*\* var/);
    const gercek = readdirSync(join(KOK, 'src/components/ui')).filter((f) => f.endsWith('.tsx')).length;
    expect(yakinMi(yazan, gercek), `skill: ${yazan} bileşen · gerçek: ${gercek}`).toBe(true);
  });

  it('rn-ui-kit: StyleSheet.create kullanan dosya sayısı', () => {
    const yazan = metindekiSayi(uiKit, /\*\*(\d+) dosya `StyleSheet\.create`/);
    const gercek = gecenDosyaSayisi(tsHepsi, /StyleSheet\.create/);
    expect(yakinMi(yazan, gercek), `skill: ${yazan} · gerçek: ${gercek}`).toBe(true);
  });

  it('rn-ui-kit: ekran sayısı', () => {
    const yazan = metindekiSayi(uiKit, /\*\*(\d+) ekran\.\*\*/);
    const gercek = dosyalar(join(KOK, 'app'), ['.tsx']).length;
    expect(yakinMi(yazan, gercek), `skill: ${yazan} ekran · gerçek: ${gercek}`).toBe(true);
  });

  // KATEGORİK — tolerans yok. Bu satırlar "kurmaya kalkma" kuralının dayanağı;
  // biri kullanılmaya başlandıysa kural artık doğru değildir.
  it('rn-ui-kit: kullanılmıyor denen kütüphaneler gerçekten kullanılmıyor', () => {
    expect(gecenDosyaSayisi(tsHepsi, /from '(expo-image)'/), 'expo-image').toBe(0);
    expect(gecenDosyaSayisi(tsHepsi, /react-native-reanimated/), 'reanimated').toBe(0);
    expect(gecenDosyaSayisi(tsHepsi, /className=/), 'NativeWind').toBe(0);
  });
});

describe('AGENTS.md skill bölümü', () => {
  it('sayılan skill adedi .claude/skills/ ile aynı', () => {
    const sozcuk: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6 };
    const e = agents.match(/`\.claude\/skills\/` altında ([^\s]+) skill var/);
    if (!e) throw new Error('AGENTS.md: skill sayısı cümlesi bulunamadı');
    const yazan = sozcuk[e[1].toLowerCase()] ?? Number(e[1]);
    const gercek = readdirSync(join(KOK, '.claude/skills'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).length;
    expect(yazan, `AGENTS.md: ${e[1]} · gerçek: ${gercek}`).toBe(gercek);
  });

  it('dışarıdan gelen tehlikeli skill uyarısı duruyor', () => {
    expect(agents).toMatch(/anthropic-skills:rn-ui-kit/);
    expect(agents).toMatch(/claude-api/);
  });
});
