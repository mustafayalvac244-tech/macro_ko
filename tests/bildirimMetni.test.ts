import { describe, expect, it } from 'vitest';
import { bildirimMetni, type BildirimKaynagi } from '@/utils/bildirimMetni';
import type { BildirimTuru, EtkinlikTuru } from '@/utils/bildirimPlani';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * BİLDİRİM METNİ.
 *
 * Aynı metin İKİ yoldan üretiliyor: kayıt oluşturulurken ve eşitleme kaydı
 * yeniden kurarken. İkisi ayrı yazıldığında sessizce ayrıştılar ve bu gerçekten
 * oldu: ödeme sözlerinde "⏰ 3 gün kaldı" öneki eşitleme yolunda hiç
 * uygulanmıyordu, yani vadeden üç gün önce çalan bildirim "💰 Ödeme günü: X"
 * diyor ve avukat ödemenin BUGÜN olduğunu sanıyordu. Metin artık tek yerden
 * üretiliyor ve aşağıdaki testler onu bağlıyor.
 */

// Sahte çeviri: anahtarı ve parametreleri görünür kılar (aiHata.test.ts kalıbı).
const cevir = (anahtar: string, p?: Record<string, string | number>) =>
  p ? `${anahtar}(${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(',')})` : anahtar;

const tarih = () => '01.10.2026 09:00';

const durusma: BildirimKaynagi = {
  baslik: 'Tanık dinlenmesi',
  anISO: '2026-10-01T09:00:00Z',
  hearingType: 'mediation',
};

const gorev: BildirimKaynagi = {
  baslik: 'İstinaf dilekçesi',
  anISO: '2026-10-01T09:00:00Z',
};

const soz: BildirimKaynagi = {
  // Çağıran taraf müvekkil adını yanlışlıkla başlık olarak verse bile metne girmemeli.
  baslik: 'Ahmet Yılmaz',
  tutar: '5.000,00 ₺ (2/12)',
  anISO: '2026-10-01T09:00:00Z',
};

describe('aşama öneki ÜÇ türe de uygulanır (düzeltilen kusur)', () => {
  it('ödeme sözünde 3 gün öneki uygulanır', () => {
    const { title } = bildirimMetni('soz', '3g', soz, cevir, tarih);
    expect(title).toContain('notif.stage3d');
    expect(title).toContain('notif.promiseTitle');
  });

  it('ödeme sözünde 1 gün öneki uygulanır', () => {
    expect(bildirimMetni('soz', '1g', soz, cevir, tarih).title).toContain('notif.stage1d');
  });

  it('duruşmada ve görevde de uygulanır', () => {
    expect(bildirimMetni('durusma', '3g', durusma, cevir, tarih).title).toContain('notif.stage3d');
    expect(bildirimMetni('gorev', '1g', gorev, cevir, tarih).title).toContain('notif.stage1d');
  });

  it('SEÇİLEN aşamada önek YOKTUR', () => {
    for (const [tur, kaynak] of [['durusma', durusma], ['gorev', gorev], ['soz', soz]] as const) {
      const { title } = bildirimMetni(tur, 'secilen', kaynak, cevir, tarih);
      expect(title, tur).not.toContain('notif.stage3d');
      expect(title, tur).not.toContain('notif.stage1d');
    }
  });
});

describe('tür başına doğru anahtar ve gövde', () => {
  it('duruşma: türü etiketiyle anar, gövdede yalnız tarih olur', () => {
    const { title, body } = bildirimMetni('durusma', 'secilen', durusma, cevir, tarih);
    // "hepsine duruşma deme" kuralı: tür etiketi kayıttan gelir (arabuluculuk).
    expect(title).toBe('notif.hearingTitle(type=hearingType.mediation,title=Tanık dinlenmesi)');
    expect(body).toBe('notif.eventBody(date=01.10.2026 09:00)');
  });

  it('duruşma türü verilmemişse "hearing"e düşer', () => {
    const { title } = bildirimMetni('durusma', 'secilen', { ...durusma, hearingType: undefined }, cevir, tarih);
    expect(title).toContain('hearingType.hearing');
  });

  it('görev: deadline anahtarını kullanır', () => {
    expect(bildirimMetni('gorev', 'secilen', gorev, cevir, tarih).title).toBe(
      'notif.deadlineTitle(title=İstinaf dilekçesi)'
    );
    expect(bildirimMetni('gorev', 'secilen', gorev, cevir, tarih).body).toBe('notif.eventBody(date=01.10.2026 09:00)');
  });

  it('ödeme sözü: gövdesi tutar (taksit işaretiyle), tarih DEĞİL', () => {
    const { title, body } = bildirimMetni('soz', 'secilen', soz, cevir, tarih);
    expect(title).toBe('notif.promiseTitle');
    expect(body).toBe('notif.promiseBody(amount=5.000,00 ₺ (2/12))');
    expect(body).not.toContain('01.10.2026');
  });
});

describe('duruşma sonrası sorusu', () => {
  it('aşama öneki ALMAZ ve kendi metnini taşır', () => {
    const { title, body } = bildirimMetni('durusma', 'sonuc', durusma, cevir, tarih);
    expect(title).toBe('notif.outcomeTitle(type=hearingType.mediation)');
    expect(body).toBe('notif.outcomeBody(date=01.10.2026 09:00)');
    expect(title).not.toContain('notif.stage');
  });
});

/**
 * KİLİT EKRANINDA MÜVEKKİL ADI (09.10.2026 denetimi, kodla doğrulandı).
 *
 * Bildirim kilit ekranında, telefonun kilidi açılmadan görünür. Önceki metin
 * ödeme sözünde müvekkilin ADINI ("💰 Ödeme günü: Ahmet Yılmaz"), duruşma ve
 * görevde DAVA ADINI yazıyordu — dava adı formun kendi örneğinde bile taraf
 * adlarıdır ('Yılmaz / Demir İnşaat A.Ş.', caseForm.caseTitlePlaceholder).
 * Masada duran telefondan sır saklama yükümlüsü bilgisi okunuyordu.
 */
describe('kilit ekranı: müvekkil ve dava adı metne girmez', () => {
  const turler: [EtkinlikTuru, BildirimTuru, BildirimKaynagi][] = [
    ['soz', 'secilen', soz],
    ['soz', '3g', soz],
    ['soz', '1g', soz],
  ];

  it('ödeme sözünün hiçbir aşamasında müvekkil adı geçmez', () => {
    for (const [tur, asama, kaynak] of turler) {
      const { title, body } = bildirimMetni(tur, asama, kaynak, cevir, tarih);
      expect(`${title} ${body}`, asama).not.toContain('Ahmet');
    }
  });

  it('gerçek çeviri metinleri ad/dava adı yer tutucusu taşımaz (tr + en)', () => {
    for (const sozluk of [tr, en]) {
      expect(sozluk['notif.promiseTitle']).not.toMatch(/\{name\}|\{title\}/);
      expect(sozluk['notif.promiseBody']).not.toMatch(/\{name\}|\{title\}/);
      expect(sozluk['notif.outcomeBody']).not.toMatch(/\{name\}|\{title\}/);
      expect(sozluk['notif.eventBody']).toContain('{date}');
      expect(sozluk['notif.eventBody']).not.toMatch(/\{name\}|\{title\}/);
    }
  });

  it('ödeme sözü gövdesi "bugün" demez — 3 gün kala çalan bildirimde yanlış olurdu', () => {
    expect(tr['notif.promiseBody'].toLocaleLowerCase('tr')).not.toContain('bugün');
    expect(en['notif.promiseBody'].toLowerCase()).not.toContain('today');
  });
});
