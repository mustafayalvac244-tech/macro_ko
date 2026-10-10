import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_DEADLINES } from '@/constants/legalDeadlines';
import {
  computeLegalDue,
  DINI_BAYRAM_KAPSAM_SON_YIL,
  isLikelyReligiousHoliday,
  recessRuleForDeadline,
  recessRuleForGroup,
} from '@/utils/legalDates';

/**
 * YASAL SÜRE HESABI — 10.10.2026 denetimi (AJAN 08).
 *
 * Kaynaklar (mevzuat.gov.tr 10.10.2026'da çekildi; 2429 metni Diyanet'in
 * yayımladığı hâliyle):
 *
 *   HMK m.93   "Sürenin son gününün resmî tatil gününe rastlaması hâlinde, süre
 *              tatili takip eden ilk iş günü çalışma saati sonunda biter."
 *   HMK m.103  "Adli tatilde, ancak aşağıdaki dava ve işler görülür: a) İhtiyati
 *              tedbir, ihtiyati haciz ve delillerin tespiti gibi geçici hukuki
 *              koruma ... ile bunlara karşı yapılacak itirazlar ... b) Her çeşit
 *              nafaka davaları ile soybağı, velayet ve vesayete ilişkin dava ya
 *              da işler. ... ç) Hizmet akdi veya iş sözleşmesi sebebiyle
 *              işçilerin açtıkları davalar. ... e) İflas ve konkordato ... ğ)
 *              Çekişmesiz yargı işleri. h) Kanunlarda ivedi olduğu belirtilen
 *              ..."
 *   HMK m.104  "ADLİ TATİLE TABİ OLAN dava ve işlerde, BU KANUNUN tayin ettiği
 *              sürelerin bitmesi tatil zamanına rastlarsa, bu süreler ayrıca bir
 *              karara gerek olmaksızın adli tatilin bittiği günden itibaren bir
 *              hafta uzatılmış sayılır."
 *   CMK m.331/4 "Adlî tatile rastlayan süreler işlemez. Bu süreler tatilin
 *              bittiği günden itibaren üç gün uzatılmış sayılır."
 *   İYUK m.8/3 "BU KANUNDA yazılı sürelerin bitmesi çalışmaya ara verme zamanına
 *              rastlarsa bu süreler, ara vermenin sona erdiği günü izleyen
 *              tarihten itibaren yedi gün uzamış sayılır."
 *   6216 s.K. m.47/5 30 günlük süreyi düzenler; metinde adli tatil/uzama yoktur.
 *   2429 s.K. m.2 "Ramazan Bayramı; Arefe günü saat 13:00'ten itibaren 3,5
 *              gündür. Kurban Bayramı; Arefe günü saat 13:00'ten itibaren 4,5
 *              gündür." (m.1: Cumhuriyet Bayramı 28 Ekim 13:00'ten başlar.)
 *
 * Bayram tarihleri: Diyanet "Dini Günler Listesi" (vakithesaplama.diyanet.gov.tr).
 *
 * 2026 takvimi: 19 Mar Per (arefe) · 20 Mar Cum · 23 Mar Pzt · 26 May Sal (arefe)
 * 27 May Çar · 1 Haz Pzt · 28 Eki Çar (arefe) · 29 Eki Per · 30 Eki Cum
 * 19 Tem Paz · 20 Tem Pzt · 7 Eyl Pzt
 */
const d = (iso: string) => new Date(`${iso}T00:00:00`);
const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const tanim = (id: string) => {
  const t = LEGAL_DEADLINES.find((x) => x.id === id);
  if (!t) throw new Error(`katalogda yok: ${id}`);
  return t;
};

