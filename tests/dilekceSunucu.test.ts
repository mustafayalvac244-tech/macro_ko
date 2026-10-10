import { describe, expect, it } from 'vitest';
import {
  dilekceDenetimKaynagi,
  dilekceyiDiz,
  hesaplananTarihler,
  tarihAnahtarlari,
  tutarlariCikar,
  uydurmaTarihleriAyikla,
  uydurmaTutarlariBul,
} from '../supabase/functions/_shared/dilekce';
import { dosyaKunyesiOku } from '../supabase/functions/_shared/dosyaKunyesi';
import { hukukiKonuSec } from '../supabase/functions/_shared/hukukiKonu';
import { tarihler, tutarlar } from '../scripts/uydurma.mjs';

/**
 * DİLEKÇE SUNUCUSU — 08.10 denetiminde bulunan, 09.10'da kodla doğrulanan
 * kusurlar. Her blok bir kusuru, kusurlu davranışı yakalayan testle sabitler.
 */

// ── Sahte istemci ────────────────────────────────────────────────────────────
// Canlıdaki RLS ölçüldü (09.10, pg_policies): profiles'ta "profiles readable by
// authenticated" (auth.role() = 'authenticated') duruyor, yani oturumlu her
// avukat TÜM profil satırlarını görür. Sahte istemci bunu taklit eder: filtre
// verilmezse bütün satırlar döner. maybeSingle() birden çok satırda
// postgrest-js gibi davranır: data null, hata PGRST116.
type Satir = Record<string, unknown>;
function sahteDb(tablolar: Record<string, Satir[]>) {
  return {
    from(tablo: string) {
      const filtre: Array<[string, unknown]> = [];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filtre.push([k, v]);
          return q;
        },
        maybeSingle: async () => {
          const satirlar = (tablolar[tablo] ?? []).filter((s) => filtre.every(([k, v]) => s[k] === v));
          if (satirlar.length > 1) return { data: null, error: { code: 'PGRST116' } };
          return { data: satirlar[0] ?? null, error: null };
        },
      };
      return q;
    },
  };
}

const PROFILLER: Satir[] = [
  { id: 'u-baska', full_name: 'Zeynep Kaya', baro: 'İzmir Barosu', bar_number: '111', firm_name: 'Kaya Hukuk' },
  { id: 'u-ben', full_name: 'Ali Demir', baro: 'Ankara Barosu', bar_number: '222', firm_name: '' },
];

describe('vekil profili yalnız çağıranın kendi satırından okunur (bulgu 3)', () => {
  it('başka avukatlar da görünürken imza/vekil satırı çağıranın adıyla dolar', async () => {
    const out = await dosyaKunyesiOku(sahteDb({ profiles: PROFILLER }), 'u-ben', null, 'dava');
    expect(out.VEKILI).toBe('Av. Ali Demir — Ankara Barosu');
    expect(JSON.stringify(out)).not.toContain('Zeynep');
  });

  it('kullanıcının profili yoksa başkasınınki yazılmaz', async () => {
    const out = await dosyaKunyesiOku(sahteDb({ profiles: [PROFILLER[0]] }), 'u-ben', null, 'dava');
    expect(out.VEKILI).toBeUndefined();
  });
});

