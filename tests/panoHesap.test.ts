import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * ANA EKRANIN TARİH HESABI — Türkiye saatinde (09.10.2026 denetimi).
 *
 * SAAT DİLİMİ ŞART. Bu makine UTC'de koşuyor; TZ verilmezse yerel gün ile UTC
 * günü aynı çıkar ve "gece yarısına yakın kayma" sınıfı hata testte GÖRÜNMEZ.
 * Türkiye UTC+3, yaz saati yok: 00:00–03:00 arası yerel gün, UTC'de bir
 * önceki gündür.
 */
const ESKI_TZ = process.env.TZ;
process.env.TZ = 'Europe/Istanbul';
afterAll(() => {
  if (ESKI_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ESKI_TZ;
});

const { yaklasanSureler, gecikenSureler, bugunKayitlari, veriDurumu } = await import('@/utils/panoHesap');

/** Yerel (Türkiye) saatle tarih; ay 1'den başlar. */
const yerel = (y: number, ay: number, g: number, s = 0, dk = 0) => new Date(y, ay - 1, g, s, dk);
const sure = (id: string, son: Date, tamam = false) => ({ id, title: id, due_at: son.toISOString(), is_completed: tamam });
const durusma = (id: string, zaman: Date, tamam = false) => ({
  id,
  title: id,
  scheduled_at: zaman.toISOString(),
  is_completed: tamam,
});

describe('saat dilimi', () => {
  it('testler Türkiye saatinde koşuyor (UTC+3)', () => {
    expect(new Date(2026, 9, 9).getTimezoneOffset()).toBe(-180);
  });
});

describe('Yaklaşan süreler rozeti — gün farkı yerel takvim gününe göre', () => {
  // Bulgu: kalan gün `Math.ceil((son − şimdi) / 24 sa)` ile sayılıyordu. Süreler
  // 23:59'da dolduğu için bugün dolan süre "1 gün", yarın dolan "2 gün", dün
  // dolmuş süre ise "Bugün" görünüyordu.
  const simdi = yerel(2026, 10, 9, 10, 0);

  it('bugün 23:59’da dolan süre "Bugün" der, "1 gün" değil', () => {
    const [s] = yaklasanSureler([sure('a', yerel(2026, 10, 9, 23, 59))], simdi);
    expect(s?.kalanGun).toBe(0); // rozet: "Bugün"
  });

  it('yarın 23:59’da dolan süre 1 gün (2 değil)', () => {
    const [s] = yaklasanSureler([sure('a', yerel(2026, 10, 10, 23, 59))], simdi);
    expect(s?.kalanGun).toBe(1);
  });

  it('dün dolmuş süre yaklaşanlarda "Bugün" diye görünmez', () => {
    expect(yaklasanSureler([sure('d', yerel(2026, 10, 8, 23, 59))], simdi)).toEqual([]);
  });

  it('gece 00:30’da, dün 23:59’da dolan süre bugüne sayılmaz', () => {
    expect(yaklasanSureler([sure('d', yerel(2026, 10, 8, 23, 59))], yerel(2026, 10, 9, 0, 30))).toEqual([]);
  });

  it('UTC’de dün, Türkiye’de bugün olan saat (01:30) bugüne sayılır', () => {
    const son = yerel(2026, 10, 9, 1, 30);
    expect(son.toISOString().slice(0, 10)).toBe('2026-10-08'); // UTC günü bir gün geride
    const [s] = yaklasanSureler([sure('u', son)], yerel(2026, 10, 9, 0, 10));
    expect(s?.kalanGun).toBe(0);
  });

  it('tamamlanmış süre listelenmez; en yakın önce; en çok 6', () => {
    const liste = [
      sure('bitti', yerel(2026, 10, 9, 23, 59), true),
      ...Array.from({ length: 8 }, (_, i) => sure(`s${8 - i}`, yerel(2026, 10, 10 + (8 - i), 23, 59))),
    ];
    const r = yaklasanSureler(liste, simdi);
    expect(r.map((x) => x.kayit.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(r.map((x) => x.kalanGun)).toEqual([2, 3, 4, 5, 6, 7]);
  });
});

describe('Süresi GEÇMİŞ süreler panoda görünür', () => {
  // Bulgu: ana ekranda geciken süre hiçbir yerde yoktu (telefon panosu yalnız
  // "bugün"ü ve sıradaki duruşmayı gösteriyordu; geniş panodaki liste ise 24
  // saatten eskiyi süzüyordu).
  const simdi = yerel(2026, 10, 9, 10, 0);

  it('dün ve öncesinde dolmuş, tamamlanmamış süreler listelenir; en yeni gecikme önce', () => {
    const r = gecikenSureler(
      [
        sure('eski', yerel(2026, 9, 20, 23, 59)),
        sure('dun', yerel(2026, 10, 8, 23, 59)),
        sure('bugun', yerel(2026, 10, 9, 9, 0)), // bugünün işi: BUGÜN listesinde
        sure('bitti', yerel(2026, 10, 1, 23, 59), true),
        sure('yarin', yerel(2026, 10, 10, 23, 59)),
      ],
      simdi,
    );
    expect(r.map((x) => [x.kayit.id, x.gecenGun])).toEqual([
      ['dun', 1],
      ['eski', 19],
    ]);
  });
});

describe('BUGÜN listesi gece yarısında yeni güne geçer', () => {
  // Kimlikler ekrandaki gibi önekli döner: duruşma 'h', süre 'd'.
  const durusmalar = [durusma('ertesi0100', yerel(2026, 10, 10, 1, 0)), durusma('ogle', yerel(2026, 10, 9, 14, 0))];
  const sureler = [sure('gece', yerel(2026, 10, 9, 23, 59)), sure('bitti', yerel(2026, 10, 9, 12, 0), true)];

  it('23:50’de bugünün duruşması ve süresi listede, saate göre; tamamlanan yok', () => {
    const r = bugunKayitlari(durusmalar, sureler, yerel(2026, 10, 9, 23, 50));
    expect(r.map((x) => x.id)).toEqual(['hogle', 'dgece']);
  });

  it('00:10’da liste yeni güne geçer (UTC’de hâlâ dün olan 01:00 duruşması bugündür)', () => {
    const r = bugunKayitlari(durusmalar, sureler, yerel(2026, 10, 10, 0, 10));
    expect(r.map((x) => x.id)).toEqual(['hertesi0100']);
  });
});

describe('Yükleniyor / hata durumu "boş" gibi gösterilmez', () => {
  it('veri yokken hata → hata (avukat "duruşmam yok" sanmasın)', () => {
    expect(veriDurumu({ data: undefined, isError: true })).toBe('hata');
  });

  it('veri yok, hata yok → yükleniyor', () => {
    expect(veriDurumu({ data: undefined, isError: false })).toBe('yukleniyor');
  });

  it('önbellekteki veri varken yenileme hatası → hazır (eldeki veri gösterilir)', () => {
    expect(veriDurumu({ data: [], isError: true })).toBe('hazir');
  });

  it('birden çok sorgu: biri hatalıysa hata, biri yükleniyorsa yükleniyor', () => {
    expect(veriDurumu({ data: [], isError: false }, { data: undefined, isError: true })).toBe('hata');
    expect(veriDurumu({ data: [], isError: false }, { data: undefined, isError: false })).toBe('yukleniyor');
    expect(veriDurumu({ data: [], isError: false }, { data: [], isError: false })).toBe('hazir');
  });
});

/**
 * BEKÇİ — panodaki useMemo blokları saati kendisi okumaz.
 *
 * Bulgu: "bugün", "sıradaki", "yaklaşan" hesapları useMemo içinde
 * `new Date()` / `Date.now()` okuyordu ama bağımlılıkları yalnız veriydi. Uygulama
 * açık kalınca (masaüstü sekmesi, arka plandan dönen telefon) gece yarısından
 * sonra dünün işleri "BUGÜN" diye kalıyordu; yenileme de kurtarmıyordu, çünkü
 * aynı veri aynı referansla döner. Saat tek yerden (useSimdi) gelir ve
 * bağımlılıklara girer.
 */
describe('bekçi: panodaki useMemo saati kendisi okumaz', () => {
  const kaynak = readFileSync(join(__dirname, '..', 'app/(app)/index.tsx'), 'utf8');

  /** `useMemo(` çağrılarının tam metni; yorum ve metin içindeki parantezler atlanır. */
  function memoBloklari(src: string): string[] {
    const bloklar: string[] = [];
    let i = src.indexOf('useMemo(');
    while (i !== -1) {
      let derinlik = 0;
      let j = i + 'useMemo'.length;
      let tirnak: string | null = null;
      for (; j < src.length; j++) {
        const c = src[j];
        if (tirnak) {
          if (c === '\\') j++;
          else if (c === tirnak) tirnak = null;
          continue;
        }
        if (c === '/' && src[j + 1] === '/') {
          j = src.indexOf('\n', j);
          continue;
        }
        if (c === '/' && src[j + 1] === '*') {
          j = src.indexOf('*/', j) + 1;
          continue;
        }
        if (c === "'" || c === '"' || c === '`') tirnak = c;
        else if (c === '(') derinlik++;
        else if (c === ')' && --derinlik === 0) break;
      }
      bloklar.push(src.slice(i, j + 1));
      i = src.indexOf('useMemo(', j);
    }
    return bloklar;
  }

  it('dosyada useMemo bulunuyor (bekçinin kendisi çalışıyor)', () => {
    expect(memoBloklari(kaynak).length).toBeGreaterThan(3);
  });

  it('hiçbir useMemo içinde new Date() ya da Date.now() yok', () => {
    const ihlal = memoBloklari(kaynak)
      .filter((b) => /Date\.now\(\)|new Date\(\)/.test(b))
      .map((b) => b.split('\n')[0]);
    expect(ihlal).toEqual([]);
  });

  // `const now = new Date()` gibi çizim anında okunan saat de memo'ya girince
  // aynı şekilde donuyordu (sıradaki duruşma, aylık finans). Ekran saati
  // YALNIZ useSimdi'den alır.
  it('ekran saati yalnız useSimdi’den alır (çıplak new Date() / Date.now() yok)', () => {
    const satirlar = kaynak
      .split('\n')
      .map((s, i) => [i + 1, s] as const)
      .filter(([, s]) => !/^\s*(\/\/|\*)/.test(s) && /Date\.now\(\)|new Date\(\)/.test(s))
      .map(([n, s]) => `${n}: ${s.trim()}`);
    expect(satirlar).toEqual([]);
    expect(kaynak).toMatch(/useSimdi\(\)/);
  });
});
