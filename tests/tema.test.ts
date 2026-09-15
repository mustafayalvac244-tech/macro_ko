import { describe, expect, it } from 'vitest';
import { digerTema, koyuTemaMi, temaEsi, themeMetas, palettes, type ThemeId } from '../src/theme/palettes';

/**
 * HIZLI TEMA DÜĞMESİNİN KARARI.
 *
 * Üst çubuktaki düğme iki yönlü: koyu temadaysan beyaza, açık temadaysan
 * koyuya geçer. Karar `themeMetas`taki `statusBar` alanından TÜRETİLİYOR,
 * elle tutulan bir "koyu temalar" listesinden değil.
 *
 * NEDEN ÖNEMLİ: altıncı bir tema eklendiği gün elle tutulan liste sessizce
 * eksik kalır ve düğme o temada "hiçbir şey yapmıyor" gibi görünür —
 * kullanıcı düğmenin bozuk olduğunu sanır, oysa yalnız bir dizi
 * güncellenmemiştir. Aşağıdaki ilk test bunu imkânsız kılıyor: yeni tema
 * eklenince kendiliğinden kapsama giriyor.
 */

const HEPSI: ThemeId[] = themeMetas.map((m) => m.id);

describe('tema düğmesi', () => {
  it('her tema için bir sonraki tema tanımlı ve KENDİSİ DEĞİL', () => {
    // Kendine dönen bir tema, basınca hiçbir şey olmaması demek.
    for (const id of HEPSI) {
      const sonraki = digerTema(id);
      expect(HEPSI, id).toContain(sonraki);
      expect(sonraki, id).not.toBe(id);
    }
  });

  it('düğme HER ZAMAN karşı moda geçirir (koyu ↔ açık)', () => {
    // Eski test "koyudaysan mutlaka light'a git" diyordu ve bu, eşi olan
    // temalar eklenince YANLIŞ bir kuralı koruyordu. Asıl şart daha basit ve
    // daha güçlü: gidilen tema, bulunduğunun TERSİ modda olmalı.
    for (const id of HEPSI) {
      expect(koyuTemaMi(digerTema(id)), id).toBe(!koyuTemaMi(id));
    }
  });

  it('EŞİ OLAN TEMA KENDİ ÇİFTİNDE KALIR — temayı terk etmez', () => {
    // GERÇEK HATA (15.09.2026, ürün sahibi bildirdi): "terminal gece gündüze
    // tıklayınca gidiyor, başka moda yazı moduna geçiyor." Terminal koyu
    // sayıldığı için düğme Klasik'e atıyordu; mono yazı da gidiyordu.
    expect(digerTema('terminal')).toBe('terminal-light');
    expect(digerTema('terminal-light')).toBe('terminal');
    expect(temaEsi('terminal')).toBe('terminal-light');
  });

  it('iki basışta başlangıç noktasına dönülür', () => {
    // Kullanıcı yanlışlıkla bastıysa aynı düğmeyle geri alabilmeli.
    // Eşi TANIMLI olan her tema bunu sağlamak zorunda.
    for (const meta of themeMetas) {
      if (!meta.esi) continue;
      expect(digerTema(digerTema(meta.id)), meta.id).toBe(meta.id);
    }
    expect(digerTema(digerTema('light'))).toBe('light');
    expect(digerTema(digerTema('dark'))).toBe('dark');
  });

  it('tanımlı her eş GERÇEKTEN karşı modda', () => {
    // Eşi yanlış yazmak (koyu temanın eşi yine koyu) düğmeyi sessizce
    // işlevsiz yapar: basarsın, ikon değişmez, hiçbir şey olmaz.
    for (const meta of themeMetas) {
      if (!meta.esi) continue;
      expect(koyuTemaMi(meta.esi), `${meta.id} → ${meta.esi}`).toBe(!koyuTemaMi(meta.id));
    }
  });

  it('koyu sayılan temaların zemini GERÇEKTEN koyu', () => {
    // `statusBar` alanı elle doldurulan bir alan; yanlış doldurulursa düğme
    // ters çalışır ve kimse kodu okumadan anlamaz. Zeminin parlaklığını
    // ölçerek alanın doğruluğunu bağımsız biçimde denetliyoruz.
    const parlaklik = (hex: string) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    };
    for (const id of HEPSI) {
      const zemin = palettes[id].bg;
      expect(parlaklik(zemin) < 0.5, `${id} · ${zemin}`).toBe(koyuTemaMi(id));
    }
  });

  it('beyaz ve koyu temaların ikisi de tanımlı', () => {
    // Düğmenin iki ucu; biri silinirse düğme yarısı çalışmayan bir kontrol olur.
    expect(HEPSI).toContain('light');
    expect(HEPSI).toContain('dark');
  });
});
