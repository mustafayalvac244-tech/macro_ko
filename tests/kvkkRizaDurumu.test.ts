import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rizaDurumu, type RizaSatiri } from '../src/utils/rizaDurumu';

// KVKK RIZA KARTI — OKUMA HATASI "KAYIT YOK" DEĞİLDİR (09.10.2026).
//
// Kart, kvkk_onay sorgusu hata verdiğinde `son`u null yapıyor ve ekrana
// "KAYIT BULUNAMADI. Hesabınız, rıza kaydı tutulmaya başlanmadan önce açılmış
// olabilir..." yazıyordu — yanına da "Rıza kaydı okunamadı." Yani aynı kart
// hem "kayıt yok" diye kesin bir olgu bildiriyor hem okuyamadığını söylüyordu;
// rızası olan kullanıcıya yeniden imzalatma düğmesi gösteriliyordu.
// (once-dusun §6: "Boş liste → kayıt yok | Hata yutulmuştu".)

const verilmis: RizaSatiri = { onay: true, surum: '2026-09-3', verildi_at: '2026-09-20T10:00:00Z' };
const geriAlinmis: RizaSatiri = { onay: false, surum: '2026-09-3', verildi_at: '2026-09-21T10:00:00Z' };

describe('rizaDurumu', () => {
  it('okuma hatasında durum BİLİNMEZ — "kayıt yok" denmez', () => {
    expect(rizaDurumu(null, true)).toBe('okunamadi');
  });

  it('okuma hatasında elde kalan eski satıra da güvenilmez', () => {
    expect(rizaDurumu(verilmis, true)).toBe('okunamadi');
    expect(rizaDurumu(geriAlinmis, true)).toBe('okunamadi');
  });

  it('hata yoksa son satıra göre: var / geri alınmış / kayıt yok', () => {
    expect(rizaDurumu(verilmis, false)).toBe('var');
    expect(rizaDurumu(geriAlinmis, false)).toBe('geri-alindi');
    expect(rizaDurumu(null, false)).toBe('kayit-yok');
  });
});

describe('KvkkRizaKarti durumu yardımcıdan alıyor', () => {
  const kart = readFileSync(join(__dirname, '..', 'src/components/KvkkRizaKarti.tsx'), 'utf8');

  it('kart rizaDurumu kullanıyor ve okunamadı hâlini çiziyor', () => {
    expect(kart).toContain('rizaDurumu(');
    expect(kart).toContain("'okunamadi'");
  });
});
