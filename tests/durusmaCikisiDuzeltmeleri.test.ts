import { describe, expect, it } from 'vitest';
import {
  ayniDurusmaVarMi,
  ayniSureVarMi,
  gunSonu,
  kayittanSonra,
  planDeadline,
  sonrakiSira,
  tebligatTakipTarihi,
  varsayilanSonrakiDurusma,
} from '@/utils/hearingOutcome';
import { briefIstemi } from '@/utils/briefIstemi';
import { adlariRolleCevir } from '@/utils/yapayZekaMaskesi';

/**
 * DURUŞMA ÇIKIŞI — 08.10 denetçi bulguları (10.10.2026).
 * Saf mantık; ağ ve ekran yok.
 */

const yerel = (iso: string, saat = '10:15') => new Date(`${iso}T${saat}:00`);
const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('Bulgu 5 — süre kaydının saati gün sonu (23:59), deadline-form ile aynı', () => {
  // Eskiden süre, duruşmanın saatiyle (ör. 10:15) ya da tebliğ tarihini seçtiğin
  // ANIN saatiyle kaydediliyordu. Kanuni süre gün sonuna kadardır; "saat 10:15'te
  // doldu" diye hatırlatma/sıralama yanlış kurulurdu.
  it('gunSonu yerel günü korur, 23:59 yapar', () => {
    const g = gunSonu(yerel('2026-03-24', '10:15'));
    expect(ymd(g)).toBe('2026-03-24');
    expect([g.getHours(), g.getMinutes(), g.getSeconds()]).toEqual([23, 59, 0]);
  });

  it('hâkimin verdiği süre (duruşma + 14) gün sonunda biter', () => {
    const p = planDeadline('sure_verildi', yerel('2026-03-10', '10:15'));
    expect(ymd(p!.dueAt)).toBe('2026-03-24');
    expect([p!.dueAt.getHours(), p!.dueAt.getMinutes()]).toEqual([23, 59]);
  });

  it('bilirkişi itirazı (rapor tebliği + 14) gün sonunda biter', () => {
    const p = planDeadline('bilirkisi_itiraz', yerel('2026-03-10'), yerel('2026-02-28', '03:20'));
    expect(ymd(p!.dueAt)).toBe('2026-03-14');
    expect([p!.dueAt.getHours(), p!.dueAt.getMinutes()]).toEqual([23, 59]);
  });

  it('kanun yolu süresi tebliğ saatine değil gün sonuna bağlanır', () => {
    // Tebliğ tarihi seçicisi "şimdi"nin saatini taşır; eskiden son gün 02:40'ta bitiyordu.
    const p = planDeadline('karar_aciklandi', yerel('2026-03-10'), yerel('2026-04-01', '02:40'));
    expect(ymd(p!.dueAt)).toBe('2026-04-15');
    expect([p!.dueAt.getHours(), p!.dueAt.getMinutes()]).toEqual([23, 59]);
  });

  it('tebligat takip işi duruşma + 14 gün, gün sonu', () => {
    const w = tebligatTakipTarihi(yerel('2026-03-10', '09:30'));
    expect(ymd(w)).toBe('2026-03-24');
    expect([w.getHours(), w.getMinutes()]).toEqual([23, 59]);
  });
});

describe('Bulgu 1 — sonraki duruşma varsayılanı', () => {
  it('saat 09:30 sabit değil: bu duruşmanın saati korunur, gün bugünden +30', () => {
    const s = varsayilanSonrakiDurusma(yerel('2026-03-10', '14:45'), yerel('2026-03-15', '18:00'));
    expect(ymd(s)).toBe('2026-04-14');
    expect([s.getHours(), s.getMinutes()]).toEqual([14, 45]);
  });
});

