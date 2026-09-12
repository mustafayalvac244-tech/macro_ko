// Dayanıklılık katmanı — zaman aşımı ve devre kesici.
//
// Bu davranışların her biri canlı bir ölçüme dayanıyor: bugün Bedesten'e
// yapılan aynı arama bir denemede TLS el sıkışmasında düştü, ikincisinde
// dört tekrardan sonra 34,86 saniyede geldi; sağlıklıyken 1,08 saniye.
// Testler o gerçeğin kod tarafındaki karşılığını kilitliyor.
import { describe, it, expect, vi } from 'vitest';
import {
  DevreKesici,
  korumaliGetir,
  zamanAsimiyla,
} from '../supabase/functions/_shared/dayaniklilik';

const uyu = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('zamanAsimiyla', () => {
  it('süresinde biten işin sonucunu döndürür', async () => {
    const s = await zamanAsimiyla(async () => {
      await uyu(5);
      return 42;
    }, { ms: 200 });
    expect(s).toBe(42);
  });

  it('süre aşılırsa hata atar', async () => {
    await expect(
      zamanAsimiyla(async () => {
        await uyu(80);
        return 1;
      }, { ms: 20, ad: 'arama' })
    ).rejects.toThrow(/arama.*zaman aşımı/);
  });

  it('süre dolunca sinyali iptal eder — istek arka planda sürmesin', async () => {
    let iptalEdildi = false;
    await expect(
      zamanAsimiyla(async (sinyal) => {
        sinyal.addEventListener('abort', () => {
          iptalEdildi = true;
        });
        await uyu(80);
        return 1;
      }, { ms: 20 })
    ).rejects.toThrow();
    expect(iptalEdildi).toBe(true);
  });

  it('iş kendi hatasını attığında o hata geçer', async () => {
    await expect(
      zamanAsimiyla(async () => {
        throw new Error('bedesten 500');
      }, { ms: 200 })
    ).rejects.toThrow('bedesten 500');
  });
});

describe('DevreKesici', () => {
  it('eşiğe kadar kapalı kalır', () => {
    const d = new DevreKesici({ esik: 3 });
    expect(d.durum()).toBe('kapali');
    d.basarisiz();
    d.basarisiz();
    expect(d.durum()).toBe('kapali');
    expect(d.gecebilirMi()).toBe(true);
  });

  it('eşiğe ulaşınca açılır ve istekleri geçirmez', () => {
    const d = new DevreKesici({ esik: 2, acikKalmaMs: 60_000 });
    d.basarisiz();
    d.basarisiz();
    expect(d.durum()).toBe('acik');
    expect(d.gecebilirMi()).toBe(false);
  });

  it('bir başarı sayacı sıfırlar', () => {
    const d = new DevreKesici({ esik: 2 });
    d.basarisiz();
    d.basarili();
    d.basarisiz();
    expect(d.durum()).toBe('kapali');
    expect(d.hataSayisi()).toBe(1);
  });

  it('süre dolunca yarım açılır ve YALNIZ BİR yoklamaya izin verir', () => {
    let t = 1_000;
    const d = new DevreKesici({ esik: 1, acikKalmaMs: 500, saat: () => t });
    d.basarisiz();
    expect(d.gecebilirMi()).toBe(false);

    t += 500;
    expect(d.durum()).toBe('yarim');
    // İlk çağrı yoklamayı alır; biriken diğerleri ölü kaynağa gitmemeli.
    expect(d.gecebilirMi()).toBe(true);
    expect(d.gecebilirMi()).toBe(false);
    expect(d.gecebilirMi()).toBe(false);
  });

  it('yoklama başarılıysa devre kapanır', () => {
    let t = 0;
    const d = new DevreKesici({ esik: 1, acikKalmaMs: 100, saat: () => t });
    d.basarisiz();
    t = 100;
    expect(d.gecebilirMi()).toBe(true);
    d.basarili();
    expect(d.durum()).toBe('kapali');
    expect(d.gecebilirMi()).toBe(true);
  });

  it('yoklama da başarısızsa devre yeniden açılır', () => {
    let t = 0;
    const d = new DevreKesici({ esik: 1, acikKalmaMs: 100, saat: () => t });
    d.basarisiz();
    t = 100;
    expect(d.gecebilirMi()).toBe(true);
    d.basarisiz();
    expect(d.durum()).toBe('acik');
    t = 150;
    expect(d.durum()).toBe('acik');
    t = 200;
    expect(d.durum()).toBe('yarim');
  });
});

describe('korumaliGetir', () => {
  it('başarılı işte sonucu döndürür', async () => {
    const d = new DevreKesici();
    const s = await korumaliGetir(d, async () => ['karar'], { ms: 200 }, []);
    expect(s).toEqual(['karar']);
  });

  it('HATA ATMAZ — yedeği döndürür (avukatın cevabı düşmesin)', async () => {
    const d = new DevreKesici();
    const s = await korumaliGetir(
      d,
      async () => {
        throw new Error('bedesten öldü');
      },
      { ms: 200 },
      ['yedek']
    );
    expect(s).toEqual(['yedek']);
  });

  it('zaman aşımında da yedeği döndürür', async () => {
    const d = new DevreKesici();
    const s = await korumaliGetir(
      d,
      async () => {
        await uyu(100);
        return ['geç'];
      },
      { ms: 15 },
      ['yedek']
    );
    expect(s).toEqual(['yedek']);
  });

  it('devre açıkken işe HİÇ girmez — beklemeyi de eklemez', async () => {
    const d = new DevreKesici({ esik: 1, acikKalmaMs: 60_000 });
    const cagri = vi.fn(async () => ['x']);

    await korumaliGetir(d, async () => {
      throw new Error('ilk hata');
    }, { ms: 50 }, []);
    expect(d.durum()).toBe('acik');

    const t0 = Date.now();
    const s = await korumaliGetir(d, cagri, { ms: 5_000 }, ['yedek']);
    expect(s).toEqual(['yedek']);
    expect(cagri).not.toHaveBeenCalled();
    // Ölü kaynağa 5 saniye beklemek yerine anında dönmeli.
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
