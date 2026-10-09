import { describe, expect, it } from 'vitest';
import { canliTeyideUygun, kararAtiflari, kaynaktaGeciyor, yerelMahkemeBaglami } from '../supabase/functions/_shared/kararAtif';

// 08.10.2026: avukatın kendi ilk derece künyesi Yargıtay'da aranıp "uydurma"
// diye metinden siliniyordu. Canlıda aranıp silinebilecek künye artık yalnız:
// Yargıtay ya da mahkemesi yazılmamış + kullanıcının metninde yok + önünde
// ilk derece/istinaf mahkemesi adı yok.
const ilk = (m: string) => kararAtiflari(m)[0]!;

describe('künye canlı teyit — avukatın kendi künyesi silinmez', () => {
  it('ilk derece mahkemesi bağlamındaki künye canlıda aranmaz', () => {
    const metin = "Ankara 5. Asliye Hukuk Mahkemesi'nin 2025/123 E., 2025/456 K. sayılı kararına karşı istinaf...";
    const a = ilk(metin);
    expect(a).toBeTruthy();
    expect(yerelMahkemeBaglami(metin, a)).toBe(true);
    expect(canliTeyideUygun(metin, a)).toBe(false);
  });

  it('kullanıcının verdiği metinde geçen numara canlıda aranmaz', () => {
    const metin = 'Dosyanın 2024/77 E., 2025/12 K. sayılı kararı usul ve yasaya aykırıdır.';
    const a = ilk(metin);
    expect(kaynaktaGeciyor(a, 'Esas No: 2024 / 77 — Karar No: 2025/12')).toBe(true);
    expect(canliTeyideUygun(metin, a, 'Esas No: 2024 / 77')).toBe(false);
  });

  it('kaynakta yalnız benzer numara varsa muaf değil (2024/770 ≠ 2024/77)', () => {
    const metin = 'Yargıtay 9. HD 2024/77 E., 2025/12 K.';
    expect(kaynaktaGeciyor(ilk(metin), 'dosya 2024/770 ve 12025/12')).toBe(false);
  });

  it('Yargıtay künyesi kullanıcı metninde yoksa canlıda aranır (uydurma yakalama sürer)', () => {
    const metin = 'Yargıtay 9. Hukuk Dairesi 2021/5000 E., 2022/300 K. sayılı kararında...';
    expect(canliTeyideUygun(metin, ilk(metin), 'işçi kıdem tazminatı alamadı')).toBe(true);
  });

  it('Danıştay/BAM künyesi Yargıtay aramasına gitmez', () => {
    const metin = 'Danıştay 5. Daire 2021/500 E., 2022/300 K.';
    const a = ilk(metin);
    if (a.mahkeme) expect(canliTeyideUygun(metin, a)).toBe(false);
  });
});
