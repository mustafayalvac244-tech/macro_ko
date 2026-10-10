import { describe, expect, it } from 'vitest';
import { computeKapak } from '@/utils/kapak';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * İCRA TAKİBİ — SINIR DURUMLAR (10.10.2026, 50 denetçi taraması, ajan 18).
 *
 * Aşağıdaki kusurlar kodla doğrulandı; her test önce DÜŞTÜ, sonra düzeltildi.
 * Beklenen değerler ELDE hesaplandı (koddan türetilmedi).
 */

const dosya = (o: Partial<Parameters<typeof computeKapak>[0]> = {}) => ({
  principal: 100000,
  pre_interest: 0,
  interest_rate: 36,
  start_date: '2026-01-01',
  expenses: 5000,
  attorney_fee: 10000,
  ...o,
});

describe('computeKapak — gelecek tarihli tahsilat', () => {
  it('bugünkü kapağı düşürmez ve faizi o tarihe kadar işletmez', () => {
    // Eskiden 2026-12-31 tarihli ödeme, 2026-07-01 kapağından düşülüyor ve faiz
    // 31 Aralık'a kadar işletilip "tahsil edildi" sayılıyordu.
    const bugun = new Date('2026-07-01T00:00:00');
    const yok = computeKapak(dosya(), [], bugun);
    const gelecek = computeKapak(dosya(), [{ amount: 50000, collected_at: '2026-12-31' }], bugun);
    expect(gelecek.remaining).toBe(yok.remaining);
    expect(gelecek.collected).toBe(0);
    expect(gelecek.accruedInterest).toBe(yok.accruedInterest);
  });

  it('bugün tarihli tahsilat sayılır (sınır: aynı gün dahil)', () => {
    const r = computeKapak(
      dosya({ interest_rate: 0 }),
      [{ amount: 15000, collected_at: '2026-07-01' }],
      new Date('2026-07-01T10:30:00')
    );
    expect(r.collected).toBe(15000);
    expect(r.remainingExpenses).toBe(0);
  });
});

describe('computeKapak — gün sayısı', () => {
  it('yaz saati geçen bir saat diliminde gün kaymaz (1 Mart → 1 Nisan = 31 gün)', () => {
    // Milisaniye farkını 24 saate bölüp tabana yuvarlamak, saatlerin ileri
    // alındığı ayda (Mart) bir günü yiyordu: 31 gün → 30 gün. Türkiye'de yaz
    // saati yok, ama web sürümü başka saat dilimindeki tarayıcıda da açılır.
    const eski = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
    try {
      const r = computeKapak(
        dosya({ start_date: '2026-03-01', expenses: 0, attorney_fee: 0 }),
        [],
        new Date('2026-04-01T00:00:00')
      );
      // 100.000 × 0,36 × 31 / 365 = 3.057,53
      expect(r.accruedInterest).toBeCloseTo(3057.53, 2);
    } finally {
      if (eski === undefined) delete process.env.TZ;
      else process.env.TZ = eski;
    }
  });

  it('ARTIK YIL: yıl 365 gün varsayılır; 366 günlük dönem 1 yıldan biraz fazla faiz işler', () => {
    // 01.01.2024 → 01.01.2025 = 366 gün. Kural (gün/365) belgelenmiş bir
    // VARSAYIMDIR; artık yılda /366 uygulayan hesaplar farklı çıkar. Bu test
    // varsayımı sabitler ki sessizce değişmesin (ürün sahibi kararı bekliyor).
    const r = computeKapak(
      dosya({ start_date: '2024-01-01', expenses: 0, attorney_fee: 0 }),
      [],
      new Date('2025-01-01T00:00:00')
    );
    // 100.000 × 0,36 × 366 / 365 = 36.098,63
    expect(r.accruedInterest).toBeCloseTo(36098.63, 2);
  });
});

describe('computeKapak — kuruş', () => {
  it('kalan kalemlerin toplamı toplam kapağa TAM eşittir', () => {
    // Eskiden her kalem ayrı, toplam ayrı yuvarlanıyordu: bu dosyada kalemler
    // 16.811,43 topluyor, ekrandaki toplam 16.811,44 gösteriyordu (1 kuruş).
    const r = computeKapak(
      {
        principal: 16838.62,
        pre_interest: 4.857142857142857,
        interest_rate: 7.6,
        start_date: '2026-01-01',
        expenses: 6.37,
        attorney_fee: 1000.11,
      },
      [
        { amount: 1236.56, collected_at: '2026-03-15' },
        { amount: 777.77, collected_at: '2026-06-01' },
      ],
      new Date('2026-10-10T10:00:00')
    );
    const kalemler = Math.round((r.remainingExpenses + r.remainingInterest + r.remainingPrincipal) * 100) / 100;
    expect(r.remaining).toBe(kalemler);
  });

  it('tanımlı aralıkta 300 dosyada kalemler hep toplama eşit', () => {
    for (let i = 0; i < 300; i++) {
      const r = computeKapak(
        {
          principal: 1000 + ((i * 7919) % 500000) + ((i * 31) % 100) / 100,
          pre_interest: ((i * 17) % 5000) / 7,
          interest_rate: 5 + ((i * 13) % 600) / 10,
          start_date: '2026-01-01',
          expenses: ((i * 3) % 900) + 0.37,
          attorney_fee: 1000.11,
        },
        [
          { amount: 1234.56 + (i % 50), collected_at: '2026-03-15' },
          { amount: 777.77, collected_at: '2026-06-01' },
        ],
        new Date('2026-10-10T10:00:00')
      );
      const kalemler = Math.round((r.remainingExpenses + r.remainingInterest + r.remainingPrincipal) * 100) / 100;
      expect(r.remaining, `dosya #${i}`).toBe(kalemler);
    }
  });
});

describe('kapak ekran metni — hukuki dayanak ve varsayım', () => {
  it('"İİK 138" demez: 138 çok alacaklılı satış bedeli paylaştırmasıdır, tek alacaklının ödeme sırası değil', () => {
    expect(tr['enf.interestInfo']).not.toMatch(/138/);
    expect(en['enf.interestInfo']).not.toMatch(/138/);
    expect(tr['enf.interestInfo']).toMatch(/TBK/);
  });

  it('tek oran ve 365 gün varsayımını AÇIKÇA söyler', () => {
    expect(tr['enf.interestInfo']).toMatch(/tek oran/i);
    expect(tr['enf.interestInfo']).toMatch(/365/);
    expect(en['enf.interestInfo']).toMatch(/single rate/i);
    expect(en['enf.interestInfo']).toMatch(/365/);
  });
});
