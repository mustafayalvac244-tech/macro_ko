import { describe, expect, it } from 'vitest';
import { bildirimMetni, type BildirimKaynagi } from '@/utils/bildirimMetni';

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
  altBaslik: 'Yılmaz v. Demir',
  anISO: '2026-10-01T09:00:00Z',
  hearingType: 'mediation',
};

const gorev: BildirimKaynagi = {
  baslik: 'İstinaf dilekçesi',
  altBaslik: 'Yılmaz v. Demir',
  anISO: '2026-10-01T09:00:00Z',
};

const soz: BildirimKaynagi = {
  baslik: 'Ahmet Yılmaz',
  altBaslik: '5.000,00 ₺ (2/12)',
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
  it('duruşma: türü etiketiyle anar, gövdede dava adı ve tarih olur', () => {
    const { title, body } = bildirimMetni('durusma', 'secilen', durusma, cevir, tarih);
    // "hepsine duruşma deme" kuralı: tür etiketi kayıttan gelir (arabuluculuk).
    expect(title).toBe('notif.hearingTitle(type=hearingType.mediation,title=Tanık dinlenmesi)');
    expect(body).toBe('Yılmaz v. Demir — 01.10.2026 09:00');
  });

  it('duruşma türü verilmemişse "hearing"e düşer', () => {
    const { title } = bildirimMetni('durusma', 'secilen', { ...durusma, hearingType: undefined }, cevir, tarih);
    expect(title).toContain('hearingType.hearing');
  });

  it('görev: deadline anahtarını kullanır', () => {
    expect(bildirimMetni('gorev', 'secilen', gorev, cevir, tarih).title).toBe(
      'notif.deadlineTitle(title=İstinaf dilekçesi)'
    );
  });

  it('ödeme sözü: gövdesi tutar + müvekkil, tarih DEĞİL', () => {
    const { body } = bildirimMetni('soz', 'secilen', soz, cevir, tarih);
    expect(body).toBe('notif.promiseBody(amount=5.000,00 ₺ (2/12),name=Ahmet Yılmaz)');
    expect(body).not.toContain('01.10.2026');
  });

  it('taksit işareti gövdede korunur', () => {
    expect(bildirimMetni('soz', 'secilen', soz, cevir, tarih).body).toContain('(2/12)');
  });
});

describe('duruşma sonrası sorusu', () => {
  it('aşama öneki ALMAZ ve kendi metnini taşır', () => {
    const { title, body } = bildirimMetni('durusma', 'sonuc', durusma, cevir, tarih);
    expect(title).toBe('notif.outcomeTitle(type=hearingType.mediation)');
    expect(body).toBe('notif.outcomeBody(title=Yılmaz v. Demir)');
    expect(title).not.toContain('notif.stage');
  });

  it('dava adı yoksa duruşma adına düşer', () => {
    const { body } = bildirimMetni('durusma', 'sonuc', { ...durusma, altBaslik: '' }, cevir, tarih);
    expect(body).toBe('notif.outcomeBody(title=Tanık dinlenmesi)');
  });
});
