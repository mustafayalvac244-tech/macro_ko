import { describe, expect, it } from 'vitest';
import {
  BILDIRIM_BUTCESI,
  IOS_BILDIRIM_TAVANI,
  bildirimPlaniYap,
  etkinlikAdaylari,
  planBildirimId,
  tetikAniCoz,
  tetikGuncelMi,
  TETIK_TOLERANS_MS,
  type PlanEtkinligi,
} from '@/utils/bildirimPlani';

/**
 * BİLDİRİM BÜTÇESİ.
 *
 * iOS'ta bekleyen yerel bildirim tavanı 64'tür ve fazlası sessizce düşer.
 * Uygulama duruşma başına 3-4 bildirim kuruyor; kodun kendi yorumundaki gerçek
 * veri 49 duruşmadan söz ediyor — yani tavanın iki katı. Hangi bildirimin
 * düştüğünü işletim sistemine bırakmak, yarınki duruşmanın hatırlatmasını
 * üç ay sonraki bir görev uğruna kaybetmek demektir.
 *
 * Burada ÖLÇÜLEN ŞEY seçim mantığıdır (saf fonksiyon, tekrar koşulsa aynı
 * çıkar). 64 sınırının kendisi Apple'ın belgelenmiş platform sınırıdır;
 * gerçek bir iPhone'da ölçülmedi.
 */

const SAAT = 3600_000;
const GUN = 24 * SAAT;
const simdi = new Date('2026-09-09T09:00:00Z').getTime();

function durusma(id: string, gunSonra: number, secilenDakika = 60): PlanEtkinligi {
  return {
    id,
    tur: 'durusma',
    anISO: new Date(simdi + gunSonra * GUN).toISOString(),
    secilenDakika,
    bitti: false,
  };
}

describe('etkinlikAdaylari', () => {
  it('duruşma için 4 bildirim üretir: seçilen + 3 gün + 1 gün + sonuç', () => {
    const a = etkinlikAdaylari(durusma('h1', 10), simdi);
    expect(a.map((x) => x.tur).sort()).toEqual(['1g', '3g', 'secilen', 'sonuc']);
  });

  it('seçilen öncelik bir aşamayla AYNIYSA bildirimi ikiye katlamaz', () => {
    // Kullanıcı "1 gün önce" seçtiyse "1 gün kala" ikinci kez kurulmamalı.
    const a = etkinlikAdaylari(durusma('h1', 10, 24 * 60), simdi);
    expect(a.filter((x) => x.tur === 'secilen' || x.tur === '1g')).toHaveLength(1);
    expect(a).toHaveLength(3);
  });

  it('geçmişte kalan aşamaları atar ama gelecektekini tutar', () => {
    // Duruşma 2 gün sonra: "3 gün kala" çoktan geçti, "1 gün kala" duruyor.
    const a = etkinlikAdaylari(durusma('h1', 2), simdi);
    expect(a.map((x) => x.tur).sort()).toEqual(['1g', 'secilen', 'sonuc']);
  });

  it('tamamlanmış etkinlik için hiç bildirim üretmez', () => {
    expect(etkinlikAdaylari({ ...durusma('h1', 10), bitti: true }, simdi)).toEqual([]);
  });

  it('geçmiş duruşmada yalnız "ne oldu?" sorusu kalır — o da 2 saat geçmediyse', () => {
    const birSaatOnce: PlanEtkinligi = {
      id: 'h1',
      tur: 'durusma',
      anISO: new Date(simdi - SAAT).toISOString(),
      secilenDakika: 60,
      bitti: false,
    };
    const a = etkinlikAdaylari(birSaatOnce, simdi);
    expect(a).toHaveLength(1);
    expect(a[0]!.tur).toBe('sonuc');

    // Üç saat önceki duruşmada sonuç anı da geçmiştir: hiçbir şey kalmaz.
    const ucSaatOnce = { ...birSaatOnce, anISO: new Date(simdi - 3 * SAAT).toISOString() };
    expect(etkinlikAdaylari(ucSaatOnce, simdi)).toEqual([]);
  });

  it('görev ve ödeme sözünde "sonuç" bildirimi ÜRETMEZ', () => {
    const gorev: PlanEtkinligi = { id: 'd1', tur: 'gorev', anISO: new Date(simdi + 10 * GUN).toISOString(), secilenDakika: 60, bitti: false };
    const soz: PlanEtkinligi = { id: 'p1', tur: 'soz', anISO: new Date(simdi + 10 * GUN).toISOString(), secilenDakika: 0, bitti: false };
    expect(etkinlikAdaylari(gorev, simdi).some((x) => x.tur === 'sonuc')).toBe(false);
    expect(etkinlikAdaylari(soz, simdi).some((x) => x.tur === 'sonuc')).toBe(false);
  });

  it('geçersiz tarihte çökmez', () => {
    expect(etkinlikAdaylari({ id: 'h1', tur: 'durusma', anISO: 'gecersiz', secilenDakika: 60, bitti: false }, simdi)).toEqual([]);
  });
});

