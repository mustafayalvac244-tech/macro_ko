// App Store vitrin metni — 04.10.2026 (reklam).
// Tanıtım metni (promotionalText) 170 karakteri aşamaz; yayındaki sürüme
// inceleme olmadan yazılır, bu yüzden içindeki her sayı ölçülmüş olmalı.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UCRETSIZ_DENEME_HAKKI } from '../src/config/planlar';

const v = JSON.parse(readFileSync(join(__dirname, '..', 'scripts/asc-vitrin.json'), 'utf8'));

describe('asc-vitrin.json', () => {
  it('tanıtım metni ≤170, boş alan yok, deneme sayısı koddakiyle aynı', () => {
    expect(v.tanitimMetni.length).toBeLessThanOrEqual(170);
    expect(v.tanitimMetni).not.toMatch(/\[[^\]]*\]/);
    expect(v.tanitimMetni).toContain(`${UCRETSIZ_DENEME_HAKKI} ücretsiz`);
  });
  it('anahtar kelimeler ≤100 ve boşluksuz', () => {
    expect(v.anahtarKelimeler.length).toBeLessThanOrEqual(100);
    expect(v.anahtarKelimeler).not.toContain(' ');
  });
  it('açıklama artık "ücretsizde yapay zekâ kapalı" demiyor (28.09\'dan beri 10 soru var)', () => {
    expect(v.aciklama).not.toContain('ücretsiz hesaplarda kapalıdır');
    expect(v.aciklama).toContain(`${UCRETSIZ_DENEME_HAKKI} soruluk deneme`);
  });
  it('utm kaynağı sayaca gidiyor', () => {
    const k = readFileSync(join(__dirname, '..', 'src/lib/kullanim.ts'), 'utf8');
    expect(k).toContain("utm_source");
    expect(k).toMatch(/kullanimKaydet\(`kaynak:/);
    expect(readFileSync(join(__dirname, '..', 'app/_layout.tsx'), 'utf8')).toContain('reklamKaynaginiKaydet();');
  });
});
