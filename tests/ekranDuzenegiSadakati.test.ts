import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KOK = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(KOK, p), 'utf8');

/**
 * EKRAN ÇEKME DÜZENEĞİ GERÇEĞE SADIK MI?
 *
 * `scripts/magaza-ekranlari.mjs` bütün Supabase isteklerini yakalayıp sahte
 * cevap döndürüyor. Bu düzeneğin çıktısı iki yerde kullanılıyor: Google Play
 * mağaza görselleri ve tasarım incelemesi. İkisi de "ekran gerçekte böyle
 * görünüyor" iddiası taşıyor.
 *
 * ── GERÇEKTEN OLAN HATA (15.09.2026) ────────────────────────────────────
 * Taklit veride duruşma/süre kayıtlarının dava ilişkisi `cases` diye
 * yazılmıştı. Gerçek sorgular ise TAKMA AD veriyor:
 *     '*, case:cases(id, title, case_number)'
 * yani uygulamaya alan `case` olarak geliyor. Sonuç: ekran görüntülerinde
 * dosya adının çıkması gereken her yer sessizce "—" çiziyordu. Hata ekranda
 * değil DÜZENEKTEYDİ — yani düzenek bana çalışan bir ekranı bozuk gösteriyordu.
 * Ters yönü daha tehlikeli: düzenek bozuk bir ekranı çalışıyor gösterebilir.
 *
 * Bu test, sorgudaki takma adı OKUYUP taklitle karşılaştırıyor. Sorgu
 * değişirse (ör. takma ad kaldırılırsa) test düşer ve düzenek de güncellenir.
 */
describe('ekran çekme düzeneği — taklit veri gerçek sorguyla uyuşuyor', () => {
  const duzenek = oku('scripts/magaza-ekranlari.mjs');

  /** `'*, case:cases(...)'` içinden `case` takma adını çıkarır. */
  function iliskiAdi(kancaYolu: string): string {
    const kaynak = oku(kancaYolu);
    const m = kaynak.match(/'\*,\s*([A-Za-z_]+):cases\(/);
    expect(m, `${kancaYolu} içinde '*, <ad>:cases(...)' kalıbı bulunamadı`).toBeTruthy();
    return m![1]!;
  }

  it('duruşma kaydının dava alanı, sorgudaki takma adla aynı', () => {
    const ad = iliskiAdi('src/hooks/useHearings.ts');
    // Taklitteki duruşma satırları bu alanı taşımalı.
    expect(duzenek, `duruşma taklidinde '${ad}:' alanı yok`).toContain(`${ad}: { id: 'd1'`);
  });

  it('süre kaydının dava alanı, sorgudaki takma adla aynı', () => {
    const ad = iliskiAdi('src/hooks/useDeadlines.ts');
    expect(duzenek, `süre taklidinde '${ad}:' alanı yok`).toContain(`${ad}: { id: 'd3'`);
  });

  it('YANLIŞ alan adı (çoğul `cases:`) taklitte kalmamış', () => {
    // Asıl hata buydu; geri gelirse ekran görüntüleri yine sessizce yanlış olur.
    expect(duzenek).not.toContain('cases: {');
  });

  it('finans tablosunun adı gerçek koddaki adla aynı', () => {
    // Düzeneğin kendi yorumunda "öğrenilmiş tuzak" olarak yazılı; kod
    // tarafında da doğrulanıyor ki yorum ile gerçek ayrışmasın.
    const kanca = oku('src/hooks/useFinance.ts');
    const m = kanca.match(/from\('([a-z_]+)'\)/);
    expect(m).toBeTruthy();
    expect(duzenek).toContain(`${m![1]}:`);
  });

  it('profil RPC ile geliyor — düzenek de RPC taklit ediyor', () => {
    // Yalnız `profiles` tablosunu taklit etmek "İyi günler, Avukat" yazdırıyor:
    // isim gelmiyor ve ekran görüntüsü ürünü olduğundan kötü gösteriyor.
    expect(oku('src/store/authStore.ts')).toContain("rpc('my_profile')");
    expect(duzenek).toContain('/rest/v1/rpc/my_profile');
  });
});