describe('adli tatil uzaması SÜRE BAZLI (HMK 103/104, İYUK 8/3, 6216)', () => {
  it('HMK 394 ihtiyati tedbire itiraz: HMK 103/1-a "bunlara karşı yapılacak itirazlar" tatilde görülür → uzama YOK', () => {
    expect(recessRuleForDeadline(tanim('tedbir-itiraz'))).toBe('none');
    // 22 Tem + 1 hafta = 29 Tem (adli tatil içinde). Grup kuralıyla 7 Eylül'dü.
    const t = tanim('tedbir-itiraz');
    const r = computeLegalDue(d('2026-07-22'), t.amount, t.unit, recessRuleForDeadline(t));
    expect(ymd(r.raw)).toBe('2026-07-29');
    expect(ymd(r.due)).toBe('2026-07-29');
    expect(r.recessExtended).toBe(false);
    expect(r.recessNotApplied).toBe(true);
  });

  it('işçi davası / işe iade (HMK 103/1-ç; süre HMK\'nın değil İş K. 20\'nin) → uzama YOK', () => {
    for (const id of ['ise-iade', 'arabuluculuk-dava']) {
      expect(recessRuleForDeadline(tanim(id)), id).toBe('none');
    }
    const t = tanim('arabuluculuk-dava'); // 2 hafta
    const r = computeLegalDue(d('2026-07-22'), t.amount, t.unit, recessRuleForDeadline(t));
    expect(ymd(r.due)).toBe('2026-08-05');
    expect(r.recessExtended).toBe(false);
  });

  it('AYM bireysel başvuru (6216 m.47/5): İYUK 8/3 yalnız "Bu Kanunda yazılı" süreleri uzatır → uzama YOK', () => {
    expect(recessRuleForDeadline(tanim('aym-basvuru'))).toBe('none');
    const t = tanim('aym-basvuru'); // 30 gün
    const r = computeLegalDue(d('2026-07-22'), t.amount, t.unit, recessRuleForDeadline(t));
    expect(ymd(r.due)).toBe('2026-08-21'); // 8 Eylül DEĞİL
  });

  it('adli tatile tabi sıradan HMK süresi uzar (cevap dilekçesi)', () => {
    const t = tanim('cevap');
    expect(recessRuleForDeadline(t)).toBe('civil');
    const r = computeLegalDue(d('2026-07-22'), t.amount, t.unit, recessRuleForDeadline(t));
    expect(ymd(r.raw)).toBe('2026-08-05');
    expect(ymd(r.due)).toBe('2026-09-07');
    expect(r.recessExtended).toBe(true);
  });

  it('istisnası olmayan her süre kendi grubunun kuralını alır', () => {
    const istisna = new Set(['tedbir-itiraz', 'ise-iade', 'arabuluculuk-dava', 'aym-basvuru']);
    for (const t of LEGAL_DEADLINES) {
      if (istisna.has(t.id)) continue;
      expect(recessRuleForDeadline(t), t.id).toBe(recessRuleForGroup(t.group));
    }
  });
});

