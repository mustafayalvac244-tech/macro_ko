import { describe, expect, it } from 'vitest';
import {
  BILDIRIM_BUTCESI,
  IOS_BILDIRIM_TAVANI,
  bildirimHedefi,
  bildirimPlaniYap,
  bildirimVerisi,
  etkinlikAdaylari,
  kuruluBildirimGuncelMi,
  planBildirimId,
  tetikAniCoz,
  tetikGuncelMi,
  TETIK_TOLERANS_MS,
  TETIK_VERI_ANAHTARI,
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

/**
 * iOS'TA SAATİ DEĞİŞEN DURUŞMANIN ESKİ BİLDİRİMİ KALIYORDU (09.10.2026 denetimi).
 *
 * Kurulu bildirimin GERÇEK iOS biçimi (expo-notifications 57.0.19 kaynağından
 * okundu, cihazda ölçülmedi): 'date' tetikleyicisi kurulurken
 * UNTimeIntervalNotificationTrigger'a çevriliyor (ios/.../TriggerRecords.swift,
 * DateTriggerRecord) ve geri okunurken { type: 'timeInterval', seconds }
 * dönüyor (NotificationRecords.swift). `seconds` KURULDUĞU andaki aralık;
 * kurulma anı bilinmediği için tetik anı ondan hesaplanamaz. Eşitleme bu
 * biçimi "çözemedim → güncel say" diye atlıyordu, yani "saati kayan bildirim
 * yenilenir" düzeltmesi iOS'ta hiç çalışmıyordu.
 */
describe('iOS biçimindeki kurulu bildirim — saat kayması', () => {
  const an = new Date('2026-10-01T09:00:00Z').getTime();
  const iosTetik = { class: 'UNTimeIntervalNotificationTrigger', type: 'timeInterval', seconds: 86_400, repeats: false };

  it('işaretsiz (eski sürümde kurulmuş) iOS bildirimi güncel SAYILMAZ — bir kez yeniden kurulur', () => {
    // Duruşma 10:00'dan 14:00'e alındı; iOS'taki kurulu bildirimin anı okunamıyor.
    expect(tetikGuncelMi(iosTetik, an + 4 * 3600_000)).toBe(false);
  });

  it('içine yazılan tetik anı (data) okunur: aynı saatte dokunulmaz, kaymışsa yenilenir', () => {
    const kurulu = { trigger: iosTetik, content: { title: 'T', body: 'G', data: { [TETIK_VERI_ANAHTARI]: an } } };
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an, title: 'T', body: 'G' })).toBe(true);
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an + 4 * 3600_000, title: 'T', body: 'G' })).toBe(false);
  });

  it('Android biçimi ({ type: "date", value }) işaretsiz de çalışmaya devam eder', () => {
    const kurulu = { trigger: { type: 'date', value: an, repeats: false }, content: { title: 'T', body: 'G' } };
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an, title: 'T', body: 'G' })).toBe(true);
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an + 60 * 60_000, title: 'T', body: 'G' })).toBe(false);
  });

  it('tanınmayan biçime işaret de yoksa DOKUNULMAZ (her eşitlemede silip kurma döngüsü olmasın)', () => {
    expect(kuruluBildirimGuncelMi({ trigger: { type: 'unknown' }, content: {} }, { tetikMs: an })).toBe(true);
    // Tekrarlayan aralık bizim kurduğumuz bir şey değil: dokunulmaz.
    expect(tetikGuncelMi({ type: 'timeInterval', seconds: 60, repeats: true }, an)).toBe(true);
  });

  it('METİN değiştiyse (başka cihazda düzenlenen başlık, dil, metin kuralı) yenilenir', () => {
    const kurulu = { trigger: iosTetik, content: { title: 'Eski', body: 'G', data: { [TETIK_VERI_ANAHTARI]: an } } };
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an, title: 'Yeni', body: 'G' })).toBe(false);
    expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: an, title: 'Eski', body: 'Başka' })).toBe(false);
  });

  it('kurulan her bildirim kendi tetik anını data içinde taşır (eşitleme onu okur)', () => {
    for (const p of etkinlikAdaylari(durusma('h1', 10), simdi)) {
      const kurulu = { trigger: iosTetik, content: { data: bildirimVerisi(p) } };
      expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: p.tetikMs }), p.tur).toBe(true);
      expect(kuruluBildirimGuncelMi(kurulu, { tetikMs: p.tetikMs + 4 * 3600_000 }), p.tur).toBe(false);
    }
  });
});

describe('bildirime dokununca açılan ekran', () => {
  it('"duruşma nasıl geçti?" bildirimi duruşma çıkışını açar, diğerleri bir yol taşımaz', () => {
    const adaylar = etkinlikAdaylari(durusma('h1', 10), simdi);
    const sonuc = adaylar.find((x) => x.tur === 'sonuc')!;
    expect(bildirimHedefi(bildirimVerisi(sonuc))).toBe('/durusma-cikisi');
    for (const p of adaylar.filter((x) => x.tur !== 'sonuc')) expect(bildirimHedefi(bildirimVerisi(p)), p.tur).toBeNull();
  });

  it('bilinmeyen yol AÇILMAZ (sunucudan gelen bildirimin data’sı bizim elimizde değil)', () => {
    expect(bildirimHedefi({ url: '/admin' })).toBeNull();
    expect(bildirimHedefi({ url: 'https://ornek.com' })).toBeNull();
    expect(bildirimHedefi(null)).toBeNull();
    expect(bildirimHedefi('url')).toBeNull();
  });
});

