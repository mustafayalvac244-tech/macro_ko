import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { caseStatusColorsFor, palettes, priorityColorsFor } from '@/theme/palettes';
import { kontrastOrani, okunurRenk, zeminUstune } from '@/utils/kontrast';

// 10.10.2026 denetim bulguları (oranlar bu dosyanın yardımcısıyla HESAPLANDI):
//  • pano süre rozeti açık temalarda sabit #D4AF37: kart üstünde 2,10:1,
//    rozet zemini üstünde 1,93:1 (Klasik/Zümrüt/Terminal Açık), Parşömen 1,76:1
//  • textMuted 7 temanın 7'sinde zemin/kart üstünde 4,5:1'in altındaydı
//    (2,59–4,06:1, en kötü Terminal)
//  • durum/öncelik rozet yazıları açık temalarda 2,5–4,4:1
const KOK = join(__dirname, '..');
const TEMALAR = Object.keys(palettes) as Array<keyof typeof palettes>;

describe('tema kontrastı', () => {
  it('textMuted: zemin ve tüm yüzeylerde en az 4,5:1 (7 tema)', () => {
    const dusenler: string[] = [];
    for (const id of TEMALAR) {
      const c = palettes[id];
      for (const yuzey of ['bg', 'surface', 'surfaceAlt', 'bgElevated'] as const) {
        const oran = kontrastOrani(c.textMuted, c[yuzey]) ?? 0;
        if (oran < 4.5) dusenler.push(`${id}: textMuted ${c.textMuted} / ${yuzey} ${c[yuzey]} = ${oran.toFixed(2)}`);
      }
    }
    expect(dusenler).toEqual([]);
  });

  it('textMuted, textSecondary\'den belirgin biçimde zayıf kalır (hiyerarşi bozulmadı)', () => {
    for (const id of TEMALAR) {
      const c = palettes[id];
      const muted = kontrastOrani(c.textMuted, c.surface)!;
      const secondary = kontrastOrani(c.textSecondary, c.surface)!;
      expect(muted, id).toBeLessThan(secondary);
    }
  });

  it('okunurRenk: yeterli rengi AYNEN bırakır, yetersizi 4,5:1\'e taşır', () => {
    const kart = '#FFFFFF';
    expect(okunurRenk('#173C7E', [kart], '#0F1B33')).toBe('#173C7E');
    const altin = '#D4AF37';
    const zemin = zeminUstune(altin + '1F', kart);
    expect(kontrastOrani(altin, zemin)!).toBeLessThan(2); // 1,93:1
    const yeni = okunurRenk(altin, [zemin], '#0F1B33');
    expect(yeni).not.toBe(altin);
    expect(kontrastOrani(yeni, zemin)!).toBeGreaterThanOrEqual(4.5);
  });

  it('okunurRenk: okunamayan renkte girdiyi bozmadan döner', () => {
    expect(okunurRenk('transparent', ['#FFFFFF'], '#000000')).toBe('transparent');
    expect(okunurRenk('#123456', ['#FFFFFF'], 'notacolor')).toBe('#123456');
  });

  it('pano süre rozeti: 3 renk (kırmızı / uyarı-altın / nötr) 7 temada 4,5:1', () => {
    const dusenler: string[] = [];
    for (const id of TEMALAR) {
      const c = palettes[id];
      for (const [ad, renk] of [['danger', c.danger], ['warning', c.warning], ['gold', c.gold], ['textSecondary', c.textSecondary]] as const) {
        const zemin = zeminUstune(renk + '1F', c.surface);
        const yazi = okunurRenk(renk, [zemin], c.textPrimary);
        const oran = kontrastOrani(yazi, zemin)!;
        if (oran < 4.5) dusenler.push(`${id}/${ad}: ${oran.toFixed(2)}`);
      }
    }
    expect(dusenler).toEqual([]);
  });

  it('durum ve öncelik rozetleri: kart VE sayfa üstünde 4,5:1 (7 tema)', () => {
    const dusenler: string[] = [];
    for (const id of TEMALAR) {
      const c = palettes[id];
      const durum = Object.entries(caseStatusColorsFor(c)).map(([ad, p]) => [`durum.${ad}`, p.fg, p.bg] as const);
      const oncelik = Object.entries(priorityColorsFor(c)).map(([ad, fg]) => [`oncelik.${ad}`, fg, `${fg}22`] as const);
      for (const [ad, fg, bg] of [...durum, ...oncelik]) {
        const zeminler = [c.surface, c.bg].map((y) => zeminUstune(bg, y));
        const yazi = okunurRenk(fg, zeminler, c.textPrimary);
        for (const z of zeminler) {
          const oran = kontrastOrani(yazi, z)!;
          if (oran < 4.5) dusenler.push(`${id}/${ad}: ${oran.toFixed(2)}`);
        }
      }
    }
    expect(dusenler).toEqual([]);
  });

  it('Badge ve pano kontrast yardımcısını kullanır; sabit altın hex\'i kalmadı', () => {
    const badge = readFileSync(join(KOK, 'src/components/ui/Badge.tsx'), 'utf8');
    expect(badge).toMatch(/okunurRenk\(/);
    const pano = readFileSync(join(KOK, 'app/(app)/index.tsx'), 'utf8');
    expect(pano).not.toMatch(/#D4AF37/i);
    expect(pano).toMatch(/okunurRenk\(/);
  });
});