describe('adli tatil + hafta sonu SIRASI (HMK 104 önce, HMK 93 sonra)', () => {
  it('uzamanın bittiği gün hafta sonuna denk gelirse ilk iş gününe kayar (hukuk, 2025)', () => {
    // 22 Tem 2025 + 10 gün = 1 Ağu (tatil içinde) → 31 Ağu + 7 = 7 Eylül 2025 PAZAR → 8 Eylül Pzt.
    const r = computeLegalDue(d('2025-07-22'), 10, 'day', 'civil');
    expect(ymd(r.raw)).toBe('2025-08-01');
    expect(ymd(r.due)).toBe('2025-09-08');
    expect(r.recessExtended).toBe(true);
  });

  it('ceza: 31 Ağu + 3 gün = 3 Eylül 2023 Pazar → 4 Eylül Pzt', () => {
    const r = computeLegalDue(d('2023-07-22'), 10, 'day', 'criminal');
    expect(ymd(r.due)).toBe('2023-09-04');
  });

  it('tatilin ilk günü (20 Tem) ve son günü (31 Ağu) uzar; 1 Eylül uzamaz', () => {
    expect(ymd(computeLegalDue(d('2026-07-10'), 10, 'day', 'civil').due)).toBe('2026-09-07'); // raw 20 Tem
    expect(ymd(computeLegalDue(d('2026-08-21'), 10, 'day', 'civil').due)).toBe('2026-09-07'); // raw 31 Ağu
    const bir = computeLegalDue(d('2026-08-22'), 10, 'day', 'civil'); // raw 1 Eylül Salı
    expect(ymd(bir.due)).toBe('2026-09-01');
    expect(bir.recessExtended).toBe(false);
  });

  it('cuma son gün kaymaz; cumartesi pazartesiye kayar', () => {
    const cuma = computeLegalDue(d('2026-01-06'), 10, 'day', 'civil'); // 16 Oca Cuma
    expect(ymd(cuma.due)).toBe('2026-01-16');
    expect(cuma.extended).toBe(false);
    const cmt = computeLegalDue(d('2026-01-07'), 10, 'day', 'civil'); // 17 Oca Cumartesi
    expect(ymd(cmt.due)).toBe('2026-01-19');
  });

  // KARAR GEREKİYOR (meslektaş teyidi): son gün hafta sonuna (19 Tem Pazar)
  // düşüp HMK 93 ile tatilin İLK GÜNÜ olan 20 Temmuz'a (Pzt) kayarsa, HMK 104'ün
  // "sürelerin bitmesi tatil zamanına rastlarsa" uzaması uygulanır mı? Metin
  // iki yönde de okunabilir; uygulama ERKEN tarihi (20 Tem) verir = güvenli yön.
  // Bu test mevcut davranışı sabitler; karar verilirse bilerek değiştirilir.
  it('19 Tem Pazar → 20 Tem: şimdilik UZATILMAZ ama inRecess işaretlenir (ekran uyarır)', () => {
    const r = computeLegalDue(d('2026-07-09'), 10, 'day', 'civil'); // raw 19 Tem Pazar
    expect(ymd(r.raw)).toBe('2026-07-19');
    expect(ymd(r.due)).toBe('2026-07-20');
    expect(r.recessExtended).toBe(false);
    expect(r.inRecess).toBe(true);
  });
});

