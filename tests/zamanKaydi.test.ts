import { describe, expect, it } from 'vitest';
import {
  AZAMI_DAKIKA,
  dakikaBicimle,
  gecenDakika,
  gecenSureMetni,
  dosyayaGoreOzet,
  saateCevir,
  sureAyristir,
  tutarHesapla,
  zamanOzeti,
} from '../src/utils/zamanKaydi';

/**
 * BU SINAVI BEN YAZDIM. Beklenen değerleri de ben seçtim, dolayısıyla bu
 * testler "ayrıştırıcı avukatın yazdığı her şeyi doğru okuyor" demez —
 * yalnız "benim tanımladığım kuralı uyguluyor" der. Gerçek doğrulama,
 * avukatın kendi yazdığı süreleri girmesiyle olur.
 */
describe('sureAyristir', () => {
  it('düz tamsayıyı DAKİKA sayar', () => {
    expect(sureAyristir('90')).toBe(90);
    expect(sureAyristir('45')).toBe(45);
    expect(sureAyristir(' 30 ')).toBe(30);
  });

  it('ondalığı SAAT sayar — "1,5" 90 dakikadır, 1 dakika değil', () => {
    expect(sureAyristir('1,5')).toBe(90);
    expect(sureAyristir('1.5')).toBe(90);
    expect(sureAyristir('0,25')).toBe(15);
    expect(sureAyristir('2.75')).toBe(165);
  });

  it('saat:dakika biçimini okur', () => {
    expect(sureAyristir('1:30')).toBe(90);
    expect(sureAyristir('0:45')).toBe(45);
    expect(sureAyristir('10:05')).toBe(605);
  });

  it('bozuk saat:dakika reddedilir — 1:75 diye bir süre yoktur', () => {
    expect(sureAyristir('1:75')).toBeNull();
    expect(sureAyristir('1:99')).toBeNull();
  });

  it('birimli yazımları okur (tr ve en)', () => {
    expect(sureAyristir('2s')).toBe(120);
    expect(sureAyristir('2sa')).toBe(120);
    expect(sureAyristir('2 saat')).toBe(120);
    expect(sureAyristir('2h')).toBe(120);
    expect(sureAyristir('45dk')).toBe(45);
    expect(sureAyristir('45 d')).toBe(45);
    expect(sureAyristir('45m')).toBe(45);
  });

  it('saat + dakika kuyruğunu okur', () => {
    expect(sureAyristir('1s30')).toBe(90);
    expect(sureAyristir('1sa 30dk')).toBe(90);
    expect(sureAyristir('2h15m')).toBe(135);
  });

  it('anlaşılmayan girdide null döner — 0 DÖNMEZ', () => {
    // 0 dönseydi form onu geçerli bir süre sanıp "sıfır dakika" kaydederdi.
    expect(sureAyristir('')).toBeNull();
    expect(sureAyristir('abc')).toBeNull();
    expect(sureAyristir('-30')).toBeNull();
    expect(sureAyristir('0')).toBeNull();
  });

  it('bir günü aşan süreyi reddeder (parmak hatası koruması)', () => {
    expect(sureAyristir(String(AZAMI_DAKIKA))).toBe(AZAMI_DAKIKA);
    expect(sureAyristir(String(AZAMI_DAKIKA + 1))).toBeNull();
    expect(sureAyristir('25s')).toBeNull();
  });
});

describe('dakikaBicimle', () => {
  it('saat ve dakikayı kısa yazar', () => {
    expect(dakikaBicimle(135)).toBe('2 sa 15 dk');
    expect(dakikaBicimle(120)).toBe('2 sa');
    expect(dakikaBicimle(45)).toBe('45 dk');
    expect(dakikaBicimle(0)).toBe('0 dk');
  });
});

describe('saateCevir', () => {
  it('iki basamağa yuvarlar', () => {
    expect(saateCevir(135)).toBe(2.25);
    expect(saateCevir(50)).toBe(0.83);
  });
});

describe('tutarHesapla', () => {
  it('saatlik ücreti dakikaya orantılar', () => {
    expect(tutarHesapla({ minutes: 60, billable: true, hourly_rate: 3000 })).toBe(3000);
    expect(tutarHesapla({ minutes: 90, billable: true, hourly_rate: 3000 })).toBe(4500);
    expect(tutarHesapla({ minutes: 20, billable: true, hourly_rate: 1500 })).toBe(500);
  });

  it('ücretlendirilmeyen ya da ücretsiz kayıt 0 verir — NULL değil', () => {
    expect(tutarHesapla({ minutes: 60, billable: false, hourly_rate: 3000 })).toBe(0);
    expect(tutarHesapla({ minutes: 60, billable: true, hourly_rate: null })).toBe(0);
  });

  it('kuruşta kayan nokta hatası bırakmaz', () => {
    // 0,1 + 0,2 tuzağının parasal karşılığı: 7 dakika × 1234,56 ₺/sa
    const t = tutarHesapla({ minutes: 7, billable: true, hourly_rate: 1234.56 });
    expect(t).toBe(144.03);
    expect(Number.isInteger(Math.round(t * 100))).toBe(true);
  });
});