describe('dosya kaydındaki tarihler dilekçeden silinmez (bulgu 1)', () => {
  const db = sahteDb({
    profiles: PROFILLER,
    cases: [{
      id: 'd1', client_id: 'm1', case_number: '2025/123', court_name: 'ANKARA 3. İŞ MAHKEMESİ',
      opposing_party: 'Örnek A.Ş.', decision_number: '2026/45',
      decision_date: '2026-05-12', decision_served_date: '2026-06-10',
    }],
    clients: [{ id: 'm1', full_name: 'Veli Can', company: null, address: '', title: null, tc_no: '' }],
  });
  const bloklar = {
    KONU: 'Kıdem tazminatı talebinin reddine ilişkin kararın kaldırılması',
    ACIKLAMALAR: 'Mahkeme tanıkları dinlemeden karar vermiştir.',
    SEBEPLER: 'HMK m.353',
    DELILLER: 'Tanık beyanları',
    TALEP: 'Kararın kaldırılmasına karar verilmesini talep ederiz.',
  };
  // Avukat tarihleri anlatıma YAZMADI: kayıtta zaten var.
  const olay = 'İş mahkemesi kıdem tazminatı talebimizi reddetti, istinaf dilekçesi hazırlayalım.';

  it('künye kayıttaki karar ve tebliğ tarihini taşır', async () => {
    const dosya = await dosyaKunyesiOku(db, 'u-ben', 'd1', 'istinaf');
    expect(dosya.TEBLIGTARIHI).toBe('10.06.2026');
    expect(dosya.KARAR).toContain('12.05.2026');
  });

  it('tarih denetiminin kaynağı kayıt değerlerini de içerir; tarihler kalır', async () => {
    const dosya = await dosyaKunyesiOku(db, 'u-ben', 'd1', 'istinaf');
    const { metin } = dilekceyiDiz('istinaf', bloklar, dosya);
    // Kusurun kendisi: kaynak yalnız anlatım olursa kayıt tarihleri "uydurma" sayılır.
    expect(uydurmaTarihleriAyikla(metin, olay).ayiklanan).toBe(2);

    const temiz = uydurmaTarihleriAyikla(metin, dilekceDenetimKaynagi(olay, dosya));
    expect(temiz.ayiklanan).toBe(0);
    expect(temiz.metin).toContain('TEBLİĞ TARİHİ : 10.06.2026');
    expect(temiz.metin).toContain('12.05.2026');
  });

  it('kayıtta da anlatımda da olmayan tarih yine çıkarılır', async () => {
    const dosya = await dosyaKunyesiOku(db, 'u-ben', 'd1', 'istinaf');
    const temiz = uydurmaTarihleriAyikla('İhtar 30.09.2026 tarihinde çekilmiştir.', dilekceDenetimKaynagi(olay, dosya));
    expect(temiz.ayiklanan).toBe(1);
    expect(temiz.metin).toBe('İhtar [tarih — doldurun] tarihinde çekilmiştir.');
  });

  it('dosya boşsa kaynak anlatımın aynısıdır', () => {
    expect(dilekceDenetimKaynagi(olay, {})).toBe(olay);
  });
});

describe('ay adıyla yazılmış tarih tanınır (bulgu 2)', () => {
  it('anlatımda "10 Haziran 2026", taslakta 10.06.2026 → silinmez', () => {
    const r = uydurmaTarihleriAyikla(
      'Gerekçeli karar 10.06.2026 tarihinde tebliğ edilmiştir.',
      'Gerekçeli karar 10 Haziran 2026 günü tebliğ edildi.'
    );
    expect(r.ayiklanan).toBe(0);
    expect(r.metin).toContain('10.06.2026');
  });

  it('büyük harf, Türkçe harf ve tek haneli gün', () => {
    expect(uydurmaTarihleriAyikla('05.06.2026 ve 01.08.2026', 'TEBLİĞ 5 HAZİRAN 2026, ihtar 1 Ağustos 2026').ayiklanan).toBe(0);
    expect(uydurmaTarihleriAyikla('02.05.2026', 'ödeme 2 mayıs 2026’da yapıldı').ayiklanan).toBe(0);
  });

  it('taslakta ay adıyla yazılmış UYDURMA tarih de çıkarılır', () => {
    // Ölçülen arızanın (uydurma "01.02.2026 tarihli sözleşme") ay adlı yazılışı
    // denetimden geçiyordu: desen yalnız gg.aa.yyyy tanıyordu.
    const r = uydurmaTarihleriAyikla('Kira sözleşmesi 1 Şubat 2026 tarihlidir.', 'Kiracı Mart-Mayıs kiralarını ödemedi.');
    expect(r.ayiklanan).toBe(1);
    expect(r.metin).toBe('Kira sözleşmesi [tarih — doldurun] tarihlidir.');
  });

  it('taslakta ay adıyla, anlatımda sayıyla yazılan aynı tarih korunur', () => {
    expect(uydurmaTarihleriAyikla("Karar 10 Haziran 2026'da tebliğ edildi.", 'tebliğ 10.06.2026').ayiklanan).toBe(0);
  });

  it('ay adı olmayan sözcük tarih sayılmaz', () => {
    const r = uydurmaTarihleriAyikla('Dosyada 3 adet 2026 tarihli belge var.', '');
    expect(r.ayiklanan).toBe(0);
  });

  it('mütalaa işaretlemesi de aynı tanımayı kullanır', () => {
    expect(hesaplananTarihler('Fesih 14.04.2026; süre 14 Mayıs 2026 günü dolar.', 'Fesih 14 Nisan 2026 tarihinde yapıldı.'))
      .toEqual(['14 Mayıs 2026']);
  });
});