describe('dini bayramlar son günü erteler (HMK 93 + 2429 m.2)', () => {
  it('Ramazan Bayramı 2026: 20 Mart Cuma (1. gün) → 23 Mart Pazartesi', () => {
    const r = computeLegalDue(d('2026-03-10'), 10, 'day');
    expect(ymd(r.raw)).toBe('2026-03-20');
    expect(ymd(r.due)).toBe('2026-03-23');
    expect(r.extended).toBe(true);
  });

  it('Kurban Bayramı 2026: 27 Mayıs Çarşamba (1. gün) → bayram + hafta sonu → 1 Haziran Pzt', () => {
    const r = computeLegalDue(d('2026-05-17'), 10, 'day');
    expect(ymd(r.raw)).toBe('2026-05-27');
    expect(ymd(r.due)).toBe('2026-06-01');
  });

  it('bayramın ortasındaki gün (2. gün) de ertelenir; bayramdan sonraki iş günü ertelenmez', () => {
    // 2029 Ramazan Bayramı: 14–16 Şubat (Çar–Cum). Son gün 15 Şubat → 19 Şubat Pzt.
    expect(ymd(computeLegalDue(d('2029-02-05'), 10, 'day').due)).toBe('2029-02-19');
    // 19 Şubat zaten iş günü.
    expect(ymd(computeLegalDue(d('2029-02-09'), 10, 'day').due)).toBe('2029-02-19');
  });

  it('bayram bir önceki yıla taşan ve yıl içinde iki kez gelen durum (2033)', () => {
    // 2033 Ramazan Bayramı 2–4 Ocak (Paz–Sal): son gün 2 Ocak → 5 Ocak Çarşamba.
    expect(ymd(computeLegalDue(d('2032-12-23'), 10, 'day').due)).toBe('2033-01-05');
    // 2033 ikinci Ramazan Bayramı 23–25 Aralık (Cum–Paz): son gün 23 Aralık → 26 Aralık Pzt.
    expect(ymd(computeLegalDue(d('2033-12-13'), 10, 'day').due)).toBe('2033-12-26');
  });

  it('arefe yarım gündür (2429): son gün ARAFEYE düşerse kaydırılmaz ama uyarılır', () => {
    const arefe = computeLegalDue(d('2026-03-09'), 10, 'day'); // 19 Mart Perşembe, Ramazan arefesi
    expect(ymd(arefe.due)).toBe('2026-03-19');
    expect(arefe.extended).toBe(false);
    expect(arefe.religiousWarn).toBe(true);
    // Arefenin bir gün öncesi: uyarı yok.
    expect(computeLegalDue(d('2026-03-08'), 10, 'day').religiousWarn).toBe(false);
  });

  it('28 Ekim (Cumhuriyet Bayramı arefesi, 2429 m.1) yarım gündür; 29 Ekim kayar', () => {
    const arefe = computeLegalDue(d('2026-10-18'), 10, 'day'); // 28 Ekim Çarşamba
    expect(ymd(arefe.due)).toBe('2026-10-28');
    expect(arefe.religiousWarn).toBe(true);
    expect(ymd(computeLegalDue(d('2026-10-19'), 10, 'day').due)).toBe('2026-10-30'); // 29 Ekim Per → 30 Ekim Cum
  });

  it('tablonun kapsamı dışındaki yıl SESSİZ kalmaz: bayram etkisi bilinmiyor uyarısı', () => {
    expect(DINI_BAYRAM_KAPSAM_SON_YIL).toBe(2035);
    expect(computeLegalDue(d('2036-01-22'), 10, 'day').religiousWarn).toBe(true); // 1 Şub 2036
    expect(computeLegalDue(d('2030-06-02'), 10, 'day').religiousWarn).toBe(false); // 12 Haz 2030, kapsam içi, bayram dışı
  });

  it('tablo iç tutarlılığı: her yıl 7 bayram günü (Ramazan 3 + Kurban 4); 2033\'te iki Ramazan = 10', () => {
    for (let yil = 2026; yil <= 2035; yil++) {
      let gun = 0;
      for (let t = new Date(yil, 0, 1); t.getFullYear() === yil; t.setDate(t.getDate() + 1)) {
        if (isLikelyReligiousHoliday(t)) gun++;
      }
      expect(gun, String(yil)).toBe(yil === 2033 ? 10 : 7);
    }
  });
});

describe('UTC kayması: son gün yerel takvim gününden okunur', () => {
  // Türkiye'de yerel gece yarısının ISO dizgisi ÖNCEKİ günü verir
  // (2026-03-23T00:00+03 = 2026-03-22T21:00Z). Hesap yolunda gün, toISOString
  // dilimlenerek okunursa son gün bir gün geri kayar. Yol: legalDates.ts yalnız
  // yerel alanlar kullanır; ekran toISOString'i tam an olarak formatDate'e verir.
  it('hesap ve ekran yolunda toISOString().slice / split(T) ile gün okunmuyor', () => {
    for (const dosya of ['src/utils/legalDates.ts', 'src/utils/istinafSuresi.ts', 'app/deadline-wizard.tsx']) {
      const kaynak = readFileSync(resolve(__dirname, '..', dosya), 'utf8');
      expect(kaynak, dosya).not.toMatch(/toISOString\(\)\s*\.\s*(slice|substring|substr|split)/);
      expect(kaynak, dosya).not.toMatch(/split\(\s*['"]T['"]\s*\)/);
    }
  });

  it('son gün her saat diliminde yerel gün olarak aynı kalır (an → ISO → an gidiş-dönüşü)', () => {
    const r = computeLegalDue(d('2026-03-10'), 10, 'day');
    const gidisDonus = new Date(r.due.toISOString());
    expect(ymd(gidisDonus)).toBe(ymd(r.due));
    expect(ymd(r.due)).toBe('2026-03-23');
  });
});
