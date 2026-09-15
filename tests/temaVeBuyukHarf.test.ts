import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { palettes, themeMetas, type ThemeColors, type ThemeId } from '../src/theme/palettes';
import { buyukHarf } from '../src/lib/buyukHarf';

const KOK = join(__dirname, '..');

/**
 * KAYNAĞI YORUMSUZ OKU.
 *
 * Bu testler "şu kalıp kodda GEÇMESİN" diye bakıyor. İlk hâli düz metin
 * arıyordu ve KENDİ AÇIKLAMA YORUMLARIMA takıldı: düzeltmeyi anlatan yorum
 * ("Burada 'SIRADAKI' yazılıydı") aranan kalıbı birebir içeriyordu, yani
 * hatayı açıklamak testi düşürüyordu. Test kodu denetlemeli, düzyazıyı değil.
 */
function oku(p: string): string {
  return readFileSync(join(KOK, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * TEMA EKLEME SIRASINDA YARIM KALAN İŞİ YAKALA.
 *
 * 15.09.2026'da altıncı tema (Terminal) eklendi. Bir tema ÜÇ yere birden
 * yazılmak zorunda: `ThemeId` birleşimi, `palettes` nesnesi ve `themeMetas`
 * dizisi. TypeScript ilk ikisini zorluyor (Record<ThemeId, …> eksik anahtara
 * izin vermez) ama `themeMetas` sıradan bir dizi — oraya yazmayı unutmak
 * derlemeyi bozmaz, tema yalnızca Ayarlar'daki seçicide GÖRÜNMEZ olur.
 * Sessiz arıza tam olarak budur: kod doğru, ekran eksik.
 */
describe('tema bütünlüğü', () => {
  const metaIdler = themeMetas.map((m) => m.id);
  const paletIdler = Object.keys(palettes) as ThemeId[];

  it('her paletin bir meta kaydı var (seçicide görünür)', () => {
    for (const id of paletIdler) expect(metaIdler, id).toContain(id);
  });

  it('her meta kaydının bir paleti var', () => {
    for (const id of metaIdler) expect(palettes[id], id).toBeTruthy();
  });

  it('meta listesinde tekrar eden tema yok', () => {
    expect(new Set(metaIdler).size).toBe(metaIdler.length);
  });

  it('her tema aynı renk anahtarlarının HEPSİNİ dolduruyor', () => {
    // Eksik bir anahtar ekranda `undefined` renk demek: RN'de o öğe
    // şeffaf/siyah çizilir ve yalnız o temada bozuk görünür.
    const anahtarlar = Object.keys(palettes.light) as (keyof ThemeColors)[];
    for (const id of paletIdler) {
      for (const a of anahtarlar) {
        expect(palettes[id][a], `${id}.${String(a)}`).toBeTruthy();
      }
    }
  });

  it('ana yazı rengi zeminde OKUNABİLİR (WCAG AA, 4.5:1)', () => {
    // Yeni bir tema "güzel göründüğü" için eklenip okunamaz çıkabilir.
    // Bu ölçüm gözden bağımsız: aynı renkler her koşuda aynı sonucu verir.
    for (const id of paletIdler) {
      const oran = kontrast(palettes[id].textPrimary, palettes[id].bg);
      expect(oran, `${id}: ${palettes[id].textPrimary} / ${palettes[id].bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renkli düğme üstündeki yazı (textInverse / primary) okunabilir', () => {
    // Birincil düğme: zemin `primary`, yazı `textInverse`. Terminal temasında
    // parlak yeşil zemine açık yazı konsaydı düğme okunmaz olurdu.
    for (const id of paletIdler) {
      const oran = kontrast(palettes[id].textInverse, palettes[id].primary);
      expect(oran, `${id}: ${palettes[id].textInverse} / ${palettes[id].primary}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('kaydedilmiş tema doğrulaması ELLE TUTULAN LİSTE DEĞİL', () => {
    // GERÇEK HATA, 15.09.2026: themeStore.hydrateTheme içinde
    //   saved === 'light' || saved === 'dark' || ... || saved === 'obsidian'
    // yazıyordu. Altıncı tema eklendiğinde bu listeye yazılmasa, kullanıcı
    // Terminal'i seçip uygulamayı kapattığında sessizce Klasik'e dönerdi —
    // hata yok, sadece "kaydetmiyor". Liste artık themeMetas'tan türetiliyor.
    const kaynak = oku('src/theme/themeStore.ts');
    expect(kaynak).toContain('themeMetas');
    for (const id of metaIdler) {
      expect(kaynak, `themeStore içinde '${id}' elle yazılmış`).not.toContain(`=== '${id}'`);
    }
  });
});

/**
 * TÜRKÇE BÜYÜK HARF.
 *
 * CSS `text-transform: uppercase` ve düz `toUpperCase()` dil bilmez:
 * "i" → "I" yapar, "İ" değil. Bu hata projede ÜÇ KEZ ayrı ayrı canlıya çıktı
 * (pano "AKTIF DOSYA", dava listesi "KRITIK", yan menü "ARAÇLAR VE YÖNETIM").
 * İngilizce arayüzde Türkçe kuralını uygulamak ise ters yönde aynı hatadır.
 */
describe('buyukHarf', () => {
  it('Türkçe: i → İ', () => {
    expect(buyukHarf('Kritik', 'tr')).toBe('KRİTİK');
    expect(buyukHarf('Dilekçe türü', 'tr')).toBe('DİLEKÇE TÜRÜ');
    expect(buyukHarf('Araçlar ve Yönetim', 'tr')).toBe('ARAÇLAR VE YÖNETİM');
  });

  it('Türkçe: ı → I (zaten noktasız olan bozulmuyor)', () => {
    expect(buyukHarf('Sıradaki', 'tr')).toBe('SIRADAKİ');
    expect(buyukHarf('sınırsız', 'tr')).toBe('SINIRSIZ');
  });

  it('İngilizce: i → I (Türkçe kuralı uygulanmıyor)', () => {
    expect(buyukHarf('critical', 'en')).toBe('CRITICAL');
    expect(buyukHarf('Tools and Management', 'en')).toBe('TOOLS AND MANAGEMENT');
  });

  it('rozet bileşeni büyütmeyi CSS ile değil JS ile yapıyor', () => {
    // Badge'de `textTransform: 'uppercase'` geri gelirse bu düşer.
    const kaynak = oku('src/components/ui/Badge.tsx');
    expect(kaynak).not.toContain("textTransform: 'uppercase'");
    expect(kaynak).toContain('useBuyukHarf');
  });

  it('i18n içinde büyük yazılmış Türkçe metinler doğru harfi kullanıyor', () => {
    // Bu SINIF hatayı VP_TARA taraması yakalayamaz: metin zaten büyük
    // yazılmıştır, CSS'e hiç uğramaz. 'SIRADAKI' aylarca öyle durdu.
    // Aşağıdaki liste elle doğrulandı; yeni bir büyük metin eklenirse
    // buraya da eklenmeli.
    const kaynak = oku('src/i18n/tr.ts');
    expect(kaynak).toContain("'SIRADAKİ'");
    expect(kaynak).not.toContain("'SIRADAKI'");
  });
});

/** WCAG 2.x göreli parlaklık ve kontrast oranı. */
function kontrast(on: string, arka: string): number {
  const l1 = parlaklik(on);
  const l2 = parlaklik(arka);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parlaklik(hex: string): number {
  const h = hex.replace('#', '');
  const tam = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(tam, 16);
  const kanal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}
