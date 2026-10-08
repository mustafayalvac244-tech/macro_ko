import { describe, expect, it } from 'vitest';
import { aiHataMetni } from '@/lib/aiHata';
import { tr } from '@/i18n/tr';

// 08.10.2026: sunucu tarafı arızalar ve tanınmayan kodlar "İnternet
// bağlantınızı kontrol edin" diyordu; sohbet ekranı ise deneme hakkı bitti
// dahil her şeyi bu mesaja çeviriyordu. Yanlış sebep, en kötü hata mesajıdır.
const t = (k: string) => (tr as Record<string, string>)[k] ?? k;
const internet = tr['ai.errGeneric'];

describe('yapay zekâ hata mesajı gerçek sebebi söyler', () => {
  it('internet yalnız sunucuya hiç ulaşılamadığında suçlanır', () => {
    expect(aiHataMetni({}, t)).toBe(internet);
    expect(aiHataMetni({ error: 'generic' }, t)).toBe(internet);
  });

  it('sunucu arızası, boş cevap, oturum ve bilinmeyen kod internet DEMEZ', () => {
    for (const kod of ['upstream', 'empty', 'unauthorized', 'tamamlanamadi', 'bad_request']) {
      expect(aiHataMetni({ error: kod }, t), kod).not.toBe(internet);
    }
    expect(aiHataMetni({ error: 'upstream' }, t)).toBe(tr['ai.errServis']);
    expect(aiHataMetni({ error: 'empty' }, t)).toBe(tr['ai.errBos']);
  });

  it('deneme hakkı bitti mesajı paketi "sınırsız" diye anlatmaz (750 soru + taşma kotası var)', () => {
    expect(aiHataMetni({ error: 'deneme_hakki_bitti' }, t)).not.toMatch(/sınırsız/i);
  });
});
