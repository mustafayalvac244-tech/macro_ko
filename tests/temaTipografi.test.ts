import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { themeMetas } from '../src/theme/palettes';
import {
  fonts,
  kose,
  radius,
  spacing,
  temaTokenlari,
  temaTokenlariniUygula,
  typography,
  monoTemaMi,
} from '../src/theme/tokens';

const KOK = join(__dirname, '..');

/**
 * TEMAYA BAĞLI ÖLÇÜ TOKEN'LARI (15.09.2026).
 *
 * Terminal teması eklendiğinde önce yalnız PALET eklendi ve ürün sahibi haklı
 * olarak "neden sadece renkleri kullandın" dedi: seçtiği tasarımı Terminal
 * yapan şeyin yarısı tek aralıklı yazı ve yoğunluktu. Bunun üzerine yazı tipi,
 * boyut, boşluk ve köşe de temaya bağlandı.
 *
 * Mekanizma kırılgan olabilir, o yüzden burada ÜÇ AYRI ŞEY korunuyor:
 *  1. Eski beş tema hiç değişmedi (bu iş bir yenileme değil, bir EKLEME'ydi).
 *  2. Terminal gerçekten mono.
 *  3. Mekanizmanın kendisi: nesne KİMLİĞİ sabit kalmalı ve hiçbir dosya
 *     token'ları donuk (modül düzeyi) bir StyleSheet'e gömmemeli.
 */

// Token'lar süreç genelinde paylaşıldığı için her testten sonra varsayılana dön.
function varsayilanaDon() {
  temaTokenlariniUygula('light');
}

describe('tema token setleri', () => {
  it('Terminal DIŞINDAKİ beş tema eski değerlerin BİREBİR aynısı', () => {
    // Eski sabitler (git geçmişinden alındı, elle yazıldı). Bu iş yeni bir
    // tema EKLEMEKti; mevcut temalarda tek bir piksel oynamamalı.
    const ESKI_BOSLUK = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };
    const ESKI_KOSE = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
    const ESKI_YAZI = {
      regular: 'Manrope_400Regular',
      medium: 'Manrope_500Medium',
      semibold: 'Manrope_600SemiBold',
      bold: 'Manrope_700Bold',
      extrabold: 'Manrope_800ExtraBold',
      script: 'DancingScript_700Bold',
    };
    const ESKI_BOYUT = {
      display: 30, h1: 24, h2: 20, h3: 17,
      body: 15, bodyMedium: 15, caption: 13, small: 11,
    };

    // Terminal AİLESİ (koyu + açık) bu karşılaştırmanın dışında: ikisi de
    // bilerek mono ve yoğun. Ailenin tamamını dışlamak şart — yalnız 'terminal'
    // dışlansaydı Terminal Açık eklendiğinde test onu "eski değerlerde olmalı"
    // diye kovalar, doğru çalışan bir temayı hatalı gösterirdi.
    for (const meta of themeMetas) {
      if (meta.id.startsWith('terminal')) continue;
      const t = temaTokenlari(meta.id);
      expect(t.spacing, meta.id).toEqual(ESKI_BOSLUK);
      expect(t.radius, meta.id).toEqual(ESKI_KOSE);
      expect(t.fonts, meta.id).toEqual(ESKI_YAZI);
      for (const [k, boyut] of Object.entries(ESKI_BOYUT)) {
        expect(t.typography[k as keyof typeof t.typography].fontSize, `${meta.id}.${k}`).toBe(boyut);
      }
    }
  });

  it('Terminal teması TEK ARALIKLI yazı kullanıyor', () => {
    const t = temaTokenlari('terminal');
    for (const agirlik of ['regular', 'medium', 'semibold', 'bold', 'extrabold'] as const) {
      expect(t.fonts[agirlik], agirlik).toMatch(/^JetBrainsMono_/);
    }
    for (const k of Object.keys(t.typography) as (keyof typeof t.typography)[]) {
      expect(String(t.typography[k].fontFamily), k).toMatch(/^JetBrainsMono_/);
    }
  });

  it('MARKA YAZISI hiçbir temada mono olmuyor', () => {
    // "Vekil Pro" el yazısı logosu markanın kendisi; tek aralıklı olursa
    // açılış perdesi ve yan menü başlığı bambaşka bir ürün gibi görünür.
    for (const meta of themeMetas) {
      expect(temaTokenlari(meta.id).fonts.script, meta.id).toBe('DancingScript_700Bold');
    }
  });

  it('Terminal DAHA YOĞUN — boşluk ve yazı boyutu küçülüyor', () => {
    // Maketin tezi "aynı ekrana iki katı satır"dı. Mono karakter başına daha
    // GENİŞ olduğu için, boyut küçültülmeseydi tasarım seyrekleşirdi —
    // yani bu test yönün doğru olduğunu koruyor, sadece "farklı" olduğunu değil.
    const varsayilan = temaTokenlari('light');
    const term = temaTokenlari('terminal');
    for (const k of Object.keys(varsayilan.spacing) as (keyof typeof varsayilan.spacing)[]) {
      expect(term.spacing[k], `spacing.${k}`).toBeLessThan(varsayilan.spacing[k]);
    }
    for (const k of Object.keys(varsayilan.typography) as (keyof typeof varsayilan.typography)[]) {
      expect(term.typography[k].fontSize!, `typography.${k}`).toBeLessThan(varsayilan.typography[k].fontSize!);
    }
  });

  it('Terminal DÜZ — köşeler küçülüyor (pill hariç)', () => {
    const term = temaTokenlari('terminal');
    for (const k of ['sm', 'md', 'lg', 'xl'] as const) {
      expect(term.radius[k], `radius.${k}`).toBeLessThan(temaTokenlari('light').radius[k]);
    }
    // pill gerçekten yuvarlak olması gereken yerlerde (avatar, anahtar) kullanılıyor.
    expect(term.radius.pill).toBe(999);
  });
});