describe('Bulgu 3 — çift kayıt koruması bellekten değil veriden', () => {
  const duruslar = [
    { id: 'h2', case_id: 'c1', scheduled_at: '2026-04-14T06:30:00+00:00' },
    { id: 'h3', case_id: 'c2', scheduled_at: '2026-05-01T06:30:00+00:00' },
  ];

  it('aynı dosyada aynı ANDA duruşma varsa (biçim farkı olsa da) çift sayılır', () => {
    expect(ayniDurusmaVarMi(duruslar, 'c1', '2026-04-14T06:30:00.000Z')).toBe(true);
  });

  it('başka dosya ya da başka an çift sayılmaz', () => {
    expect(ayniDurusmaVarMi(duruslar, 'c2', '2026-04-14T06:30:00.000Z')).toBe(false);
    expect(ayniDurusmaVarMi(duruslar, 'c1', '2026-04-14T07:30:00.000Z')).toBe(false);
  });

  const sureler = [{ case_id: 'c1', title: 'Beyan / cevap süresi (HMK 94)', due_at: '2026-03-24T20:59:00+00:00' }];

  it('aynı dosya + başlık + son an varsa süre zaten kayıtlıdır', () => {
    expect(ayniSureVarMi(sureler, 'c1', 'Beyan / cevap süresi (HMK 94)', '2026-03-24T20:59:00.000Z')).toBe(true);
  });

  it('başlık ya da gün farklıysa yeni süredir', () => {
    expect(ayniSureVarMi(sureler, 'c1', 'İstinaf başvurusu (HMK 345)', '2026-03-24T20:59:00.000Z')).toBe(false);
    expect(ayniSureVarMi(sureler, 'c1', 'Beyan / cevap süresi (HMK 94)', '2026-03-25T20:59:00.000Z')).toBe(false);
    expect(ayniSureVarMi(sureler, 'c9', 'Beyan / cevap süresi (HMK 94)', '2026-03-24T20:59:00.000Z')).toBe(false);
  });

  it('geçersiz tarih çift sayılmaz (çökmez)', () => {
    expect(ayniDurusmaVarMi(duruslar, 'c1', 'bozuk')).toBe(false);
  });
});

describe('Bulgu 4 — "Bekleyen duruşma kalmadı" yalnız gerçekten kalmadıysa', () => {
  it('tek bekleyen kaydedilince biter', () => {
    expect(kayittanSonra(0, 1)).toEqual({ bitti: true, idx: 0 });
  });

  it('atlanmış kayıtlar varken biter DEĞİL: başa sarar', () => {
    // 3 bekleyen, kullanıcı ilk ikisini atlayıp sonuncuyu kaydetti → 2 kayıt hâlâ bekliyor.
    expect(kayittanSonra(2, 3)).toEqual({ bitti: false, idx: 0 });
  });

  it('ortadaki kaydedilince sıradaki aynı sırada kalır', () => {
    expect(kayittanSonra(1, 3)).toEqual({ bitti: false, idx: 1 });
  });

  it('atla son kayıtta başa döner, yoksa takılıp kalmaz', () => {
    expect(sonrakiSira(0, 3)).toBe(1);
    expect(sonrakiSira(2, 3)).toBe(0);
    expect(sonrakiSira(0, 0)).toBe(0);
  });
});

describe('Bulgu 7 — yapay zekâya müvekkil/karşı taraf adı gitmez', () => {
  const dosya = {
    title: 'Ahmet Yılmaz - Mehmet Demir Alacak Davası',
    description: 'Ahmet Yılmaz, Mehmet Demir\'e 250.000 TL borç verdi. TC 12345678901. Demir ödemedi.',
    case_type: 'Alacak',
    court_name: 'İstanbul 5. Asliye Hukuk Mahkemesi',
    court_category: 'hukuk' as const,
    opposing_party: 'Mehmet Demir',
    client: { id: 'k1', full_name: 'Ahmet Yılmaz', company: 'Yılmaz İnşaat Ltd. Şti.' },
  };

  it('istemde ad, soyad, şirket adı ve kimlik numarası yok; rol sözcükleri var', () => {
    const istem = briefIstemi(dosya);
    for (const yasak of ['Ahmet', 'Yılmaz', 'Mehmet', 'Demir', 'İnşaat', '12345678901']) {
      expect(istem, `istemde "${yasak}" var`).not.toContain(yasak);
    }
    expect(istem).toContain('Müvekkil');
    expect(istem).toContain('Karşı taraf');
    // Davanın niteliği brif için gerekli: tür, mahkeme ve talep tutarı kalır.
    expect(istem).toContain('Alacak');
    expect(istem).toContain('İstanbul 5. Asliye Hukuk Mahkemesi');
    expect(istem).toContain('250.000 TL');
  });

  it('Türkçe büyük/küçük harf farkı adı kaçırmaz (İ/ı)', () => {
    const s = adlariRolleCevir('ISPARTA İNŞAAT davası; ısparta inşaat dilekçesi', [
      { ad: 'Isparta İnşaat', rol: 'Müvekkil' },
    ]);
    expect(s).toBe('Müvekkil davası; Müvekkil dilekçesi');
  });

  it('ad yoksa metne dokunmaz; kısa ve ortak sözcük parçalarını ezmez', () => {
    expect(adlariRolleCevir('Kira alacağı', [{ ad: null, rol: 'Müvekkil' }])).toBe('Kira alacağı');
    // "Ali" adı, "Alicı" gibi başka bir sözcüğün içinde geçmemeli.
    expect(adlariRolleCevir('Ali Veli alıcı sıfatıyla', [{ ad: 'Ali Veli', rol: 'Müvekkil' }])).toBe(
      'Müvekkil alıcı sıfatıyla'
    );
  });
});