describe('planBildirimId — notifications.ts ile aynı şema', () => {
  it('duruşma kimlikleri', () => {
    expect(planBildirimId('durusma', 'abc', 'secilen')).toBe('hearing-abc');
    expect(planBildirimId('durusma', 'abc', '3g')).toBe('hearing-abc-3d');
    expect(planBildirimId('durusma', 'abc', '1g')).toBe('hearing-abc-1d');
    expect(planBildirimId('durusma', 'abc', 'sonuc')).toBe('hearing-outcome-abc');
  });

  it('görev ve söz kimlikleri', () => {
    expect(planBildirimId('gorev', 'x', 'secilen')).toBe('deadline-x');
    expect(planBildirimId('gorev', 'x', '3g')).toBe('deadline-x-3d');
    expect(planBildirimId('soz', 'y', '1g')).toBe('promise-y-1d');
  });
});

describe('bildirimPlaniYap — bütçe', () => {
  it('bütçe iOS tavanının ALTINDA kalır', () => {
    expect(BILDIRIM_BUTCESI).toBeLessThan(IOS_BILDIRIM_TAVANI);
    // Sabah özeti (7) + güvenlik payı da tavana sığmalı.
    expect(BILDIRIM_BUTCESI + 7 + 7).toBeLessThanOrEqual(IOS_BILDIRIM_TAVANI);
  });

  it('49 duruşmalık gerçek yükte bütçeyi AŞMAZ', () => {
    // Kodun kendi yorumundaki canlı veri: 49 duruşma. Bütçesiz hâlde bu
    // ~150 bildirim eder ve iOS sessizce çoğunu düşürürdü.
    const etkinlikler = Array.from({ length: 49 }, (_, i) => durusma(`h${i}`, i + 1));
    const { plan, sigmayan } = bildirimPlaniYap(etkinlikler, simdi);
    expect(plan.length).toBe(BILDIRIM_BUTCESI);
    expect(sigmayan).toBeGreaterThan(0);
  });

  it('bütçe dolduğunda düşen HER ZAMAN en uzaktaki olur', () => {
    const etkinlikler = Array.from({ length: 40 }, (_, i) => durusma(`h${i}`, i + 1));
    const { plan } = bildirimPlaniYap(etkinlikler, simdi, 10);
    // En yakın duruşmanın (h0, yarın) bildirimleri planda olmalı.
    expect(plan.some((p) => p.kaynakId === 'h0')).toBe(true);
    // En uzaktaki (h39) hiç olmamalı.
    expect(plan.some((p) => p.kaynakId === 'h39')).toBe(false);
  });

  it('plan tetiklenme anına göre sıralıdır', () => {
    const etkinlikler = [durusma('uzak', 30), durusma('yakin', 2), durusma('orta', 10)];
    const { plan } = bildirimPlaniYap(etkinlikler, simdi);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.tetikMs).toBeGreaterThanOrEqual(plan[i - 1]!.tetikMs);
    }
  });

  it('YARINKİ duruşma, üç ay sonraki bir görevin bildirimi uğruna düşmez', () => {
    // Kusurun somut hâli: uzaktaki kayıtlar önce kurulduğu için yakındaki
    // duruşmanın hatırlatması iOS tarafından atılabiliyordu.
    const uzakGorevler: PlanEtkinligi[] = Array.from({ length: 60 }, (_, i) => ({
      id: `d${i}`,
      tur: 'gorev',
      anISO: new Date(simdi + (90 + i) * GUN).toISOString(),
      secilenDakika: 60,
      bitti: false,
    }));
    const { plan } = bildirimPlaniYap([...uzakGorevler, durusma('yarin', 1)], simdi);
    expect(plan.some((p) => p.kaynakId === 'yarin')).toBe(true);
  });

  it('bütçe 0 ise hiçbir şey planlanmaz ama sayım doğru kalır', () => {
    const { plan, sigmayan } = bildirimPlaniYap([durusma('h1', 5)], simdi, 0);
    expect(plan).toEqual([]);
    expect(sigmayan).toBe(4);
  });

  it('boş listede boş plan döner', () => {
    expect(bildirimPlaniYap([], simdi)).toEqual({ plan: [], sigmayan: 0 });
  });

  it('aynı kimlik iki kez planlanmaz', () => {
    const { plan } = bildirimPlaniYap([durusma('h1', 5), durusma('h2', 6)], simdi);
    expect(new Set(plan.map((p) => p.bildirimId)).size).toBe(plan.length);
  });
});