describe('tutar ayrıştırıcı madde numarasını tutara yapıştırmaz (bulgu 4)', () => {
  it('"1. 50.000 TL" → 50.000', () => {
    expect([...tutarlariCikar('1. 50.000 TL asıl alacak')]).toEqual([50000]);
  });

  it('boşlukla ayrılmış sayı ve tarih tutara karışmaz', () => {
    expect([...tutarlariCikar('Madde 3 47.500 TL')]).toEqual([47500]);
    expect([...tutarlariCikar('10.06.2026 50.000 TL')]).toEqual([50000]);
    expect([...tutarlariCikar('2) 12.000 TL kira')]).toEqual([12000]);
  });

  it('geçerli yazılışlar çalışmaya devam eder', () => {
    expect([...tutarlariCikar('1.250.000,50 TL')]).toEqual([1250000.5]);
    expect([...tutarlariCikar('12 000 TL')]).toEqual([12000]);
    expect([...tutarlariCikar('36.000,00 TL')]).toEqual([36000]);
    expect([...tutarlariCikar('250.000 ₺ ve 40.000 Türk Lirası')]).toEqual([250000, 40000]);
    expect([...tutarlariCikar('1500 TL')]).toEqual([1500]);
  });

  it('numaralı talepteki doğru tutar uydurma sayılmaz', () => {
    expect(uydurmaTutarlariBul('1. 47.500 TL asıl alacağın tahsiline', 'borç 47.500 TL')).toEqual([]);
  });
});

describe('sunucu ile ölçüm betiği ayrışmıyor (tarih, tutar)', () => {
  // scripts/uydurma.mjs (ölçüm) ile _shared/dilekce.ts (ürün) aynı şeyi
  // saymalı; ayrışırsa ölçüm ürünün yaptığını ölçmez.
  const ornekler = [
    '1. 50.000 TL asıl alacak, 2. 12 000 TL faiz',
    'Madde 3 47.500 TL; 10.06.2026 50.000 TL',
    '36.000,00 TL ve 250.000 ₺ ve 40.000 Türk Lirası',
    'karar 10 Haziran 2026, tebliğ 05.06.2026, 2026-02-01 ve 1/2/2026',
    'TEBLİĞ 5 HAZİRAN 2026; 3 adet 2026; HMK m.119/1-d',
    '',
  ];

  it('tutar', () => {
    for (const m of ornekler) expect([...tutarlariCikar(m)], m).toEqual([...tutarlar(m)]);
  });

  it('tarih', () => {
    for (const m of ornekler) expect([...tarihAnahtarlari(m)].sort(), m).toEqual([...tarihler(m)].sort());
  });
});

describe('canlı içtihat aramasına anlatım değil sabit hukuki konu gider (bulgu 6)', () => {
  const konular = [
    'alacak davası',
    'kıdem ve ihbar tazminatı',
    'ihbar tazminatı',
    'yargitay:kıdem ve ihbar tazminatı alacağı',
    'kira tespit davası',
    'ara',
  ];

  it('anlatımdaki en belirgin konuyu döner; anlatımdan hiçbir parça dönmez', () => {
    const olay = 'Müvekkil Ahmet Yılmaz (T.C. 12345678901) Ankara’daki işyerinden çıkarıldı, kıdem ve ihbar tazminatı ödenmedi.';
    const terim = hukukiKonuSec(olay, konular);
    expect(terim).toBe('kıdem ve ihbar tazminatı');
    expect(konular).toContain(terim);
  });

  it('eşleşen konu yoksa null — canlı arama yapılmaz', () => {
    expect(hukukiKonuSec('Kiracı iki aydır ödeme yapmıyor, ihtar çekeceğiz.', konular)).toBeNull();
    expect(hukukiKonuSec('', konular)).toBeNull();
  });

  it('önekli (yargitay:/danistay:) ve dört harften kısa çekirdekli terimleri almaz', () => {
    expect(hukukiKonuSec('ara karar verildi', konular)).toBeNull();
    expect(hukukiKonuSec('kıdem ve ihbar tazminatı alacağı', ['yargitay:kıdem ve ihbar tazminatı alacağı'])).toBeNull();
  });

  it('Türkçe büyük harf ve "davası" eki (0162 çekirdeği gibi)', () => {
    expect(hukukiKonuSec('KIDEM VE İHBAR TAZMİNATI talep ediyoruz', konular)).toBe('kıdem ve ihbar tazminatı');
    expect(hukukiKonuSec('kira tespiti istiyoruz', konular)).toBe('kira tespit davası');
  });
});