describe('çalışan sayaç', () => {
  const dk = 60_000;

  it('geçen süreyi YUKARI yuvarlar ve asla 0 dönmez', () => {
    // 40 saniyelik çalışma 0 dk kaydedilemez: göçteki `minutes > 0` kısıtı
    // reddeder ve sıfır yazmak kaydı hiç tutmamakla aynı kapıya çıkar.
    const t0 = 1_000_000;
    expect(gecenDakika(t0, t0 + 40_000)).toBe(1);
    expect(gecenDakika(t0, t0)).toBe(1);
    expect(gecenDakika(t0, t0 + 61_000)).toBe(2);
    expect(gecenDakika(t0, t0 + 45 * dk)).toBe(45);
  });

  it('geçmişe giden saat farkında negatif süre üretmez', () => {
    const t0 = 1_000_000;
    expect(gecenDakika(t0, t0 - 10 * dk)).toBe(1);
  });

  it('uygulama kapalıyken geçen süre de sayılır', () => {
    // Sayaç geçen süreyi değil BAŞLANGIÇ DAMGASINI saklıyor. Bu test o
    // kararı koruyor: arka planda JS zamanlayıcısı dursa bile fark okunurken
    // hesaplandığı için süre doğru işler.
    const basla = 1_000_000;
    const ikiSaatSonraAcildi = basla + 120 * dk;
    expect(gecenDakika(basla, ikiSaatSonraAcildi)).toBe(120);
  });

  it('sayaç metni bir saatin altında dk:sn, üstünde sa:dk:sn gösterir', () => {
    const t0 = 1_000_000;
    expect(gecenSureMetni(t0, t0 + 5_000)).toBe('00:05');
    expect(gecenSureMetni(t0, t0 + 90_000)).toBe('01:30');
    expect(gecenSureMetni(t0, t0 + 3_725_000)).toBe('1:02:05');
  });
});

describe('zamanOzeti', () => {
  const kayitlar = [
    { minutes: 60, billable: true, hourly_rate: 2000 },
    { minutes: 30, billable: true, hourly_rate: 2000 },
    { minutes: 45, billable: false, hourly_rate: 2000 },
    { minutes: 90, billable: true, hourly_rate: null },
  ];

  it('toplam süre ücretsiz kayıtları da kapsar', () => {
    expect(zamanOzeti(kayitlar).toplamDakika).toBe(225);
  });

  it('ücretli süre yalnız billable kayıtları toplar', () => {
    expect(zamanOzeti(kayitlar).ucretliDakika).toBe(180);
  });

  it('tutar yalnız ücreti girilmiş kayıtlardan gelir', () => {
    expect(zamanOzeti(kayitlar).toplamTutar).toBe(3000);
  });

  it('ücreti girilmemiş ama ücretlendirilecek kayıtları sayar', () => {
    // Bu sayı ekranda uyarı olarak gösteriliyor: o 90 dakika toplam tutarda
    // GÖRÜNMÜYOR ve fark edilmezse eksik fatura kesilir.
    expect(zamanOzeti(kayitlar).ucretsizKalan).toBe(1);
  });

  it('dosyaya göre özet, en çok süreden aza sıralar', () => {
    const satirlar = dosyayaGoreOzet([
      { case_id: 'a', cases: { id: 'a', title: 'Kira' }, minutes: 30, billable: true, hourly_rate: 2000 },
      { case_id: 'b', cases: { id: 'b', title: 'Boşanma' }, minutes: 120, billable: true, hourly_rate: 2000 },
      { case_id: 'a', cases: { id: 'a', title: 'Kira' }, minutes: 45, billable: true, hourly_rate: 2000 },
    ]);
    expect(satirlar.map((s) => s.baslik)).toEqual(['Boşanma', 'Kira']);
    expect(satirlar[1].toplamDakika).toBe(75);
    expect(satirlar[1].toplamTutar).toBe(2500);
  });

  it('dosyasız kayıtlar ATILMAZ, ayrı satırda toplanır', () => {
    // Atılsalardı "dosyalar toplam 1 saat ama ben 3 saat çalıştım" farkı
    // açıklanamaz kalırdı.
    const satirlar = dosyayaGoreOzet([
      { case_id: 'a', cases: { id: 'a', title: 'Kira' }, minutes: 60, billable: true, hourly_rate: null },
      { case_id: null, cases: null, minutes: 120, billable: false, hourly_rate: null },
    ]);
    expect(satirlar).toHaveLength(2);
    const dosyasiz = satirlar.find((s) => s.caseId === null);
    expect(dosyasiz?.baslik).toBeNull();
    expect(dosyasiz?.toplamDakika).toBe(120);
  });

  it('ilişki geç yüklenmiş kayıttan başlığı toplar', () => {
    const satirlar = dosyayaGoreOzet([
      { case_id: 'a', cases: null, minutes: 10, billable: true, hourly_rate: null },
      { case_id: 'a', cases: { id: 'a', title: 'Kira' }, minutes: 10, billable: true, hourly_rate: null },
    ]);
    expect(satirlar[0].baslik).toBe('Kira');
  });

  it('boş listede sıfırlar döner, NaN dönmez', () => {
    const o = zamanOzeti([]);
    expect(o).toEqual({
      adet: 0,
      toplamDakika: 0,
      ucretliDakika: 0,
      toplamTutar: 0,
      ucretsizKalan: 0,
    });
  });
});