describe('tetikAniCoz / tetikGuncelMi — kurulu bildirimin saati eskimiş mi?', () => {
  const an = new Date('2026-10-01T09:00:00Z').getTime();

  it('{ type: "date", date: Date } biçimini çözer', () => {
    expect(tetikAniCoz({ type: 'date', date: new Date(an) })).toBe(an);
  });

  it('{ type: "date", date: <ms> } biçimini çözer', () => {
    expect(tetikAniCoz({ type: 'date', date: an })).toBe(an);
  });

  it('{ value: <ms> } biçimini de çözer (platform farkı)', () => {
    expect(tetikAniCoz({ type: 'date', value: an })).toBe(an);
  });

  it('iOS takvim tetikleyicisini bileşenlerinden kurar', () => {
    const beklenen = new Date(2026, 9, 1, 12, 30, 0).getTime(); // 1 Ekim 2026 12:30 yerel
    expect(
      tetikAniCoz({
        type: 'calendar',
        dateComponents: { year: 2026, month: 10, day: 1, hour: 12, minute: 30, second: 0 },
      })
    ).toBe(beklenen);
  });

  it('çözemediği biçimde null döner', () => {
    expect(tetikAniCoz(null)).toBeNull();
    expect(tetikAniCoz(undefined)).toBeNull();
    expect(tetikAniCoz({ type: 'timeInterval', seconds: 60 })).toBeNull();
    expect(tetikAniCoz({ type: 'unknown' })).toBeNull();
    expect(tetikAniCoz({ type: 'date', date: 'yarın' })).toBeNull();
    expect(tetikAniCoz({ type: 'calendar', dateComponents: { hour: 9 } })).toBeNull();
  });

  it('ÇÖZEMEDİĞİNDE bildirime DOKUNULMAZ (güncel sayılır)', () => {
    // Aksi hâlde anlaşılmayan her tetikleyici her eşitlemede silinip yeniden
    // kurulurdu — sessiz bir israf döngüsü.
    expect(tetikGuncelMi({ type: 'unknown' }, an)).toBe(true);
    expect(tetikGuncelMi(null, an)).toBe(true);
  });

  it('aynı saatte güncel sayar, kaymışsa saymaz', () => {
    expect(tetikGuncelMi({ type: 'date', date: an }, an)).toBe(true);
    // Duruşma 10:00 -> 14:00 alındı: kurulu bildirim eskimiştir.
    expect(tetikGuncelMi({ type: 'date', date: an }, an + 4 * 3600_000)).toBe(false);
  });

  it('yuvarlama toleransını aşmayan farkı güncel sayar', () => {
    expect(tetikGuncelMi({ type: 'date', date: an + TETIK_TOLERANS_MS }, an)).toBe(true);
    expect(tetikGuncelMi({ type: 'date', date: an + TETIK_TOLERANS_MS + 1 }, an)).toBe(false);
  });
});
