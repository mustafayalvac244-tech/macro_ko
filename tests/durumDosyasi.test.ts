// DURUM.md — geçmişin özetlemeden sağ çıkması (26.09.2026, ürün sahibi kuralı).
//
// Ürün sahibi: "Context window doldukça buna çözüm bul, unutma geçmişi."
// Çözüm DURUM.md'nin CLAUDE.md üzerinden her oturumda yüklenmesi. Bu test
// üç şekilde bozulmasını yakalar: dosya silinir, CLAUDE.md'den bağ kopar,
// ya da dosya şişip her oturumda gereksiz bağlam yakar.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');

describe('DURUM.md', () => {
  it('var ve CLAUDE.md onu yüklüyor', () => {
    expect(existsSync(join(KOK, 'DURUM.md'))).toBe(true);
    const claude = readFileSync(join(KOK, 'CLAUDE.md'), 'utf8');
    expect(claude.split('\n').map((s) => s.trim())).toContain('@DURUM.md');
  });

  it('kısa kalıyor (≤120 satır) — tarihçe KARAR-DEFTERI.md\'ye', () => {
    const satir = readFileSync(join(KOK, 'DURUM.md'), 'utf8').split('\n').length;
    expect(satir, `DURUM.md ${satir} satır; eskiyi KARAR-DEFTERI.md'ye taşı`).toBeLessThanOrEqual(120);
  });

  it('son güncelleme tarihi yazılı', () => {
    expect(readFileSync(join(KOK, 'DURUM.md'), 'utf8')).toMatch(/\*\*Son güncelleme:\*\* \d{2}\.\d{2}\.\d{4}/);
  });
});
