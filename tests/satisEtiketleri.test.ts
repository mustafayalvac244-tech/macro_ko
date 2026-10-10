import { describe, expect, it } from 'vitest';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * SATIŞ ETİKETLERİ — yapay zekâ özelliği "Pro"ya bağlanmaz (09.10.2026).
 *
 * ₺399'luk paketin adı "Vekil Pro"; yapay zekâ ayrı paket ("Vekil Pro +
 * Yapay Zekâ"). Hukuki Araştırma ekranındaki rozet "Pro’ya özel" diyordu:
 * okuyan, ₺399'luk paketin bu özelliği açtığını sanır. Sunucu ise mütalaayı
 * yalnız 'ai' katmanına açıyor (ai-chat/index.ts: isMutalaa && tier !== 'ai'
 * → tier_required).
 */
describe('yapay zekâ özelliği "Pro"ya bağlanmaz', () => {
  it('Hukuki Araştırma rozeti Yapay Zekâ paketini söyler (sunucu yalnız ai katmanına açıyor)', () => {
    expect(tr['mut.proOnly']).toContain('YAPAY ZEKÂ');
    expect(tr['mut.proOnly']).not.toMatch(/PRO’YA|PRO'YA/);
    expect(en['mut.proOnly']).toMatch(/\bAI\b/);
  });

  it('rozet büyük harfle çiziliyor: Türkçe metin zaten büyük yazılı (i → İ tuzağı)', () => {
    expect(tr['mut.proOnly']).toBe(tr['mut.proOnly'].toLocaleUpperCase('tr-TR'));
  });
});