describe('canlı token mekanizması', () => {
  it('uygulama NESNEYİ DEĞİŞTİRMİYOR, İÇERİĞİNİ tazeliyor', () => {
    // Mekanizmanın kalbi bu. 94 dosya bu nesneleri modül düzeyinde import
    // edip render anında okuyor; yeni bir nesne atansaydı ellerindeki eski
    // referans hiç güncellenmezdi ve tema yarım uygulanırdı.
    const bosluk = spacing;
    const koseSeti = radius; // `kose` ADINI KULLANMA: aynı isimli fonksiyon import edilmiş durumda.
    const yazi = fonts;
    const tipo = typography;
    temaTokenlariniUygula('terminal');
    expect(spacing).toBe(bosluk);
    expect(radius).toBe(koseSeti);
    expect(fonts).toBe(yazi);
    expect(typography).toBe(tipo);
    expect(spacing.md).toBe(12);
    expect(fonts.regular).toBe('JetBrainsMono_400Regular');
    varsayilanaDon();
    expect(spacing.md).toBe(16);
    expect(fonts.regular).toBe('Manrope_400Regular');
  });

  it('monoTemaMi bayrağı temayla birlikte dönüyor', () => {
    temaTokenlariniUygula('terminal');
    expect(monoTemaMi()).toBe(true);
    temaTokenlariniUygula('obsidian');
    expect(monoTemaMi()).toBe(false);
    varsayilanaDon();
  });

  it('temaTokenlari YAN ETKİSİZ — aktif temayı değiştirmiyor', () => {
    varsayilanaDon();
    temaTokenlari('terminal');
    expect(fonts.regular).toBe('Manrope_400Regular');
    expect(monoTemaMi()).toBe(false);
  });

  it('kose() Terminal DIŞINDA birebir girdiyi döndürüyor', () => {
    // Bu, 69 dosyalık mekanik dönüşümün güvencesi: `borderRadius: 12` yerine
    // `borderRadius: kose(12)` yazıldı. Beş temada fonksiyon hiçbir şey
    // yapmazsa dönüşüm tanım gereği görünmezdir.
    varsayilanaDon();
    for (const px of [0, 2, 3, 6, 8, 9, 10, 12, 14, 16, 20, 24, 999]) {
      expect(kose(px), `light/${px}`).toBe(px);
    }
    temaTokenlariniUygula('obsidian');
    for (const px of [10, 12, 14, 20]) expect(kose(px), `obsidian/${px}`).toBe(px);
    varsayilanaDon();
  });

  it('kose() Terminal\'de yuvarlağı kırpıyor ama GERÇEK DAİREYE dokunmuyor', () => {
    temaTokenlariniUygula('terminal');
    expect(kose(12)).toBe(4);
    expect(kose(20)).toBe(4);
    expect(kose(3)).toBe(3);   // zaten düz olan büyütülmüyor
    expect(kose(999)).toBe(999); // avatar / durum noktası daire kalmalı
    varsayilanaDon();
  });

  it('SABİT köşe yarıçapı kalmadı — hepsi kose() üzerinden', () => {
    // Bir sonraki oturum `borderRadius: 12` yazarsa o köşe Terminal temasında
    // yuvarlak kalır ve ekran yamalı görünür. 999 ve üstü serbest: orası
    // "gerçekten daire" demek.
    const suclular: string[] = [];
    for (const dosya of tsxDosyalari()) {
      const kaynak = readFileSync(dosya, 'utf8');
      for (const m of kaynak.matchAll(/\b(border(?:TopLeft|TopRight|BottomLeft|BottomRight|Top|Bottom|Start|End)?Radius): (\d+)\b/g)) {
        if (Number(m[2]) < 999) suclular.push(`${dosya.slice(KOK.length + 1)} → ${m[0]}`);
      }
    }
    expect(suclular).toEqual([]);
  });

  it('HİÇBİR ekran token\'ları DONUK bir StyleSheet\'e gömmüyor', () => {
    // GERÇEK TUZAK: `const styles = StyleSheet.create({...})` modül düzeyinde
    // BİR KEZ çalışır. İçinde typography/fonts/radius/spacing geçiyorsa o
    // dosya uygulama açılışındaki temada DONAR — kullanıcı Terminal'e
    // geçtiğinde ekranın geri kalanı mono olur, o dosya Manrope kalır.
    // 15.09.2026'da tam olarak 8 dosya böyleydi; hepsi fabrikaya çevrildi.
    const suclular: string[] = [];
    for (const dosya of tsxDosyalari()) {
      const kaynak = readFileSync(dosya, 'utf8');
      if (!/^const styles = StyleSheet\.create\(/m.test(kaynak)) continue;
      if (/\b(typography|radius|spacing)\.|fonts\./.test(kaynak)) {
        suclular.push(dosya.slice(KOK.length + 1));
      }
    }
    expect(suclular).toEqual([]);
  });
});

function tsxDosyalari(): string[] {
  const cikti: string[] = [];
  const gez = (dizin: string) => {
    for (const ad of readdirSync(dizin)) {
      if (ad === 'node_modules' || ad.startsWith('.')) continue;
      const yol = join(dizin, ad);
      if (statSync(yol).isDirectory()) gez(yol);
      else if (ad.endsWith('.tsx')) cikti.push(yol);
    }
  };
  gez(join(KOK, 'app'));
  gez(join(KOK, 'src'));
  return cikti;
}
