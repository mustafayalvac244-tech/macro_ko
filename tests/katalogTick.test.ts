import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { katalogYaz, type KatalogSatiri } from '../supabase/functions/_shared/katalogYazma';

// 10.10.2026 denetimi, katalog-tick bulguları:
//  5. ictihat_katalog yazması düşse de pencere ilerletiliyordu → o sayfaların
//     künyeleri bir daha çekilmiyordu (pencere "sonraki sayfa"ya geçmişti).
//  7. Dış fetch'lerde zaman aşımı yoktu (askıda kalan istek havuz işçisini tutar).
//  8. Açık pencere yokken 404 "pencere_yok" dönüyor, izlemede HATA sayılıyordu.

type Cagri = { tablo: string; satirlar: unknown[]; secenek: unknown };

/** supabase-js'nin yalnız .from(t).upsert(rows, opts) yüzeyi. */
function sahteSupabase(yanitlar: Record<string, { error: { message: string } | null; count?: number | null }>) {
  const cagrilar: Cagri[] = [];
  const supabase = {
    from(tablo: string) {
      return {
        upsert: async (satirlar: unknown[], secenek: unknown) => {
          cagrilar.push({ tablo, satirlar, secenek });
          return yanitlar[tablo] ?? { error: null, count: null };
        },
      };
    },
  };
  return { supabase, cagrilar };
}

const kayit = (id: string): KatalogSatiri => ({
  id,
  tur: 'YARGITAYKARARI',
  daire: 'Yargıtay 3. Hukuk Dairesi',
  esas_yil: 2024,
  esas_sira: 1,
  karar_yil: 2024,
  karar_sira: 2,
  karar_tarihi: '2024-03-05',
});
const pencere = [{ tur: 'YARGITAYKARARI', gun: '2024-03-05', bitis: '2024-03-05', sonraki_sayfa: 2, bitti: false, toplam: 100 }];

describe('katalogYaz — künye yazılamadıysa pencere ilerlemez', () => {
  it('ictihat_katalog upsert düşerse pencere durumu YAZILMAZ ve not döner', async () => {
    const { supabase, cagrilar } = sahteSupabase({ ictihat_katalog: { error: { message: 'statement timeout' } } });
    const r = await katalogYaz(supabase, [kayit('a'), kayit('b')], pencere);
    expect(cagrilar.map((c) => c.tablo)).toEqual(['ictihat_katalog']);
    expect(r.yazilan).toBe(0);
    expect(r.pencereYazildi).toBe(false);
    expect(r.not).toMatch(/^upsert: statement timeout/);
  });

  it('künyeler yazıldıysa pencere durumu da yazılır; sayı sunucunun count değeri', async () => {
    const { supabase, cagrilar } = sahteSupabase({ ictihat_katalog: { error: null, count: 1 } });
    const r = await katalogYaz(supabase, [kayit('a'), kayit('b')], pencere);
    expect(cagrilar.map((c) => c.tablo)).toEqual(['ictihat_katalog', 'ictihat_katalog_pencere']);
    expect(cagrilar[1].satirlar).toEqual(pencere);
    expect(r).toEqual({ yazilan: 1, pencereYazildi: true });
  });

  it('aynı id iki kez gelirse tekilleştirilir (yinelenen anahtar tüm yazmayı düşürürdü)', async () => {
    const { supabase, cagrilar } = sahteSupabase({});
    await katalogYaz(supabase, [kayit('a'), kayit('a'), kayit('b')], pencere);
    expect(cagrilar[0].satirlar).toHaveLength(2);
    expect(cagrilar[0].secenek).toMatchObject({ onConflict: 'id', ignoreDuplicates: true });
  });

  it('hiç satır gelmediyse (boş sayfa: pencere bitti) katalog yazılmaz ama pencere yazılır', async () => {
    const { supabase, cagrilar } = sahteSupabase({});
    const r = await katalogYaz(supabase, [], pencere);
    expect(cagrilar.map((c) => c.tablo)).toEqual(['ictihat_katalog_pencere']);
    expect(r).toEqual({ yazilan: 0, pencereYazildi: true });
  });

  it('pencere durumu yazılamazsa sessiz kalmaz: not döner (künyeler yazılmıştı)', async () => {
    const { supabase } = sahteSupabase({ ictihat_katalog_pencere: { error: { message: 'deadlock' } } });
    const r = await katalogYaz(supabase, [kayit('a')], pencere);
    expect(r.not).toMatch(/^pencere: deadlock/);
    expect(r.pencereYazildi).toBe(false);
    expect(r.yazilan).toBe(1);
  });
});

describe('uç işlev kaynak korumaları', () => {
  const oku = (yol: string) => readFileSync(new URL(`../supabase/functions/${yol}`, import.meta.url), 'utf-8');

  it('katalog-tick ve harvest-tick: her dış fetch zaman aşımı taşır', () => {
    for (const yol of ['katalog-tick/index.ts', 'harvest-tick/index.ts']) {
      const src = oku(yol);
      const yerler = [...src.matchAll(/\bfetch\(/g)].map((m) => m.index ?? 0);
      expect(yerler.length, yol).toBeGreaterThan(0);
      for (const i of yerler) {
        // Çağrının seçenek nesnesi 700 karakteri aşmaz.
        expect(src.slice(i, i + 700), `${yol} @${i}`).toMatch(/signal:\s*AbortSignal\.timeout\(/);
      }
    }
  });

  it('katalog-tick: açık pencere yokken 404 değil 200 + bosta:true döner', () => {
    const src = oku('katalog-tick/index.ts');
    expect(src).not.toMatch(/error:\s*'pencere_yok'/);
    expect(src).toMatch(/bosta:\s*true/);
  });
});