/**
 * 24 SAATTEN YAKIN ETKİNLİĞE HATIRLATMA HİÇ KURULMUYORDU (09.10.2026 denetimi).
 *
 * Duruşma formunun varsayılanları: tarih = ŞİMDİ + 24 saat, hatırlatma = 1 gün
 * önce (app/hearing-form.tsx). Seçilen an = formun açıldığı an → kaydedince
 * geçmişte; 3 gün kala da geçmişte; 1 gün kala seçilenle aynı. Sonuç: ön
 * hatırlatma SIFIR. Akşam girilen ertesi sabahki duruşmada da aynısı.
 *
 * Yedek KAYIT ANINA (updated_at) göre seçilir, "şimdi"ye göre değil: "şimdi"ye
 * göre seçilseydi 1 saat kala bildirimi çaldıktan sonraki ilk eşitleme
 * 30 dk kala için İKİNCİ bir bildirim kurardı.
 */
describe('seçilen an kayıt anında zaten geçmişse — yedek hatırlatma', () => {
  const kayit = new Date('2026-10-08T17:00:00Z').getTime(); // 20:00 TSİ
  const kayitISO = new Date(kayit).toISOString();
  const etkinlik = (anMs: number, secilenDakika = 24 * 60, tur: PlanEtkinligi['tur'] = 'durusma'): PlanEtkinligi => ({
    id: 'h1',
    tur,
    anISO: new Date(anMs).toISOString(),
    secilenDakika,
    bitti: false,
    kayitISO,
  });
  const onHatirlatmalar = (a: ReturnType<typeof etkinlikAdaylari>) => a.filter((x) => x.tur !== 'sonuc');

  it('formun varsayılanı (şimdi + 24 saat, 1 gün önce): 1 saat kala hatırlatma kurulur', () => {
    const an = kayit + 24 * SAAT - 30_000; // form 30 sn önce açılmıştı
    const a = onHatirlatmalar(etkinlikAdaylari(etkinlik(an), kayit));
    expect(a).toHaveLength(1);
    expect(a[0]!.tur).toBe('secilen');
    expect(a[0]!.bildirimId).toBe('hearing-h1');
    expect(a[0]!.tetikMs).toBe(an - SAAT);
  });

  it("akşam 20:00'de girilen ertesi sabah 09:30 duruşması: 08:30'da hatırlatılır", () => {
    const an = new Date('2026-10-09T06:30:00Z').getTime(); // 09:30 TSİ
    const a = onHatirlatmalar(etkinlikAdaylari(etkinlik(an), kayit));
    expect(a.map((x) => x.tetikMs)).toEqual([an - SAAT]);
  });

  it('45 dk sonraki etkinlikte 1 saat de geçmişte: 30 dk kala kurulur', () => {
    const an = kayit + 45 * 60_000;
    expect(onHatirlatmalar(etkinlikAdaylari(etkinlik(an, 60), kayit)).map((x) => x.tetikMs)).toEqual([an - 30 * 60_000]);
  });

  it('20 dk sonraki etkinlikte yedek de sığmaz: ön hatırlatma kurulmaz', () => {
    expect(onHatirlatmalar(etkinlikAdaylari(etkinlik(kayit + 20 * 60_000), kayit))).toEqual([]);
  });

  it('YEDEK ÇALDIKTAN SONRA ikinci bir yedek kurulmaz (plan zamanla kaymaz)', () => {
    const an = kayit + 13 * SAAT;
    const sonra = an - 50 * 60_000; // 1 saat kala çaldı, 10 dk geçti
    expect(onHatirlatmalar(etkinlikAdaylari(etkinlik(an), sonra))).toEqual([]);
  });

  it('bir aşama zaten ileride kalıyorsa yedek EKLENMEZ (1 hafta seçili, duruşma 2 gün sonra → 1 gün kala yeter)', () => {
    const a = onHatirlatmalar(etkinlikAdaylari(etkinlik(kayit + 2 * GUN, 7 * 24 * 60), kayit));
    expect(a.map((x) => x.tur)).toEqual(['1g']);
  });

  it('seçilen an ileride ise davranış değişmez', () => {
    const a = onHatirlatmalar(etkinlikAdaylari(etkinlik(kayit + 10 * GUN), kayit));
    expect(a.map((x) => x.tur).sort()).toEqual(['3g', 'secilen']);
  });

  it('görevde de uygulanır, ödeme sözünde uygulanmaz', () => {
    const an = kayit + 13 * SAAT;
    expect(onHatirlatmalar(etkinlikAdaylari(etkinlik(an, 24 * 60, 'gorev'), kayit)).map((x) => x.tetikMs)).toEqual([an - SAAT]);
    expect(etkinlikAdaylari(etkinlik(an, 0, 'soz'), kayit).map((x) => x.tetikMs)).toEqual([an]);
    expect(etkinlikAdaylari(etkinlik(an, 24 * 60, 'soz'), kayit)).toEqual([]);
  });

  it('kayıt anı bilinmiyorsa eski davranış sürer (yedek yok)', () => {
    const an = kayit + 13 * SAAT;
    const { kayitISO: _yok, ...kayitsiz } = etkinlik(an);
    expect(onHatirlatmalar(etkinlikAdaylari(kayitsiz, kayit))).toEqual([]);
  });
});
