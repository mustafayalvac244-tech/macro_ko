import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  eksikGunler,
  fihristCoz,
  fihristUrl,
  turkiyeBugun,
  yazimKarari,
  type GazeteMaddesi,
  type GazeteSatiri,
} from '../supabase/functions/_shared/resmiGazete';
import { grupla, grupOnceligi, listeDurumu, onemliMaddeler, universiteMi, type GazeteGunu } from '@/lib/resmiGazete';

// Gerçek fihristler (resmigazete.gov.tr, windows-1254, 05.10.2026'da indirildi).
const oku = (ad: string) =>
  new TextDecoder('windows-1254').decode(readFileSync(new URL(`./fixtures/resmi-gazete/${ad}`, import.meta.url)));
const tireSayisi = (html: string) => (html.replace(/<[^>]+>/g, ' ').match(/––/g) ?? []).length;

describe('fihristCoz — gerçek fihristler', () => {
  it('01.10.2026: 18 madde, sayı 33387, ilk madde CB kararı', () => {
    const html = oku('20261001.htm');
    const f = fihristCoz(html, fihristUrl('2026-10-01'));
    expect(f.sayi).toBe(33387);
    expect(f.maddeler).toHaveLength(18);
    expect(f.maddeler).toHaveLength(tireSayisi(html));
    expect(f.maddeler[0]).toMatchObject({ bolum: 'YÜRÜTME VE İDARE BÖLÜMÜ', grup: 'CUMHURBAŞKANI KARARLARI' });
    expect(f.maddeler[1].baslik).toBe('Bazı Mallara Uygulanan Özel Tüketim Vergisi Tutarlarının Yeniden Belirlenmesi Hakkında Karar (Karar Sayısı: 11822)');
    expect(f.maddeler[1].url).toBe('https://www.resmigazete.gov.tr/eskiler/2026/10/20261001-3-3.pdf');
    expect(f.mukerrerler).toEqual([]);
  });

  it('başlıkta tire, &nbsp; ve &#8200; kalmaz', () => {
    const f = fihristCoz(oku('20261001.htm'), fihristUrl('2026-10-01'));
    for (const m of f.maddeler) {
      expect(m.baslik).not.toMatch(/^[–\-\s]/);
      expect(m.baslik).not.toMatch(/&nbsp;|&#\d+;|\s{2}/);
    }
  });

  it('18.09.2026: Anayasa Mahkemesi kararları YARGI BÖLÜMÜ altında', () => {
    const html = oku('20260918.htm');
    const f = fihristCoz(html, fihristUrl('2026-09-18'));
    expect(f.maddeler).toHaveLength(tireSayisi(html));
    const aym = f.maddeler.filter((m) => m.grup === 'ANAYASA MAHKEMESİ KARARLARI');
    expect(aym.length).toBeGreaterThan(0);
    for (const m of aym) expect(m.bolum).toBe('YARGI BÖLÜMÜ');
  });

  it('06.09.2026: mükerrer sayfa bağlantısı bulunur ve madde sayılmaz', () => {
    const f = fihristCoz(oku('20260906.htm'), fihristUrl('2026-09-06'));
    expect(f.mukerrerler).toEqual(['https://www.resmigazete.gov.tr/eskiler/2026/09/20260906M1.htm']);
    // Maddeler PDF de HTML de olabilir (06.09'da üçü de .htm); mükerrer
    // sayfanın kendisi madde listesine KARIŞMAMALI.
    expect(f.maddeler).toHaveLength(3);
    expect(f.maddeler.some((m) => /M\d+\.htm$/.test(m.url))).toBe(false);
  });

  it('mükerrer sayfa: Orta Vadeli Program, mukerrer işaretli', () => {
    const f = fihristCoz(oku('20260906M1.htm'), 'https://www.resmigazete.gov.tr/eskiler/2026/09/20260906M1.htm', true);
    expect(f.maddeler).toHaveLength(1);
    expect(f.maddeler[0]).toMatchObject({ grup: 'CUMHURBAŞKANI KARARI', mukerrer: true });
    expect(f.maddeler[0].baslik).toMatch(/^Orta Vadeli Program \(2027-2029\)/);
  });

  it('ilan bölümü alınmaz', () => {
    for (const ad of ['20261001.htm', '20260918.htm', '20260906.htm']) {
      const f = fihristCoz(oku(ad), fihristUrl('2026-10-01'));
      expect(f.maddeler.some((m) => /İL[AÂ]N/.test(m.bolum))).toBe(false);
    }
  });
});

describe('yardımcılar', () => {
  it('fihrist adresi', () => {
    expect(fihristUrl('2026-10-05')).toBe('https://www.resmigazete.gov.tr/eskiler/2026/10/20261005.htm');
  });

  it('Türkiye günü UTC+3: 21:00 UTC ertesi gündür', () => {
    expect(turkiyeBugun(new Date('2026-10-04T20:59:00Z'))).toBe('2026-10-04');
    expect(turkiyeBugun(new Date('2026-10-04T21:00:00Z'))).toBe('2026-10-05');
  });

  it('öncelik: kanun > AYM > CB kararı > yönetmelik > atama', () => {
    const s = ['ATAMA KARARLARI', 'YÖNETMELİKLER', 'CUMHURBAŞKANI KARARLARI', 'ANAYASA MAHKEMESİ KARARI', 'KANUNLAR'].map(grupOnceligi);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
  });

  it('üniversite yönetmeliği ayırt edilir', () => {
    expect(universiteMi({ bolum: '', grup: 'YÖNETMELİKLER', baslik: 'Koç Üniversitesi Lisansüstü Eğitim Yönetmeliği', url: '' })).toBe(true);
    expect(universiteMi({ bolum: '', grup: 'YÖNETMELİKLER', baslik: 'Avukatlık Kanunu Yönetmeliğinde Değişiklik', url: '' })).toBe(false);
  });

  it('01.10.2026 öne çıkanlar: ataması yok, ilki CB kararı; gruplar önceliğe göre', () => {
    const f = fihristCoz(oku('20261001.htm'), fihristUrl('2026-10-01'));
    const o = onemliMaddeler(f.maddeler);
    expect(o.some((m) => /ATAMA/.test(m.grup))).toBe(false);
    expect(o[0].grup).toBe('CUMHURBAŞKANI KARARLARI');
    const g = grupla(f.maddeler).map((x) => x.grup);
    expect(g[0]).toBe('CUMHURBAŞKANI KARARLARI');
    expect(g[g.length - 1]).toBe('ATAMA KARARLARI');
    expect(grupla(f.maddeler).reduce((n, x) => n + x.maddeler.length, 0)).toBe(f.maddeler.length);
  });
});

// 10.10.2026 denetim bulguları: sağlam günü ezme, mükerrer düşünce ana sayıyı
// atma, kaçan günü bir daha çekmeme.
const madde = (baslik: string, mukerrer = false): GazeteMaddesi => ({
  bolum: 'YÜRÜTME VE İDARE BÖLÜMÜ',
  grup: 'YÖNETMELİKLER',
  baslik,
  url: `https://www.resmigazete.gov.tr/eskiler/2026/10/${encodeURIComponent(baslik)}.pdf`,
  ...(mukerrer ? { mukerrer: true } : {}),
});
const satir = (sayi: number | null, maddeler: GazeteMaddesi[], mukerrer = 0): GazeteSatiri => ({ sayi, maddeler, mukerrer });

describe('yazimKarari — doğrulamasız upsert sağlam günü ezmesin', () => {
  it('hata/bakım sayfası (200 ama fihrist değil) hiçbir şey yazdırmaz', () => {
    const f = fihristCoz('<html><body>Bakımdayız</body></html>', fihristUrl('2026-10-09'));
    expect(f.sayi).toBeNull();
    expect(f.maddeler).toHaveLength(0);
    const eski = satir(33386, [madde('A'), madde('B')]);
    expect(yazimKarari(satir(f.sayi, f.maddeler, 0), eski, false)).toEqual({ yaz: false, neden: 'gecersiz_fihrist' });
    expect(yazimKarari(satir(f.sayi, f.maddeler, 0), null, false)).toEqual({ yaz: false, neden: 'gecersiz_fihrist' });
  });

  it('ayrıştırma boş döndü ama kayıtlı gün doluydu: ezilmez', () => {
    const eski = satir(33386, [madde('A'), madde('B'), madde('C')]);
    expect(yazimKarari(satir(33386, []), eski, false)).toEqual({ yaz: false, neden: 'bos_ezme' });
  });

  it('yalnız mükerrer maddesi gelip ana sayfa boş ayrıştıysa da ezilmez', () => {
    const eski = satir(33386, [madde('A'), madde('M', true)], 1);
    const yeni = satir(33386, [madde('M', true)], 1);
    expect(yazimKarari(yeni, eski, false)).toEqual({ yaz: false, neden: 'bos_ezme' });
  });

  it('yalnız ilan olan yeni gün (sayı var, madde yok) yazılır', () => {
    const k = yazimKarari(satir(33387, []), null, false);
    expect(k).toEqual({ yaz: true, satir: satir(33387, []) });
  });

  it('sağlam yeni okuma eskinin yerine geçer', () => {
    const eski = satir(33387, [madde('A')]);
    const yeni = satir(33387, [madde('A'), madde('B')]);
    expect(yazimKarari(yeni, eski, false)).toEqual({ yaz: true, satir: yeni });
  });

  it('mükerrer sayfa düştü, kayıt yok: ana sayı yine de yazılır', () => {
    const yeni = satir(33387, [madde('A'), madde('B')], 1);
    const k = yazimKarari(yeni, null, true);
    expect(k).toEqual({ yaz: true, satir: yeni });
  });

  it('mükerrer sayfa düştü: önceki turun mükerrer maddeleri korunur', () => {
    const eski = satir(33387, [madde('A'), madde('M1', true), madde('M2', true)], 1);
    const yeni = satir(33387, [madde('A'), madde('B')], 1);
    const k = yazimKarari(yeni, eski, true);
    expect(k.yaz).toBe(true);
    if (k.yaz) expect(k.satir.maddeler.map((m) => m.baslik)).toEqual(['A', 'B', 'M1', 'M2']);
  });

  it('mükerrer sayfa düştü ama bu tur bir kısmı geldi: aynı url iki kez yazılmaz', () => {
    const eski = satir(33387, [madde('A'), madde('M1', true), madde('M2', true)], 2);
    const yeni = satir(33387, [madde('A'), madde('M1', true)], 2);
    const k = yazimKarari(yeni, eski, true);
    expect(k.yaz).toBe(true);
    if (k.yaz) expect(k.satir.maddeler.map((m) => m.baslik)).toEqual(['A', 'M1', 'M2']);
  });
});

describe('eksikGunler — kaçan gün bir daha çekilsin', () => {
  it('bugünden geriye, tabloda olmayan günler (yeniden eskiye)', () => {
    expect(eksikGunler('2026-10-10', ['2026-10-10', '2026-10-09', '2026-10-07'], 3)).toEqual(['2026-10-08']);
    expect(eksikGunler('2026-10-10', [], 3)).toEqual(['2026-10-09', '2026-10-08', '2026-10-07']);
  });

  it('bugünün kendisi listeye girmez (onu ana akış çeker); ay sınırı doğru', () => {
    expect(eksikGunler('2026-10-02', [], 3)).toEqual(['2026-10-01', '2026-09-30', '2026-09-29']);
    expect(eksikGunler('2026-10-10', ['2026-10-09'], 0)).toEqual([]);
  });

  it('hepsi tabloda: boş liste', () => {
    expect(eksikGunler('2026-10-10', ['2026-10-09', '2026-10-08'], 2)).toEqual([]);
  });
});

describe('listeDurumu — ekranda hata eldeki veriyi gizlemesin, bayat veri sessiz kalmasın', () => {
  const gun = (tarih: string): GazeteGunu => ({ tarih, sayi: 1, maddeler: [], mukerrer: 0, cekildi: `${tarih}T03:17:00Z` });

  it('yenileme düştü ama önbellekte gün var: liste gösterilir, uyarı "yenilenemedi"', () => {
    const d = listeDurumu([gun('2026-10-10'), gun('2026-10-09')], true, '2026-10-10');
    expect(d).toEqual({ ekran: 'liste', uyari: 'yenilenemedi' });
  });

  it('hata ve hiç veri yok: tam ekran hata', () => {
    expect(listeDurumu([], true, '2026-10-10')).toEqual({ ekran: 'hata', uyari: null });
  });

  it('hata yok, veri yok: boş durum', () => {
    expect(listeDurumu([], false, '2026-10-10')).toEqual({ ekran: 'bos', uyari: null });
  });

  it('en yeni gün bugünden eski: "bayat" uyarısı, en yeni tarihle', () => {
    expect(listeDurumu([gun('2026-10-08'), gun('2026-10-07')], false, '2026-10-10')).toEqual({
      ekran: 'liste',
      uyari: 'bayat',
      sonTarih: '2026-10-08',
    });
  });

  it('bugünün sayısı var: uyarı yok', () => {
    expect(listeDurumu([gun('2026-10-10')], false, '2026-10-10')).toEqual({ ekran: 'liste', uyari: null });
  });

  it('sıra bozuk gelse de en yeni tarih esas alınır', () => {
    expect(listeDurumu([gun('2026-10-07'), gun('2026-10-10')], false, '2026-10-10').uyari).toBeNull();
  });
});
