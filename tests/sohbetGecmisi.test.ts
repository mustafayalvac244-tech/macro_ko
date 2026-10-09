import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gonderilecekGecmis } from '../src/utils/sohbetGecmisi';

// Sohbet geçmişi eskiden tek, genel bir AsyncStorage anahtarındaydı ve çıkışta
// silinmiyordu: aynı cihaza giren ikinci hesap birincinin müvekkil sorularını
// görüyordu. Bu dosya o kusurun geri gelmesini engeller.
const kok = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(kok, p), 'utf8');

describe('sohbet geçmişi hesaba bağlı ve çıkışta silinir', () => {
  it('kanca genel anahtarı doğrudan kullanmaz', () => {
    const kanca = oku('src/hooks/useAiChat.ts');
    expect(kanca).not.toMatch(/AsyncStorage\.(get|set)Item/);
    expect(kanca).toMatch(/sohbetleriOku\(userId\)/);
  });

  it('anahtar kullanıcı kimliğini taşır', () => {
    expect(oku('src/lib/sohbetDeposu.ts')).toMatch(/conversations\.v3:\$\{userId\}/);
  });

  it('çıkış, hesap silme ve sunucudan düşen oturum geçmişi siler', () => {
    const auth = oku('src/store/authStore.ts');
    expect((auth.match(/sohbetGecmisiniSil\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(auth).toMatch(/event === 'SIGNED_OUT'/);
    expect(auth).toMatch(/scope: 'local'/);
  });
});

describe('gonderilecekGecmis', () => {
  it('ilk mesaj her zaman kullanıcının, en çok 30 mesaj', () => {
    const g = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model' }));
    const k = gonderilecekGecmis(g);
    expect(k.length).toBeLessThanOrEqual(30);
    expect(k[0]!.role).toBe('user');
    const tek = gonderilecekGecmis([{ role: 'user' as const }]);
    expect(tek).toHaveLength(1);
  });
});
