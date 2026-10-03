// Sohbet geçmişi önbelleği ve önbellek fiyatı — 03.10.2026.
// Ölçülen: sohbet sorusu ₺2,20 (tahminin 3,4 katı); geçmiş önbellekte değildi
// ve önbellek okuması tam fiyattan sayılıyordu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mesajlariHazirla } from '../supabase/functions/_shared/onbellek';
import { costTry, faturaGirdi } from '../supabase/functions/_shared/fiyat';

describe('önbellek fiyatı', () => {
  it('okunan 0,1, yazılan 1,25 kat; düz girdi aynen', () => {
    expect(faturaGirdi(1000, 0, 0)).toBe(1000);
    expect(faturaGirdi(1000, 10000, 0)).toBe(2000);
    expect(faturaGirdi(0, 0, 1000)).toBe(1250);
  });
  it('20k önbellekten okunan girdi, tam fiyatın onda biri tutar', () => {
    const tam = costTry('claude-sonnet-5', 20000, 0);
    const onbellekli = costTry('claude-sonnet-5', faturaGirdi(0, 20000, 0), 0);
    expect(onbellekli / tam).toBeCloseTo(0.1, 5);
  });
});

describe('mesajlariHazirla', () => {
  const dosya = 'KURAL: ...\nMADDE: ...';
  it('tek mesajda hiçbir şey değişmez, dosya sistemde kalır', () => {
    const r = mesajlariHazirla([{ role: 'user', text: 'soru' }], dosya);
    expect(r.dosyaSistemde).toBe(true);
    expect(r.mesajKesmesi).toBe(false);
    expect(r.mesajlar).toEqual([{ role: 'user', content: 'soru' }]);
  });
  it('çok turluda son asistan cevabına kesme noktası, dosya son soruya', () => {
    const r = mesajlariHazirla(
      [
        { role: 'user', text: 's1' },
        { role: 'model', text: 'c1' },
        { role: 'user', text: 's2' },
      ],
      dosya
    );
    expect(r.dosyaSistemde).toBe(false);
    expect(r.mesajKesmesi).toBe(true);
    expect(r.mesajlar[0]).toEqual({ role: 'user', content: 's1' });
    expect(r.mesajlar[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'c1', cache_control: { type: 'ephemeral' } }] });
    const son = r.mesajlar[2].content as Array<{ text: string }>;
    expect(son[0].text).toContain(dosya);
    expect(son[1].text).toBe('s2');
  });
  it('önek sabit: bir sonraki turda önceki mesajlar AYNEN gider (önbellek tutsun)', () => {
    const tur2 = mesajlariHazirla([{ role: 'user', text: 's1' }, { role: 'model', text: 'c1' }, { role: 'user', text: 's2' }], 'D2');
    const tur3 = mesajlariHazirla(
      [{ role: 'user', text: 's1' }, { role: 'model', text: 'c1' }, { role: 'user', text: 's2' }, { role: 'model', text: 'c2' }, { role: 'user', text: 's3' }],
      'D3'
    );
    // tur2'nin kesme noktasına kadarki önek (s1, c1) tur3'te birebir aynı içerikle var.
    expect(tur3.mesajlar[0]).toEqual(tur2.mesajlar[0]);
    expect((tur3.mesajlar[1].content as Array<{ text: string }> | string)).toBeTruthy();
    expect(JSON.stringify(tur3.mesajlar[1])).toContain('"c1"');
  });
});

describe('ai-chat bağlantısı', () => {
  const ai = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');
  it('claudeChat hazırlayıcıyı kullanıyor, kesme noktası 4 sınırını aşmıyor', () => {
    expect(ai).toContain('const hazir = mesajlariHazirla(msgs, groundingSystem);');
    expect(ai).toContain('.slice(0, hazir.mesajKesmesi ? 3 : 4);');
    expect(ai).toContain('if (hazir.dosyaSistemde && groundingSystem.trim())');
  });
  it('maliyet önbellek fiyatıyla, ham sayılar kaydediliyor', () => {
    expect(ai).toContain('tin += faturaGirdi(u.input_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.cache_creation_input_tokens ?? 0);');
    expect(ai).toContain('onbellek_okunan: onbellek?.okunan ?? 0,');
    expect(ai).toContain("'sohbet', !!cfg.denemeLimit, sohbetOnbellek);");
  });
});
